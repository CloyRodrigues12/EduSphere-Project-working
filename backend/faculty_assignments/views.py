from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from core.models import Student
from .models import ClassTeacher, Mentorship
from .serializers import ClassTeacherSerializer

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
        division = request.data.get('division', '') # <-- Made optional
        
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


class MentorSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Returns Faculty Cards grouped with their Mentees """
        user_profile = request.user.profile
        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            mentorships = Mentorship.objects.filter(student__organization=user_profile.organization).select_related('mentor__user', 'student')
        else:
            mentorships = Mentorship.objects.filter(student__department=user_profile.department).select_related('mentor__user', 'student')
            
        summary = {}
        for m in mentorships:
            mid = m.mentor.id
            pic = m.mentor.profile_picture.url if m.mentor.profile_picture else None 
            
            if mid not in summary:
                summary[mid] = {
                    "mentor_id": mid,
                    "mentor_name": m.mentor.user.get_full_name() or m.mentor.user.username,
                    "profile_picture": pic,
                    "mentees": []
                }
            summary[mid]["mentees"].append({
                "id": m.student.id,
                "name": m.student.full_name,
                "roll_number": m.student.roll_number,
                "semester": m.student.current_semester,
                "is_active": m.student.is_active, # <-- NEW: Pass active status
            })
        
        return Response(list(summary.values()))

class MentorStudentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Returns all students to populate the Assign Mentees Modal """
        user_profile = request.user.profile
        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            students = Student.objects.filter(organization=user_profile.organization, is_active=True).prefetch_related('mentorship')
        else:
            students = Student.objects.filter(department=user_profile.department, is_active=True).prefetch_related('mentorship')
            
        data = []
        for s in students:
            mentor_name = "Unassigned"
            mentorship = s.mentorship.first()
            if mentorship:
                mentor_name = mentorship.mentor.user.get_full_name() or mentorship.mentor.user.username
                
            data.append({
                "id": s.id,
                "full_name": s.full_name,
                "roll_number": s.roll_number,
                "semester": s.current_semester,
                "mentor_name": mentor_name
            })
        return Response(data)

    def post(self, request):
        """ Bulk Assign Mentors """
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
        
        student_ids = request.data.get('student_ids', [])
        mentor_id = request.data.get('mentor_id')

        if not student_ids or not mentor_id:
            return Response({"error": "Missing parameters"}, status=400)

        with transaction.atomic():
            for sid in student_ids:
                Mentorship.objects.update_or_create(
                    student_id=sid,
                    defaults={'mentor_id': mentor_id}
                )

        return Response({"message": "Mentors assigned successfully."})

    def delete(self, request):
        """ Safely Remove a Mentee """
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        student_id = request.GET.get('student_id')
        if not student_id:
            return Response({"error": "Student ID is required"}, status=400)
            
        try:
            mentorship = Mentorship.objects.get(student_id=student_id)
            if user_profile.role == 'HOD' and mentorship.student.department != user_profile.department:
                return Response({"error": "Cannot remove mentee outside your department"}, status=403)
                
            mentorship.delete()
            return Response({"message": "Mentee removed successfully."})
        except Mentorship.DoesNotExist:
            return Response({"error": "Mentorship not found."}, status=404)
        
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
            
            # Security: HOD can only view students from their own department
            if not is_org_admin and ct.department != user_profile.department:
                return Response({"error": "Unauthorized to view this class's students."}, status=403)

            # Map the year level to actual semesters
            sem_map = {'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8]}
            sems = sem_map.get(ct.year_level, [])
            
            # Fetch the students!
            students = Student.objects.filter(
                department=ct.department,
                current_semester__in=sems,
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