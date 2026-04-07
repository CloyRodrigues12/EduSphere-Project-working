from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from core.models import Student
from .models import Mentorship

class MentorSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        # --- FIXED: Added HOD to the allowed roles ---
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'COUNSELLOR', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        # --- FIXED: Apply Department Sandboxing for HODs ---
        if user_profile.role == 'HOD':
             mentorships = Mentorship.objects.filter(
                student__department=user_profile.department
            ).select_related('mentor__user', 'mentor__department', 'student')
        else:
            mentorships = Mentorship.objects.filter(
                student__organization=user_profile.organization
            ).select_related('mentor__user', 'mentor__department', 'student')
            
        summary = {}
        for m in mentorships:
            mid = m.mentor.id
            pic = m.mentor.profile_picture.url if m.mentor.profile_picture else None 
            
            if mid not in summary:
                summary[mid] = {
                    "mentor_id": mid,
                    "mentor_name": m.mentor.user.get_full_name() or m.mentor.user.username,
                    "mentor_department_id": m.mentor.department.id if m.mentor.department else None,
                    "profile_picture": pic,
                    "mentees": []
                }
            summary[mid]["mentees"].append({
                "id": m.student.id,
                "name": m.student.full_name,
                "roll_number": m.student.roll_number,
                "semester": m.student.current_semester,
                "is_active": m.student.is_active, 
            })
        
        return Response(list(summary.values()))

class MentorStudentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        # --- FIXED: Added HOD to the allowed roles ---
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'COUNSELLOR', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        # --- FIXED: Apply Department Sandboxing for HODs ---
        if user_profile.role == 'HOD':
            students = Student.objects.filter(
                department=user_profile.department, 
                is_active=True
            ).select_related('department').prefetch_related('mentorship__mentor__user')
        else:
            students = Student.objects.filter(
                organization=user_profile.organization, 
                is_active=True
            ).select_related('department').prefetch_related('mentorship__mentor__user')
            
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
                "department_id": s.department.id if s.department else None,
                "mentor_name": mentor_name
            })
        return Response(data)

    def post(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'COUNSELLOR']:
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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'COUNSELLOR']:
            return Response({"error": "Permission denied"}, status=403)
            
        student_id = request.GET.get('student_id')
        if not student_id:
            return Response({"error": "Student ID is required"}, status=400)
            
        try:
            mentorship = Mentorship.objects.get(student_id=student_id)
            mentorship.delete()
            return Response({"message": "Mentee removed successfully."})
        except Mentorship.DoesNotExist:
            return Response({"error": "Mentorship not found."}, status=404)