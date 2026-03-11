from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from core.models import Student, TeachingAllocation, Course, UserProfile
from attendance.models import ClassSession, AttendanceRecord
from faculty_assignments.models import ClassTeacher, Mentorship
from django.db.models import Q

class MyStudentDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        if user_profile.role != 'STUDENT':
            return Response({"error": "Unauthorized"}, status=403)

        academic_year_id = request.GET.get('academic_year_id')
        if not academic_year_id:
            return Response({"error": "Academic Year required"}, status=400)

        try:
            # 1. Identity Injection: Get the exact student linked to this user
            student = Student.objects.get(user=request.user)
            
            # 2. Get Support System (Class Teacher & Mentor)
            sem_map = {1: 'FE', 2: 'FE', 3: 'SE', 4: 'SE', 5: 'TE', 6: 'TE', 7: 'BE', 8: 'BE'}
            yl = sem_map.get(student.current_semester, 'FE')
            
            ct = ClassTeacher.objects.filter(
                academic_year_id=academic_year_id,
                department=student.department,
                year_level=yl
            ).select_related('faculty__user').first()
            
            mentor_rel = Mentorship.objects.filter(student=student).select_related('mentor__user').first()

            # 3. Calculate Accurate Subject-wise Attendance
            # Find all allocations the student belongs to (via their StudentGroups)
            allocations = TeachingAllocation.objects.filter(
                academic_year_id=academic_year_id,
                student_group__students=student
            ).select_related('subject', 'faculty__user')

            subject_stats = []
            total_ta = 0
            total_tc = 0

            for alloc in allocations:
                sessions = ClassSession.objects.filter(allocation=alloc)
                tc = sum(s.lecture_count for s in sessions)
                
                # Fetch only this student's records for these sessions
                records = AttendanceRecord.objects.filter(
                    session__in=sessions,
                    student=student
                )
                ta = sum(r.session.lecture_count for r in records if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'))
                
                perc = round((ta / tc * 100), 2) if tc > 0 else 100.0
                
                subject_stats.append({
                    "subject_name": alloc.subject.name,
                    "subject_code": alloc.subject.code,
                    "faculty_name": alloc.faculty.user.get_full_name(),
                    "ta": ta,
                    "tc": tc,
                    "percentage": perc
                })
                
                total_ta += ta
                total_tc += tc

            overall_percentage = round((total_ta / total_tc * 100), 2) if total_tc > 0 else 100.0

            return Response({
                "student_info": {
                    "name": student.full_name,
                    "roll_number": student.roll_number,
                    "department": student.department.name,
                    "semester": student.current_semester
                },
                "support_system": {
                    "class_teacher": ct.faculty.user.get_full_name() if ct else "Not Assigned",
                    "mentor": mentor_rel.mentor.user.get_full_name() if mentor_rel else "Not Assigned"
                },
                "overall_attendance": {
                    "ta": total_ta,
                    "tc": total_tc,
                    "percentage": overall_percentage,
                    "status": "Defaulter" if overall_percentage < 75 else "At Risk" if overall_percentage < 80 else "Safe"
                },
                "subjects": subject_stats
            })

        except Student.DoesNotExist:
            return Response({"error": "Student record not found"}, status=404)