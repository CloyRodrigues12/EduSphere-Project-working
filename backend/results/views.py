from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.models import Student, TeachingAllocation
from .models import InternalAssessment
from .serializers import InternalAssessmentSerializer

class InternalAssessmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        ay_id = request.GET.get("academic_year")
        term = request.GET.get("term", "ODD").upper()
        
        odd_sems = [1, 3, 5, 7]
        even_sems = [2, 4, 6, 8]
        target_sems = odd_sems if term == 'ODD' else even_sems

        allocations = TeachingAllocation.objects.filter(
            academic_year_id=ay_id,
            subject__semester__in=target_sems
        ).exclude(
            subject__subject_type='LAB'
        ).select_related('subject', 'faculty__user', 'student_group')

        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            allocations = allocations.filter(faculty__organization=user_profile.organization)
        elif user_profile.role == 'HOD':
            allocations = allocations.filter(faculty__department=user_profile.department)
        elif user_profile.role == 'FACULTY':
            allocations = allocations.filter(faculty=user_profile)
        else:
            return Response({"error": "Unauthorized role"}, status=403)

        data = [{
            "id": a.id,
            "subject_name": a.subject.name,
            "subject_code": a.subject.code,
            "semester": a.subject.semester,
            "group_name": a.student_group.name if a.student_group else "General",
            "faculty_name": a.faculty.user.get_full_name() if a.faculty else "Unassigned"
        } for a in allocations]

        return Response(data)

class InternalMarksheetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allocation_id = request.query_params.get('allocation_id')
        term = request.query_params.get('term', 'ODD').upper()
        
        try:
            allocation = TeachingAllocation.objects.select_related('student_group', 'subject', 'academic_year').get(id=allocation_id)
            students = Student.objects.filter(studentgroup=allocation.student_group, is_active=True).distinct()

            data = []
            for student in students:
                record, _ = InternalAssessment.objects.get_or_create(
                    student=student, subject=allocation.subject, academic_year=allocation.academic_year, term=term
                )
                data.append(InternalAssessmentSerializer(record).data)
            return Response(data)
        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Allocation not found"}, status=404)

class SaveInternalMarksView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        allocation_id = request.data.get('allocation_id')
        term = request.data.get('term', 'ODD').upper()
        marks_list = request.data.get('marks', [])

        try:
            allocation = TeachingAllocation.objects.get(id=allocation_id)
            
            def clean_mark(val):
                if val in ["", "null", None]:
                    return None
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None

            for item in marks_list:
                s_id = item.get('student') or item.get('student_id')
                if not s_id: 
                    continue
                    
                # 🚨 FIX: We now explicitly grab the final_score calculated by React
                InternalAssessment.objects.update_or_create(
                    student_id=s_id,
                    subject=allocation.subject,
                    academic_year=allocation.academic_year,
                    term=term,
                    defaults={
                        'it1': clean_mark(item.get('it1')),
                        'it2': clean_mark(item.get('it2')),
                        'it3': clean_mark(item.get('it3')),
                        'final_score': float(item.get('final_score', 0.0)), # Grabs React's math
                        'is_passing': bool(item.get('is_passing', False))   # Grabs React's math
                    }
                )
            return Response({"message": "Marks updated successfully!"})
        except Exception as e:
            print("SAVE MARKS ERROR:", str(e)) 
            return Response({"error": str(e)}, status=500)