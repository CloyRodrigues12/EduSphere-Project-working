from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from .models import ClassSession, AttendanceRecord
from core.models import TeachingAllocation
from .serializers import ClassSessionSerializer

class ClassSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Fetch sessions for a specific class OR all classes for the global calendar """
        allocation_id = request.GET.get('allocation_id')
        user_profile = request.user.profile

        if allocation_id:
            # Fetch for a specific class
            sessions = ClassSession.objects.filter(allocation_id=allocation_id).order_by('-date', '-updated_at')
        else:
            # Global Calendar Logic: Fetch ALL sessions
            if user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']:
                sessions = ClassSession.objects.all().order_by('-date', '-updated_at')
            else:
                sessions = ClassSession.objects.filter(allocation__faculty=user_profile).order_by('-date', '-updated_at')
                
        return Response(ClassSessionSerializer(sessions, many=True).data)

    def post(self, request):
        """ Create a new session & auto-generate 'PRESENT' records for the batch """
        allocation_id = request.data.get('allocation_id')
        date = request.data.get('date')
        lecture_count = request.data.get('lecture_count', 1)
        topics_covered = request.data.get('topics_covered', '')

        try:
            # 1. Fetch the allocation
            allocation = TeachingAllocation.objects.get(id=allocation_id)
            
            # 2. SECURITY CHECK: Ensure it's the assigned teacher OR an Admin
            user_profile = request.user.profile
            if user_profile.role not in ['ORG_ADMIN', 'SUPER_ADMIN'] and allocation.faculty != user_profile:
                return Response({"error": "Unauthorized: You are not assigned to this class."}, status=403)
            
            with transaction.atomic():
                session = ClassSession.objects.create(
                    allocation=allocation,
                    date=date,
                    lecture_count=lecture_count,
                    topics_covered=topics_covered
                )
                
                students = allocation.student_group.students.all()
                
                # The Auto-Fill Magic: Create a PRESENT record for everyone instantly
                records_to_create = [
                    AttendanceRecord(session=session, student=student, status='PRESENT')
                    for student in students
                ]
                AttendanceRecord.objects.bulk_create(records_to_create)

            serializer = ClassSessionSerializer(session)
            return Response(serializer.data, status=201)

        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Class not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
    def delete(self, request):
        """ Delete a recorded session """
        session_id = request.GET.get('session_id')
        try:
            session = ClassSession.objects.get(id=session_id)
            
            # Security Check
            user_profile = request.user.profile
            if user_profile.role not in ['ORG_ADMIN', 'SUPER_ADMIN'] and session.allocation.faculty != user_profile:
                return Response({"error": "Unauthorized to delete this session."}, status=403)
                
            session.delete()
            return Response({"message": "Session deleted successfully."}, status=200)
        except ClassSession.DoesNotExist:
            return Response({"error": "Session not found."}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class BulkAttendanceUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        """ Receives the React 'Tap-Grid' changes and updates the database instantly """
        records_data = request.data.get('records', [])
        
        try:
            with transaction.atomic():
                for item in records_data:
                    AttendanceRecord.objects.filter(id=item['id']).update(
                        status=item['status'],
                        remarks=item.get('remarks', '')
                    )
            return Response({"message": "Attendance saved successfully!"})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AttendanceReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Calculates TA, TC, and % for a specific class for PDF export """
        allocation_id = request.GET.get('allocation_id')
        start_date = request.GET.get('start_date') 
        end_date = request.GET.get('end_date')     
        merge_shared = request.GET.get('merge_shared') == 'true' # --- NEW: The Merge Flag ---
        
        if not allocation_id:
            return Response({"error": "Allocation ID is required"}, status=400)
            
        try:
            base_alloc = TeachingAllocation.objects.select_related('subject', 'student_group', 'faculty__user').get(id=allocation_id)
            
            user_profile = request.user.profile
            if user_profile.role not in ['ORG_ADMIN', 'SUPER_ADMIN'] and base_alloc.faculty != user_profile:
                return Response({"error": "Unauthorized to view this report."}, status=403)

            # --- NEW: ALLOCATION MERGING LOGIC ---
            if merge_shared:
                # Find EVERY allocation for this exact Subject and Batch combination
                target_allocations = TeachingAllocation.objects.filter(
                    subject=base_alloc.subject,
                    student_group=base_alloc.student_group
                )
            else:
                target_allocations = [base_alloc]

            # Fetch sessions across all matched allocations
            sessions = ClassSession.objects.filter(allocation__in=target_allocations)
            
            if start_date:
                sessions = sessions.filter(date__gte=start_date)
            if end_date:
                sessions = sessions.filter(date__lte=end_date)
                
            total_tc = sum(session.lecture_count for session in sessions)
            
            if sessions.exists():
                ordered_sessions = sessions.order_by('date')
                first_session_date = ordered_sessions.first().date
                last_session_date = ordered_sessions.last().date
            else:
                first_session_date = None
                last_session_date = None
            
            student_stats = {}
            # Base the student list on the primary allocation's group
            for student in base_alloc.student_group.students.all():
                student_stats[student.id] = {
                    "roll_number": student.roll_number,
                    "name": student.full_name,
                    "ta": 0,
                    "absent": 0,
                    "duty": 0,
                }
                
            records = AttendanceRecord.objects.filter(session__in=sessions).select_related('session')
            for record in records:
                sid = record.student_id
                if sid not in student_stats:
                    continue
                    
                multiplier = record.session.lecture_count
                
                if record.status in ['PRESENT', 'LATE']:
                    student_stats[sid]['ta'] += multiplier
                elif record.status.startswith('DUTY'):
                    student_stats[sid]['ta'] += multiplier
                    student_stats[sid]['duty'] += multiplier
                elif record.status == 'ABSENT':
                    student_stats[sid]['absent'] += multiplier
                    
            results = []
            for stats in student_stats.values():
                percentage = (stats['ta'] / total_tc * 100) if total_tc > 0 else 0
                stats['percentage'] = round(percentage, 2)
                stats['tc'] = total_tc
                results.append(stats)
                
            results.sort(key=lambda x: x['roll_number'])
            
            # --- NEW: COMBINE FACULTY NAMES IF MERGED ---
            if merge_shared:
                faculty_names = []
                for a in target_allocations:
                    fname = f"{a.faculty.user.first_name or ''} {a.faculty.user.last_name or ''}".strip()
                    if fname and fname not in faculty_names:
                        faculty_names.append(fname)
                fac_name = " & ".join(faculty_names) if faculty_names else "Unassigned"
            else:
                fac_name = f"{base_alloc.faculty.user.first_name or ''} {base_alloc.faculty.user.last_name or ''}".strip() or "Unassigned"
            
            return Response({
                "subject_name": base_alloc.subject.name,
                "subject_code": base_alloc.subject.code,
                "semester": str(base_alloc.subject.semester) if hasattr(base_alloc.subject, 'semester') else "N/A", 
                "batch_name": base_alloc.student_group.name,
                "faculty_name": fac_name,
                "total_conducted": total_tc,
                "first_session_date": first_session_date,
                "last_session_date": last_session_date,
                "students": results
            })

        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Class not found."}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)