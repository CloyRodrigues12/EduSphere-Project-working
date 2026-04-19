from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions,viewsets
from django.db import transaction
from core.models import Student
from .models import Mentorship
from django.db.models import Q
from .serializers import MenteeRegistrationFormSerializer
import pandas as pd
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from core.models import Student
from .models import MenteeProfile
from .serializers import MenteeRegistrationFormSerializer

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
        
        

class MenteeProfileViewSet(viewsets.ModelViewSet):
    """
    API endpoint for viewing and editing the digitized Mentee Registration Forms.
    """
    serializer_class = MenteeRegistrationFormSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'post']

    def get_queryset(self):
        user = self.request.user
        user_profile = user.profile
        
        qs = Student.objects.filter(
            organization=user_profile.organization, 
            is_active=True
        ).select_related('mentee_profile', 'department', 'user')

        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN', 'COUNSELLOR']:
            return qs
        elif user_profile.role == 'HOD':
            return qs.filter(department=user_profile.department)
        elif getattr(user_profile, 'is_teaching_faculty', False):
            from .models import Mentorship
            mentee_ids = Mentorship.objects.filter(
                mentor__user=user, status='ACTIVE'
            ).values_list('student_id', flat=True)
            return qs.filter(id__in=mentee_ids)
        elif user_profile.role_code == 'STUDENT':
            return qs.filter(user=user)
            
        return Student.objects.none()

    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            if file.name.endswith('.csv'):
                df = pd.read_csv(file)
            else:
                df = pd.read_excel(file)
            
            df.columns = df.columns.str.strip().str.upper()
            
            if 'ROLL NO' not in df.columns:
                return Response({"error": "The uploaded file is missing the 'ROLL NO' column."}, status=status.HTTP_400_BAD_REQUEST)
            
            updated_count = 0
            errors = []
            
            field_map = {
                'ADDRESS': 'address', 'PIN CODE': 'pin_code', 'MENTEE CONTACT': 'contact_number',
                'FATHER NAME': 'father_name', 'FATHER OCCUPATION': 'father_occupation', 'FATHER CONTACT': 'father_contact',
                'MOTHER NAME': 'mother_name', 'MOTHER OCCUPATION': 'mother_occupation', 'MOTHER CONTACT': 'mother_contact',
                'GUARDIAN NAME': 'guardian_name', 'GUARDIAN CONTACT': 'guardian_contact',
                'HOBBIES': 'hobbies', 'ACHIEVEMENTS': 'achievements'
            }
            
            for index, row in df.iterrows():
                roll_no = str(row.get('ROLL NO', '')).strip()
                if not roll_no or str(roll_no).lower() == 'nan':
                    continue
                    
                try:
                    student = self.get_queryset().get(roll_number=roll_no)
                except Student.DoesNotExist:
                    errors.append(f"Row {index+2}: Student with Roll No '{roll_no}' not found or no permission.")
                    continue
                
                # Fetch or create the profile
                profile, created = MenteeProfile.objects.get_or_create(student=student)
                profile_was_updated = False
                
                # Iterate strictly through mapped columns
                for excel_col, db_field in field_map.items():
                    if excel_col in df.columns:
                        raw_val = row.get(excel_col)
                        
                        # Check if the cell actually has data (ignore NaNs and empty strings)
                        if pd.notna(raw_val) and str(raw_val).strip().lower() != 'nan':
                            clean_val = str(raw_val).strip()
                            
                            # FIX 1: Remove the accidental .0 added by pandas for numeric columns
                            if clean_val.endswith('.0'):
                                clean_val = clean_val[:-2]
                                
                            # FIX 2: Only overwrite the DB if the Excel cell is NOT empty
                            if clean_val:
                                setattr(profile, db_field, clean_val)
                                profile_was_updated = True
                
                # Only save if we actually altered a field or just created the profile
                if profile_was_updated or created:
                    profile.save()
                    updated_count += 1
                
            return Response({
                "message": f"Successfully updated {updated_count} profiles.",
                "errors": errors
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": f"Failed to process file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        
        


class MyDetailedMenteesView(APIView):
    """
    Dedicated endpoint for a faculty member to fetch the full 
    digitized Registration Forms for ONLY their assigned mentees.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # 1. Find all student IDs assigned to this specific user
        mentee_ids = Mentorship.objects.filter(
            mentor__user=user
        ).values_list('student_id', flat=True)
        
        # 2. Fetch those students with their profiles and core info
        students = Student.objects.filter(
            id__in=mentee_ids,
            is_active=True
        ).select_related('mentee_profile', 'department', 'user')
        
        # 3. Serialize using the updated serializer (now with enrollment_number)
        serializer = MenteeRegistrationFormSerializer(students, many=True)
        return Response(serializer.data)