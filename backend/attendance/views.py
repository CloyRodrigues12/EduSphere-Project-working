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
            # Global Calendar Logic: Fetch ALL sessions based on Department Filter
            is_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
            target_dept_id = request.headers.get('X-Department-Id')

            # Start by restricting to the user's Organization
            sessions = ClassSession.objects.filter(allocation__subject__department__organization=user_profile.organization)

            # Apply Security / Sandbox Filter
            if not is_admin:
                sessions = sessions.filter(allocation__faculty=user_profile)
            elif target_dept_id and target_dept_id != 'ALL':
                sessions = sessions.filter(allocation__subject__department_id=target_dept_id)

            sessions = sessions.order_by('-date', '-updated_at')
                
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

class CumulativeReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        academic_year_id = request.GET.get('academic_year_id')
        semester = request.GET.get('semester')
        subject_ids = request.GET.get('subject_ids')
        start_date = request.GET.get('start_date') # NEW
        end_date = request.GET.get('end_date')     # NEW

        if not academic_year_id or not semester or not subject_ids:
            return Response({"error": "Missing parameters"}, status=400)

        try:
            subject_id_list = [int(sid) for sid in subject_ids.split(',') if sid.strip()]
            
            # Fetch all allocations for these subjects
            allocations = TeachingAllocation.objects.filter(
                academic_year_id=academic_year_id,
                subject_id__in=subject_id_list
            ).select_related('subject', 'subject__department', 'student_group')

            if not allocations.exists():
                return Response({"error": "No recorded classes found for these subjects."}, status=404)

            # Extract Department Name
            department_name = allocations.first().subject.department.name
            
            # Extract unique subjects for the PDF columns
            subjects_info = {}
            for alloc in allocations:
                if alloc.subject.id not in subjects_info:
                    subjects_info[alloc.subject.id] = {
                        "id": alloc.subject.id,
                        "code": alloc.subject.code,
                        "name": alloc.subject.name
                    }

            student_stats = {}
            alloc_tc_cache = {}
            
            global_first_date = None
            global_last_date = None

            # Calculate Total Conducted (TC) & find the Date Range
            for alloc in allocations:
                sessions = ClassSession.objects.filter(allocation=alloc)
                
                # Apply Date Filters
                if start_date:
                    sessions = sessions.filter(date__gte=start_date)
                if end_date:
                    sessions = sessions.filter(date__lte=end_date)
                
                # Find absolute first and last dates
                if sessions.exists():
                    ordered = sessions.order_by('date')
                    f_date = ordered.first().date
                    l_date = ordered.last().date
                    if not global_first_date or f_date < global_first_date:
                        global_first_date = f_date
                    if not global_last_date or l_date > global_last_date:
                        global_last_date = l_date

                tc = sum(s.lecture_count for s in sessions)
                alloc_tc_cache[alloc.id] = {"tc": tc, "sessions": sessions, "subject_id": str(alloc.subject.id)}

                # Initialize students who are officially in this allocation's batch
                for student in alloc.student_group.students.all():
                    if student.id not in student_stats:
                        student_stats[student.id] = {
                            "roll_number": student.roll_number,
                            "name": student.full_name,
                            "subjects": {},
                            "total_ta": 0,
                            "total_tc": 0
                        }
                    
                    sub_id = str(alloc.subject.id)
                    if sub_id not in student_stats[student.id]["subjects"]:
                        student_stats[student.id]["subjects"][sub_id] = {"ta": 0, "tc": 0}
                    
                    # Add this allocation's TC to the student's expected total
                    student_stats[student.id]["subjects"][sub_id]["tc"] += tc
                    student_stats[student.id]["total_tc"] += tc

            # Process Attendance Records (TA)
            for alloc in allocations:
                sessions = alloc_tc_cache[alloc.id]["sessions"]
                sub_id = alloc_tc_cache[alloc.id]["subject_id"]
                
                records = AttendanceRecord.objects.filter(session__in=sessions).select_related('session')
                for record in records:
                    sid = record.student_id
                    if sid not in student_stats:
                        continue
                    
                    multiplier = record.session.lecture_count
                    if record.status in ['PRESENT', 'LATE'] or record.status.startswith('DUTY'):
                        student_stats[sid]["subjects"][sub_id]["ta"] += multiplier
                        student_stats[sid]["total_ta"] += multiplier

            # Calculate Percentages and Format
            results = []
            for stats in student_stats.values():
                for sub_id, sub_stats in stats["subjects"].items():
                    sub_stats["percentage"] = round((sub_stats["ta"] / sub_stats["tc"] * 100), 1) if sub_stats["tc"] > 0 else 0
                
                stats["cumulative_percentage"] = round((stats["total_ta"] / stats["total_tc"] * 100), 2) if stats["total_tc"] > 0 else 0
                results.append(stats)

            results.sort(key=lambda x: x['roll_number'])

            return Response({
                "department_name": department_name,
                "semester": semester,
                "first_session_date": global_first_date,
                "last_session_date": global_last_date,
                "subjects": list(subjects_info.values()),
                "students": results
            })

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class AnalyticsRadarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        academic_year_id = request.GET.get('academic_year_id')
        semester = request.GET.get('semester')
        subject_id = request.GET.get('subject_id')
        allocation_id = request.GET.get('allocation_id')
        start_date = request.GET.get('start_date') 
        end_date = request.GET.get('end_date')     
        
        if not academic_year_id:
            return Response({"error": "Academic Year ID is required"}, status=400)
            
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        # Base query restricted to organization
        allocations = TeachingAllocation.objects.filter(
            academic_year_id=academic_year_id,
            subject__department__organization=user_profile.organization
        ).select_related('subject', 'student_group')
        
        # Apply Security / Sandbox Filter
        if not is_admin:
            if not user_profile.department:
                return Response({"safe": [], "atRisk": [], "defaulters": [], "chartData": [], "totalStudents": 0})
            allocations = allocations.filter(subject__department=user_profile.department, faculty=user_profile)
        elif target_dept_id and target_dept_id != 'ALL':
            allocations = allocations.filter(subject__department_id=target_dept_id)

        # Apply Explicit Filters (from UI dropdowns)
        if allocation_id:
            allocations = allocations.filter(id=allocation_id)
        else:
            if semester:
                allocations = allocations.filter(subject__semester=semester)
            if subject_id:
                allocations = allocations.filter(subject_id=subject_id)

        if not allocations.exists():
            return Response({"safe": [], "atRisk": [], "defaulters": [], "chartData": [], "totalStudents": 0})

        student_stats = {}
        global_first_date = None
        global_last_date = None

        for alloc in allocations:
            sessions = ClassSession.objects.filter(allocation=alloc)
            
            if start_date:
                sessions = sessions.filter(date__gte=start_date)
            if end_date:
                sessions = sessions.filter(date__lte=end_date)

            if sessions.exists():
                ordered = sessions.order_by('date')
                f_date = ordered.first().date
                l_date = ordered.last().date
                if not global_first_date or f_date < global_first_date:
                    global_first_date = f_date
                if not global_last_date or l_date > global_last_date:
                    global_last_date = l_date
                
            tc = sum(s.lecture_count for s in sessions)
            
            for student in alloc.student_group.students.all():
                if student.id not in student_stats:
                    student_stats[student.id] = {
                        "id": student.id,
                        "name": student.full_name,
                        "roll_number": student.roll_number,
                        "semester": str(alloc.subject.semester) if hasattr(alloc.subject, 'semester') else "N/A", 
                        "ta": 0,
                        "tc": 0
                    }
                student_stats[student.id]["tc"] += tc
                
            records = AttendanceRecord.objects.filter(session__in=sessions).select_related('session')
            for record in records:
                sid = record.student_id
                if sid in student_stats:
                    if record.status in ['PRESENT', 'LATE'] or record.status.startswith('DUTY'):
                        student_stats[sid]['ta'] += record.session.lecture_count

        safe, at_risk, defaulters = [], [], []
        for s in student_stats.values():
            if s["tc"] > 0:
                perc = round((s["ta"] / s["tc"]) * 100, 2)
            else:
                perc = 100.0 
                
            s["percentage"] = perc
            if perc < 75:
                defaulters.append(s)
            elif perc < 80:
                at_risk.append(s)
            else:
                safe.append(s)
                    
        defaulters.sort(key=lambda x: x['roll_number'])
        at_risk.sort(key=lambda x: x['roll_number'])
        safe.sort(key=lambda x: x['roll_number'])
        
        chart_data = [
            {"name": "Safe", "value": len(safe), "fill": "#10b981"},         
            {"name": "At Risk", "value": len(at_risk), "fill": "#f59e0b"},   
            {"name": "Defaulters", "value": len(defaulters), "fill": "#ef4444"} 
        ]

        return Response({
            "safe": safe,
            "atRisk": at_risk,
            "defaulters": defaulters,
            "chartData": chart_data,
            "totalStudents": len(student_stats),
            "first_session_date": global_first_date,
            "last_session_date": global_last_date
        })