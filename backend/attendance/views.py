from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from django.db.models import Q, F
from django.utils import timezone
from .models import ClassSession, AttendanceRecord
from core.models import TeachingAllocation
from .serializers import ClassSessionSerializer
from faculty_assignments.models import Mentorship, ClassTeacher


# ====================================================================
# NEW: SMART ROSTER APIs (Used by the new React Attendance Interface)
# ====================================================================

class FacultyAllocationsView(APIView):
    """ Fetches allocations filtered by Role, Year, and Term """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        ay_id = request.GET.get('academic_year')
        term = request.headers.get('X-Term', 'ODD')
        target_dept_id = request.headers.get('X-Department-Id')

        # 1. Base Query
        allocations = TeachingAllocation.objects.select_related('subject', 'student_group', 'faculty__user')
        
        # Filter by Academic Year
        if ay_id:
            allocations = allocations.filter(academic_year_id=ay_id)

        # 2. Role-Based Sandboxing
        is_org_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
        is_hod = user_profile.role == 'HOD'

        allocations = allocations.filter(subject__department__organization=user_profile.organization)

        if is_org_admin:
            if target_dept_id and target_dept_id != 'ALL':
                allocations = allocations.filter(subject__department_id=target_dept_id)
        elif is_hod:
            if user_profile.department:
                allocations = allocations.filter(
                    Q(subject__department=user_profile.department) | Q(faculty=user_profile)
                ).distinct()
            else:
                allocations = allocations.filter(faculty=user_profile)
        else:
            allocations = allocations.filter(faculty=user_profile)

        # 3. SMART TERM FILTERING
        allocations = allocations.annotate(sem_parity=F('subject__semester') % 2)
        if term == 'ODD':
            allocations = allocations.filter(sem_parity=1)
        else:
            allocations = allocations.filter(sem_parity=0)

        # 4. Serialize data
        data = []
        for alloc in allocations:
            data.append({
                "id": alloc.id,
                "subject_name": alloc.subject.name,
                "subject_code": alloc.subject.code,
                "subject_type": alloc.subject.subject_type,
                "semester": alloc.subject.semester,
                "department_code": alloc.subject.department.code if alloc.subject.department else "",
                "group_name": alloc.student_group.name if alloc.student_group else "N/A",
                "student_count": alloc.student_group.students.filter(is_active=True).count() if alloc.student_group else 0,
                "faculty_name": f"{alloc.faculty.user.first_name} {alloc.faculty.user.last_name}".strip() if alloc.faculty and alloc.faculty.user else "Unassigned",
                "faculty_user_id": alloc.faculty.user.id if alloc.faculty and alloc.faculty.user else None
            })

        return Response(data, status=status.HTTP_200_OK)


class ClassRosterView(APIView):
    """ Fetches the list of active students for a specific allocation """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, allocation_id):
        try:
            allocation = TeachingAllocation.objects.get(id=allocation_id)
            students = allocation.student_group.students.filter(is_active=True).order_by('roll_number')
            
            data = [{
                "id": s.id,
                "roll_number": s.roll_number,
                "name": s.full_name,
            } for s in students]
            
            return Response({
                "allocation_id": allocation.id,
                "subject": allocation.subject.name,
                "batch": allocation.student_group.name,
                "students": data
            }, status=status.HTTP_200_OK)
            
        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Allocation not found."}, status=status.HTTP_404_NOT_FOUND)


