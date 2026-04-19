from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from core.models import Student
from faculty_assignments.models import ClassTeacher
from counselling.models import Mentorship 
from .serializers import ClassTeacherSerializer

from attendance.models import AttendanceRecord
from results.models import InternalAssessment

class ClassTeacherManagerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        ay_id = request.GET.get('academic_year')
        if not ay_id:
            return Response({"error": "Academic Year required"}, status=400)

        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            ct = ClassTeacher.objects.filter(academic_year_id=ay_id, department__organization=user_profile.organization)
        else:
            ct = ClassTeacher.objects.filter(academic_year_id=ay_id, department=user_profile.department)
        
        return Response(ClassTeacherSerializer(ct, many=True).data)

    def post(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
        
        faculty_id = request.data.get('faculty_id')
        ay_id = request.data.get('academic_year')
        year_level = request.data.get('year_level')
        division = request.data.get('division', '') 
        
        dept_id = request.data.get('department_id', user_profile.department.id if user_profile.department else None)

        if str(dept_id) == 'ALL':
            return Response({"error": "Please select a specific department from the Topbar to assign a Class Teacher."}, status=400)

        if not all([faculty_id, ay_id, year_level, dept_id]):
            return Response({"error": "Missing parameters"}, status=400)

        ct, created = ClassTeacher.objects.update_or_create(
            department_id=dept_id,
            academic_year_id=ay_id,
            year_level=year_level,
            division=division,
            defaults={'faculty_id': faculty_id}
        )
        return Response(ClassTeacherSerializer(ct).data)

    def delete(self, request):
        ct_id = request.GET.get('id')
        ClassTeacher.objects.filter(id=ct_id).delete()
        return Response({"message": "Class Teacher removed"})


class ClassTeacherStudentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ct_id = request.GET.get('ct_id')
        if not ct_id:
            return Response({"error": "Class Teacher ID required"}, status=400)
        
        try:
            ct = ClassTeacher.objects.get(id=ct_id)
            user_profile = request.user.profile
            is_org_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
            
            if not is_org_admin and ct.department != user_profile.department:
                return Response({"error": "Unauthorized to view this class's students."}, status=403)

            # --- SMART TERM FILTERING ---
            term = request.headers.get('X-Term', 'ODD')
            valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]
            
            sem_map = {'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8]}
            sems = sem_map.get(ct.year_level, [])
            
            # Intersect Year Level with the Active Term
            active_sems = list(set(sems) & set(valid_sems))
            
            students = Student.objects.filter(
                department=ct.department,
                current_semester__in=active_sems,
                is_active=True
            ).order_by('roll_number')

            data = [{
                "id": s.id,
                "full_name": s.full_name,
                "roll_number": s.roll_number,
                "semester": s.current_semester,
            } for s in students]

            return Response(data)

        except ClassTeacher.DoesNotExist:
            return Response({"error": "Class Teacher assignment not found."}, status=404)



class MyClassDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ay_id = request.GET.get('academic_year')
        user_profile = request.user.profile
        
        if not ay_id:
            return Response({"error": "Academic Year required"}, status=400)

        ct = ClassTeacher.objects.filter(faculty=user_profile, academic_year_id=ay_id).first()
        
        if not ct:
            return Response({"is_class_teacher": False})

        term = request.GET.get('term', request.headers.get('X-Term', 'ODD')).upper()
        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

        sem_map = {'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8]}
        sems = sem_map.get(ct.year_level, [])
        active_sems = list(set(sems) & set(valid_sems))

        from core.models import StudentGroup
        
        relevant_groups = StudentGroup.objects.filter(
            academic_year_id=ay_id,
            department=ct.department,
            semester__in=active_sems
        )

        students = Student.objects.filter(
            studentgroup__in=relevant_groups,
            is_active=True
        ).prefetch_related('mentorship__mentor__user').distinct().order_by('roll_number')

        # 1. Fetch Attendance
        records = AttendanceRecord.objects.filter(
            student__in=students,
            session__allocation__academic_year_id=ay_id,
            session__allocation__subject__semester__in=active_sems
        ).select_related('session')

        student_stats = {s.id: {"ta": 0, "tc": 0} for s in students}
        for r in records:
            if r.student_id in student_stats:
                student_stats[r.student_id]["tc"] += r.session.lecture_count
                if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'):
                    student_stats[r.student_id]["ta"] += r.session.lecture_count

        # 2. Fetch Internal Marks
        marks_records = InternalAssessment.objects.filter(
            student__in=students,
            academic_year_id=ay_id,
            term=term
        ).select_related('subject')

        student_marks_map = {s.id: [] for s in students}
        for record in marks_records:
            conducted = sum(1 for m in [record.it1, record.it2, record.it3] if m is not None)
            student_marks_map[record.student_id].append({
                "name": record.subject.name,
                "code": record.subject.code,
                "it1": record.it1,
                "it2": record.it2,
                "it3": record.it3,
                "marks": record.final_score,
                "is_passing": record.is_passing,
                "conducted": conducted
            })

        student_data = []
        safe, at_risk, defaulters = 0, 0, 0

        for student in students:
            stats = student_stats[student.id]
            ta = stats["ta"]
            tc = stats["tc"]
            perc = round((ta / tc * 100), 2) if tc > 0 else 100.0

            if perc < 75:
                defaulters += 1
                status_label = "Defaulter"
            elif perc < 80:
                at_risk += 1
                status_label = "At Risk"
            else:
                safe += 1
                status_label = "Safe"

            mentor_name = "Unassigned"
            mentorship = student.mentorship.first()
            if mentorship:
                mentor_name = mentorship.mentor.user.get_full_name() or mentorship.mentor.user.username

            student_data.append({
                "id": student.id,
                "roll_number": student.roll_number,
                "name": student.full_name,
                "ta": ta,
                "tc": tc,
                "percentage": perc,
                "status": status_label,
                "mentor_name": mentor_name,
                "subject_marks": student_marks_map[student.id]
            })

        chart_data = [
            {"name": "Safe (≥80%)", "value": safe, "fill": "#10b981"},         
            {"name": "At Risk (75-79%)", "value": at_risk, "fill": "#f59e0b"},   
            {"name": "Defaulters (<75%)", "value": defaulters, "fill": "#ef4444"} 
        ]

        return Response({
            "is_class_teacher": True,
            "class_info": {
                "department": ct.department.name,
                "year_level": ct.year_level,
                "division": ct.division,
                "class_teacher_name": ct.faculty.user.get_full_name() or ct.faculty.user.username
            },
            "stats": {
                "total_students": len(students),
                "safe_count": safe,
                "risk_count": at_risk,
                "defaulter_count": defaulters
            },
            "chartData": chart_data,
            "students": student_data
        })
        
class MyMenteesDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ay_id = request.GET.get('academic_year')
        user_profile = request.user.profile

        if not ay_id:
            return Response({"error": "Academic Year required"}, status=400)

        mentorships = Mentorship.objects.filter(mentor=user_profile).select_related('student')

        if not mentorships.exists():
            return Response({"has_mentees": False})

        # --- SMART TERM FILTERING ---
        term = request.headers.get('X-Term', 'ODD')
        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

        student_ids = [m.student.id for m in mentorships]

        # 1. Fetch aggregate attendance strictly for subjects in the current term
        records = AttendanceRecord.objects.filter(
            student_id__in=student_ids,
            session__allocation__academic_year_id=ay_id,
            session__allocation__subject__semester__in=valid_sems
        ).select_related('session')

        student_stats = {sid: {"ta": 0, "tc": 0} for sid in student_ids}
        for r in records:
            student_stats[r.student_id]["tc"] += r.session.lecture_count
            if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'):
                student_stats[r.student_id]["ta"] += r.session.lecture_count

        # 2. 🚨 NEW: Fetch Internal Marks for mentees
        marks_records = InternalAssessment.objects.filter(
            student_id__in=student_ids,
            academic_year_id=ay_id,
            term=term
        ).select_related('subject')

        student_marks_map = {sid: [] for sid in student_ids}
        for record in marks_records:
            conducted = sum(1 for m in [record.it1, record.it2, record.it3] if m is not None)
            student_marks_map[record.student_id].append({
                "name": record.subject.name,
                "code": record.subject.code,
                "it1": record.it1,
                "it2": record.it2,
                "it3": record.it3,
                "marks": record.final_score,
                "is_passing": record.is_passing,
                "conducted": conducted
            })

        mentee_data = []
        for m in mentorships:
            s = m.student
            stats = student_stats[s.id]
            ta = stats["ta"]
            tc = stats["tc"]
            perc = round((ta / tc * 100), 2) if tc > 0 else 100.0

            if perc < 75:
                status_label = "Defaulter"
            elif perc < 80:
                status_label = "At Risk"
            else:
                status_label = "Safe"

            mentee_data.append({
                "id": s.id,
                "roll_number": s.roll_number,
                "name": s.full_name,
                "semester": s.current_semester,
                "is_active": s.is_active,
                "ta": ta,
                "tc": tc,
                "percentage": perc,
                "status": status_label,
                "subject_marks": student_marks_map[s.id] # 🚨 Append marks data here
            })

        return Response({
            "has_mentees": True,
            "mentees": mentee_data
        })


class MenteeSubjectAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        student_id = request.GET.get('student_id')
        ay_id = request.GET.get('academic_year')
        user_profile = request.user.profile

        if not student_id or not ay_id:
            return Response({"error": "Student ID and Academic Year required"}, status=400)

        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        is_mentor = Mentorship.objects.filter(mentor=user_profile, student_id=student_id).exists()
        try:
            student = Student.objects.get(id=student_id)
            sem_map = {1: 'FE', 2: 'FE', 3: 'SE', 4: 'SE', 5: 'TE', 6: 'TE', 7: 'BE', 8: 'BE'}
            yl = sem_map.get(student.current_semester, '')
            is_class_teacher = ClassTeacher.objects.filter(
                faculty=user_profile, 
                department=student.department, 
                academic_year_id=ay_id, 
                year_level=yl
            ).exists()
        except Student.DoesNotExist:
            is_class_teacher = False

        if not (is_admin or is_mentor or is_class_teacher):
            return Response({"error": "Unauthorized."}, status=403)

        term = request.headers.get('X-Term', 'ODD')
        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

        records = AttendanceRecord.objects.filter(
            student_id=student_id,
            session__allocation__academic_year_id=ay_id,
            session__allocation__subject__semester__in=valid_sems
        ).select_related('session__allocation__subject', 'session__allocation__faculty__user')

        subject_stats = {}
        for r in records:
            sub_id = r.session.allocation.subject.id
            if sub_id not in subject_stats:
                subject_stats[sub_id] = {
                    "name": r.session.allocation.subject.name,
                    "code": r.session.allocation.subject.code,
                    "teacher": r.session.allocation.faculty.user.get_full_name() or "Unassigned",
                    "ta": 0, "tc": 0
                }

            subject_stats[sub_id]["tc"] += r.session.lecture_count
            if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'):
                subject_stats[sub_id]["ta"] += r.session.lecture_count

        results = []
        for stats in subject_stats.values():
            perc = round((stats["ta"] / stats["tc"] * 100), 2) if stats["tc"] > 0 else 100.0
            stats["percentage"] = perc
            results.append(stats)

        results.sort(key=lambda x: x['percentage'])

        return Response(results)
    
import calendar
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from core.models import Student, TeachingAllocation
from attendance.models import ClassSession, AttendanceRecord
from counselling.models import Mentorship

class MenteeParentCommunicationView(APIView):
    """
    Generates the WhatsApp communication report for a mentor's mentees.
    Calculates overall term attendance and a specifically requested month's attendance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        ay_id = request.GET.get('academic_year')
        term = request.GET.get('term', 'ODD').upper()
        
        # NEW: Get Target Month and Year from Frontend
        target_month_str = request.GET.get('month')
        target_year_str = request.GET.get('year')

        if not ay_id:
            return Response({"error": "Academic Year required"}, status=400)

        now = timezone.now()
        if target_month_str and target_year_str:
            try:
                current_month = int(target_month_str)
                current_year = int(target_year_str)
            except ValueError:
                current_month = now.month
                current_year = now.year
        else:
            current_month = now.month
            current_year = now.year

        current_month_name = f"{calendar.month_name[current_month]} {current_year}"

        mentee_ids = Mentorship.objects.filter(mentor__user=user).values_list('student_id', flat=True)
        students = Student.objects.filter(id__in=mentee_ids, is_active=True).select_related('mentee_profile')

        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]
        mentor_name = user.get_full_name().title() if user.get_full_name() else user.username.title()

        data = []
        for student in students:
            # --- EXTRACT ALL AVAILABLE CONTACTS ---
            profile = getattr(student, 'mentee_profile', None)
            contacts = []
            
            if profile:
                if profile.father_contact:
                    contacts.append({"type": "Father", "name": profile.father_name or "Father", "phone": profile.father_contact})
                if profile.mother_contact:
                    contacts.append({"type": "Mother", "name": profile.mother_name or "Mother", "phone": profile.mother_contact})
                if profile.guardian_contact:
                    contacts.append({"type": "Guardian", "name": profile.guardian_name or "Guardian", "phone": profile.guardian_contact})

            # --- Calculate Attendance ---
            allocations = TeachingAllocation.objects.filter(
                academic_year_id=ay_id,
                student_group__students=student,
                subject__semester__in=valid_sems
            )

            total_ta, total_tc = 0, 0
            month_ta, month_tc = 0, 0

            for alloc in allocations:
                sessions = ClassSession.objects.filter(allocation=alloc)
                month_sessions = sessions.filter(date__year=current_year, date__month=current_month)

                total_tc += sum(s.lecture_count for s in sessions)
                records = AttendanceRecord.objects.filter(session__in=sessions, student=student)
                total_ta += sum(r.session.lecture_count for r in records if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'))

                month_tc += sum(s.lecture_count for s in month_sessions)
                m_records = AttendanceRecord.objects.filter(session__in=month_sessions, student=student)
                month_ta += sum(r.session.lecture_count for r in m_records if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'))

            overall_perc = round((total_ta / total_tc * 100), 2) if total_tc > 0 else 100.0
            month_perc = round((month_ta / month_tc * 100), 2) if month_tc > 0 else 100.0
            formatted_student_name = student.full_name.title()

            # --- GENERATE THE WHATSAPP MESSAGE ---
            if overall_perc < 75:
                alert_text = "\u26A0\uFE0F *CRITICAL ALERT:*\nYour ward's overall attendance is falling below the mandatory *75%* university requirement. We kindly request you to advise them to attend classes regularly to avoid strict examination penalties.\n\n"
            else:
                alert_text = "\u2705 *Status:* Your ward is maintaining a satisfactory attendance record. Keep up the good work!\n\n"

            whatsapp_message = (
                "\U0001F3DB *EduSphere Academic Update*\n\n"
                "Dear Parent/Guardian,\n\n"
                "This is an official monthly attendance report for your ward:\n\n"
                f"\U0001F464 *Name:* {formatted_student_name}\n"
                f"*Roll No:* {student.roll_number}\n\n"
                "Here is their current academic standing:\n\n"
                f"\U0001F4CA *{current_month_name} Attendance:* {month_perc}% _({month_ta}/{month_tc} lectures)_\n"
                f"\U0001F4CB *Overall Term Attendance:* {overall_perc}%\n\n"
                f"{alert_text}"
                f"Warm Regards,\n"
                f"*Prof. {mentor_name}*\n"
                "_Academic Mentor_\n"
                "EduSphere Portal"
            )

            data.append({
                "id": student.id,
                "name": student.full_name,
                "roll_number": student.roll_number,
                "semester": student.current_semester,
                "contacts": contacts, # Sends the list of parents
                "current_month_name": current_month_name,
                "month_ta": month_ta,
                "month_tc": month_tc,
                "month_percentage": month_perc,
                "overall_percentage": overall_perc,
                "whatsapp_message": whatsapp_message
            })

        return Response(data)