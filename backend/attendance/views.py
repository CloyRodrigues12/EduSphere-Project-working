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
            # Global Calendar Logic: Fetch ALL sessions
            if user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']:
                sessions = ClassSession.objects.all().order_by('-date', '-updated_at')
            else:
                sessions = ClassSession.objects.filter(allocation__faculty=user_profile).order_by('-date', '-updated_at')
                
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