class MarkAttendanceView(APIView):
    """ Receives the bulk attendance submission and creates Session + Records """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        allocation_id = request.data.get('allocation_id')
        date = request.data.get('date', timezone.now().date())
        time_slot = request.data.get('time_slot', '')
        lecture_count = request.data.get('lecture_count', 1)
        topic = request.data.get('topic', '')
        attendance_data = request.data.get('attendance_data') # Expected: dict of {student_id: status}

        if not allocation_id or not attendance_data:
            return Response({"error": "Missing allocation ID or attendance data."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            allocation = TeachingAllocation.objects.get(id=allocation_id)

            with transaction.atomic():
                # 1. Create the Master Session Record
                session = ClassSession.objects.create(
                    allocation=allocation,
                    date=date,
                    lecture_count=lecture_count,
                    topics_covered=topic,
                )

                # 2. Bulk create the individual student records
                records_to_create = []
                for student_id, att_status in attendance_data.items():
                    records_to_create.append(
                        AttendanceRecord(
                            session=session,
                            student_id=student_id,
                            status=att_status
                        )
                    )
                
                AttendanceRecord.objects.bulk_create(records_to_create)

            return Response({
                "message": "Attendance marked successfully!",
                "session_id": session.id
            }, status=status.HTTP_201_CREATED)

        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Unauthorized or invalid allocation."}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ====================================================================
# EXISTING: CALENDAR, UPDATES, AND ANALYTICS
# ====================================================================

class ClassSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Fetch sessions for a specific class OR all classes for the global calendar """
        allocation_id = request.GET.get('allocation_id')
        user_profile = request.user.profile

        if allocation_id:
            # Fetch for a specific class
            sessions = ClassSession.objects.filter(allocation_id=allocation_id).order_by('-date', '-updated_at')
            return Response(ClassSessionSerializer(sessions, many=True).data)

        # --- GLOBAL CALENDAR LOGIC WITH TERM FILTERING ---
        is_org_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
        is_hod = user_profile.role == 'HOD'
        target_dept_id = request.headers.get('X-Department-Id')
        
        # Determine valid semesters based on Term
        term = request.headers.get('X-Term', 'ODD')
        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

        # Base filter: Org + Term
        sessions = ClassSession.objects.filter(
            allocation__subject__department__organization=user_profile.organization,
            allocation__subject__semester__in=valid_sems
        )

        if is_org_admin:
            if target_dept_id and target_dept_id != 'ALL':
                sessions = sessions.filter(allocation__subject__department_id=target_dept_id)
        elif is_hod:
            # HOD Calendar: Show their department + any external classes they personally teach
            if user_profile.department:
                sessions = sessions.filter(
                    Q(allocation__subject__department=user_profile.department) | 
                    Q(allocation__faculty=user_profile)
                ).distinct()
            else:
                sessions = sessions.filter(allocation__faculty=user_profile)
        else:
            sessions = sessions.filter(allocation__faculty=user_profile)

        sessions = sessions.order_by('-date', '-updated_at')
        return Response(ClassSessionSerializer(sessions, many=True).data)

    def post(self, request):
        """ Create a new session & auto-generate 'PRESENT' records for the batch """
        allocation_id = request.data.get('allocation_id')
        date = request.data.get('date')
        lecture_count = request.data.get('lecture_count', 1)
        topics_covered = request.data.get('topics_covered', '')

        try:
            allocation = TeachingAllocation.objects.get(id=allocation_id)
            user_profile = request.user.profile
            is_org_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
            
            # SECURITY CHECK: Allow if it's their department OR if they personally teach it
            if not is_org_admin:
                is_assigned_faculty = (allocation.faculty == user_profile)
                if user_profile.role == 'HOD' and allocation.subject.department != user_profile.department and not is_assigned_faculty:
                    return Response({"error": "Unauthorized: Class outside your department."}, status=403)
                elif user_profile.role not in ['HOD'] and not is_assigned_faculty:
                    return Response({"error": "Unauthorized: You are not assigned to this class."}, status=403)
            
            with transaction.atomic():
                session = ClassSession.objects.create(
                    allocation=allocation,
                    date=date,
                    lecture_count=lecture_count,
                    topics_covered=topics_covered
                )
                
                students = allocation.student_group.students.all()
                
                # Auto-Fill: Create a PRESENT record for everyone instantly
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
            user_profile = request.user.profile
            is_org_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
            
            # Security Check: Allow if it's their department OR if they personally teach it
            if not is_org_admin:
                is_assigned_faculty = (session.allocation.faculty == user_profile)
                if user_profile.role == 'HOD' and session.allocation.subject.department != user_profile.department and not is_assigned_faculty:
                    return Response({"error": "Unauthorized: Session belongs to another department."}, status=403)
                elif user_profile.role not in ['HOD'] and not is_assigned_faculty:
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
        """ Calculates TA, TC, and % for a SPECIFIC individual class PDF export """
        allocation_id = request.GET.get('allocation_id')
        start_date = request.GET.get('start_date') 
        end_date = request.GET.get('end_date')     
        merge_shared = request.GET.get('merge_shared') == 'true' 
        
        if not allocation_id:
            return Response({"error": "Allocation ID is required"}, status=400)
            
        try:
            base_alloc = TeachingAllocation.objects.select_related('subject', 'student_group', 'faculty__user').get(id=allocation_id)
            
            user_profile = request.user.profile
            is_org_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
            
            # Security Check: Allow if it's their department OR if they personally teach it
            if not is_org_admin:
                is_assigned_faculty = (base_alloc.faculty == user_profile)
                if user_profile.role == 'HOD' and base_alloc.subject.department != user_profile.department and not is_assigned_faculty:
                    return Response({"error": "Unauthorized to view this department's report."}, status=403)
                elif user_profile.role not in ['HOD'] and not is_assigned_faculty:
                    return Response({"error": "Unauthorized to view this report."}, status=403)

            # ALLOCATION MERGING LOGIC
            if merge_shared:
                target_allocations = TeachingAllocation.objects.filter(
                    subject=base_alloc.subject,
                    student_group=base_alloc.student_group
                )
            else:
                target_allocations = [base_alloc]

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
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')    

        if not academic_year_id or not semester or not subject_ids:
            return Response({"error": "Missing parameters"}, status=400)

        try:
            # --- APPLY TERM FILTERING HERE ---
            term = request.headers.get('X-Term', 'ODD')
            valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

            subject_id_list = [int(sid) for sid in subject_ids.split(',') if sid.strip()]
            
            allocations = TeachingAllocation.objects.filter(
                academic_year_id=academic_year_id,
                subject_id__in=subject_id_list,
                subject__semester__in=valid_sems
            ).select_related('subject', 'subject__department', 'student_group')

            user_profile = request.user.profile
            is_org_admin = user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']
            
            # --- UPDATED SANDBOX: Both HOD and Faculty see the whole department ---
            if not is_org_admin:
                if user_profile.department:
                    allocations = allocations.filter(subject__department=user_profile.department)
                else:
                    allocations = allocations.filter(faculty=user_profile)
            # ---------------------------------------------------------------------

            if not allocations.exists():
                return Response({"error": "No recorded classes found for these subjects in this term."}, status=404)

            department_name = allocations.first().subject.department.name
            
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
                alloc_tc_cache[alloc.id] = {"tc": tc, "sessions": sessions, "subject_id": str(alloc.subject.id)}

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
                    
                    student_stats[student.id]["subjects"][sub_id]["tc"] += tc
                    student_stats[student.id]["total_tc"] += tc

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
        try:
            academic_year_id = request.GET.get('academic_year_id')
            semester = request.GET.get('semester')
            subject_id = request.GET.get('subject_id')
            allocation_id = request.GET.get('allocation_id')
            start_date = request.GET.get('start_date') 
            end_date = request.GET.get('end_date') 
                
            if not academic_year_id:
                return Response({"error": "Academic Year ID is required"}, status=400)
                
            user_profile = request.user.profile
            is_org_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
            target_dept_id = request.headers.get('X-Department-Id')
            
            # --- APPLY TERM FILTERING HERE ---
            term = request.headers.get('X-Term', 'ODD')
            valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

            allocations = TeachingAllocation.objects.filter(
                academic_year_id=academic_year_id,
                subject__department__organization=user_profile.organization,
                subject__semester__in=valid_sems
            ).select_related('subject', 'student_group')
            
            if is_org_admin:
                if target_dept_id and target_dept_id != 'ALL':
                    allocations = allocations.filter(subject__department_id=target_dept_id)
            else:
                if user_profile.department:
                    if allocation_id:
                        allocations = allocations.filter(
                            Q(subject__department=user_profile.department) | Q(faculty=user_profile)
                        )
                    else:
                        allocations = allocations.filter(subject__department=user_profile.department)
                else:
                    allocations = allocations.filter(faculty=user_profile)

            if allocation_id:
                allocations = allocations.filter(id=allocation_id)
            else:
                if semester:
                    allocations = allocations.filter(subject__semester=semester)
                if subject_id:
                    allocations = allocations.filter(subject_id=subject_id)

            if not allocations.exists():
                return Response({"safe": [], "atRisk": [], "defaulters": [], "chartData": [], "totalStudents": 0})

            # --- Fetch Class Teacher Name ---
            class_teacher_name = "N/A"
            if semester:
                sem_int = int(semester)
                if sem_int <= 2: yl = 'FE'
                elif sem_int <= 4: yl = 'SE'
                elif sem_int <= 6: yl = 'TE'
                else: yl = 'BE'
                
                first_alloc = allocations.first()
                if first_alloc:
                    ct = ClassTeacher.objects.filter(
                        academic_year_id=academic_year_id, 
                        department=first_alloc.subject.department, 
                        year_level=yl
                    ).first()
                    if ct:
                        class_teacher_name = ct.faculty.user.get_full_name() or ct.faculty.user.username

            student_stats = {}
            global_first_date = None
            global_last_date = None

            # --- Prefetch Mentorships ---
            all_student_ids = set()
            for alloc in allocations:
                all_student_ids.update(alloc.student_group.students.values_list('id', flat=True))
            
            mentor_lookup = {}
            mentorships = Mentorship.objects.filter(student_id__in=all_student_ids).select_related('mentor__user')
            for m in mentorships:
                mentor_lookup[m.student_id] = m.mentor.user.get_full_name() or m.mentor.user.username

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
                            "tc": 0,
                            "mentor_name": mentor_lookup.get(student.id, "Unassigned")
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
                        
            defaulters.sort(key=lambda x: (x.get('mentor_name', 'Unassigned'), x['roll_number']))
            at_risk.sort(key=lambda x: (x.get('mentor_name', 'Unassigned'), x['roll_number']))
            safe.sort(key=lambda x: (x.get('mentor_name', 'Unassigned'), x['roll_number']))
            
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
                "last_session_date": global_last_date,
                "class_teacher_name": class_teacher_name
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                "safe": [], "atRisk": [], "defaulters": [], 
                "chartData": [], "totalStudents": 0, "error": str(e)
            })