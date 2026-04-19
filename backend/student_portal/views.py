from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from core.models import Student, TeachingAllocation, Course, UserProfile
from attendance.models import ClassSession, AttendanceRecord
from faculty_assignments.models import ClassTeacher
from counselling.models import Mentorship 
from results.models import InternalAssessment
from django.db.models import Q
from core.models import Student
from counselling.serializers import MenteeRegistrationFormSerializer



class MyStudentDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        if user_profile.role != 'STUDENT':
            return Response({"error": "Unauthorized"}, status=403)

        academic_year_id = request.GET.get('academic_year_id')
        term = request.GET.get('term', request.headers.get('X-Term', 'ODD')).upper()
        
        if not academic_year_id:
            return Response({"error": "Academic Year required"}, status=400)

        try:
            student = Student.objects.get(user=request.user)
            
            sem_map = {1: 'FE', 2: 'FE', 3: 'SE', 4: 'SE', 5: 'TE', 6: 'TE', 7: 'BE', 8: 'BE'}
            yl = sem_map.get(student.current_semester, 'FE')
            
            ct = ClassTeacher.objects.filter(
                academic_year_id=academic_year_id,
                department=student.department,
                year_level=yl
            ).select_related('faculty__user').first()
            
            mentor_rel = Mentorship.objects.filter(student=student).select_related('mentor__user').first()

            allocations = TeachingAllocation.objects.filter(
                academic_year_id=academic_year_id,
                student_group__students=student
            ).select_related('subject', 'faculty__user').distinct()

            subject_stats = []
            total_ta = 0
            total_tc = 0
            
            valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]

            for alloc in allocations:
                if alloc.subject.semester not in valid_sems:
                    continue 
                    
                sessions = ClassSession.objects.filter(allocation=alloc)
                tc = sum(s.lecture_count for s in sessions)
                
                records = AttendanceRecord.objects.filter(
                    session__in=sessions,
                    student=student
                )
                ta = sum(r.session.lecture_count for r in records if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'))
                
                perc = round((ta / tc * 100), 2) if tc > 0 else 100.0
                
                subject_stats.append({
                    "subject_name": alloc.subject.name,
                    "subject_code": alloc.subject.code,
                    "faculty_name": alloc.faculty.user.get_full_name() if alloc.faculty else "Unassigned",
                    "ta": ta,
                    "tc": tc,
                    "percentage": perc
                })
                
                total_ta += ta
                total_tc += tc

            overall_percentage = round((total_ta / total_tc * 100), 2) if total_tc > 0 else 100.0
            
            # 🚨 FETCH INTERNAL MARKS WITH RANK CALCULATION
            assessments = InternalAssessment.objects.filter(
                student=student,
                academic_year_id=academic_year_id,
                term=term
            ).select_related('subject')
            
            marks_data = []
            for a in assessments:
                conducted = sum(1 for m in [a.it1, a.it2, a.it3] if m is not None)
                
                # 🚨 Calculate the exact Class Rank for this specific subject
                rank = "-"
                if a.final_score is not None:
                    higher_scores = InternalAssessment.objects.filter(
                        subject=a.subject,
                        academic_year_id=academic_year_id,
                        term=term,
                        final_score__gt=a.final_score
                    ).count()
                    rank = higher_scores + 1

                marks_data.append({
                    "subject_name": a.subject.name,
                    "subject_code": a.subject.code,
                    "it1": a.it1,
                    "it2": a.it2,
                    "it3": a.it3,
                    "final_score": a.final_score,
                    "is_passing": a.is_passing,
                    "conducted": conducted,
                    "rank": rank # Passed to the frontend!
                })

            return Response({
                "student_info": {
                    "name": student.full_name,
                    "roll_number": student.roll_number,
                    "enrollment_number": student.enrollment_number,
                    "department": student.department.name,
                    "semester": student.current_semester
                },
                "support_system": {
                    "class_teacher": ct.faculty.user.get_full_name() if ct and ct.faculty else "Not Assigned",
                    "mentor": mentor_rel.mentor.user.get_full_name() if mentor_rel and mentor_rel.mentor else "Not Assigned"
                },
                "overall_attendance": {
                    "ta": total_ta,
                    "tc": total_tc,
                    "percentage": overall_percentage,
                    "status": "Defaulter" if overall_percentage < 75 else "At Risk" if overall_percentage < 80 else "Safe"
                },
                "attendance_subjects": subject_stats,
                "marks_subjects": marks_data
            })

        except Student.DoesNotExist:
            return Response({"error": "Student record not found"}, status=404)
        
    

class StudentProfileView(APIView):
    """
    Dedicated endpoint for a student to view their own comprehensive profile
    (Core data + Mentee Registration Details).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            # Safely fetch the student profile linked to the logged-in user
            student = Student.objects.select_related('mentee_profile', 'department', 'user').get(user=request.user)
            serializer = MenteeRegistrationFormSerializer(student)
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"error": "Student profile not found."}, status=404)