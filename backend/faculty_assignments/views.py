from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from core.models import Student
from faculty_assignments.models import ClassTeacher
from counselling.models import Mentorship 
from .serializers import ClassTeacherSerializer

from attendance.models import AttendanceRecord

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

        # --- SMART TERM FILTERING ---
        term = request.headers.get('X-Term', 'ODD')
        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

        sem_map = {'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8]}
        sems = sem_map.get(ct.year_level, [])
        
        # Intersect the Year Level with the Term (e.g. SE + ODD = Semester 3)
        active_sems = list(set(sems) & set(valid_sems))

        students = Student.objects.filter(
            department=ct.department,
            current_semester__in=active_sems,
            is_active=True
        ).prefetch_related('mentorship__mentor__user').order_by('roll_number')

        # ONLY fetch attendance for subjects in the current term
        records = AttendanceRecord.objects.filter(
            student__in=students,
            session__allocation__academic_year_id=ay_id,
            session__allocation__subject__semester__in=valid_sems
        ).select_related('session')

        student_stats = {s.id: {"ta": 0, "tc": 0} for s in students}
        for r in records:
            if r.student_id in student_stats:
                student_stats[r.student_id]["tc"] += r.session.lecture_count
                if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'):
                    student_stats[r.student_id]["ta"] += r.session.lecture_count

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
                "mentor_name": mentor_name
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

        # Fetch aggregate attendance strictly for subjects in the current term
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
                "status": status_label
            })

        return Response({
            "has_mentees": True,
            "mentees": mentee_data
        })


class MenteeSubjectAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Drill down into a specific student's subjects (Used by Mentors and Class Teachers) """
        student_id = request.GET.get('student_id')
        ay_id = request.GET.get('academic_year')
        user_profile = request.user.profile

        if not student_id or not ay_id:
            return Response({"error": "Student ID and Academic Year required"}, status=400)

        # SECURITY CHECK
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
            return Response({"error": "Unauthorized. You are not the assigned mentor or class teacher for this student."}, status=403)

        # --- SMART TERM FILTERING ---
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