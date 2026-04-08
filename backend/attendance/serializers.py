from rest_framework import serializers
from .models import ClassSession, AttendanceRecord, DutyLeaveRequest, DutyLeaveParticipant

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    
    class Meta:
        model = AttendanceRecord
        fields = ['id', 'student', 'student_name', 'roll_number', 'status', 'remarks']

class ClassSessionSerializer(serializers.ModelSerializer):
    # Nests the roll call grid inside the session automatically
    records = AttendanceRecordSerializer(many=True, read_only=True)
    subject_name = serializers.CharField(source='allocation.subject.name', read_only=True)
    group_name = serializers.CharField(source='allocation.student_group.name', read_only=True)

    class Meta:
        model = ClassSession
        fields = [
            'id', 'allocation', 'date', 'lecture_count', 
            'is_extra_class', 'topics_covered', 
            'subject_name', 'group_name', 'records','updated_at'
        ]
        



# ==========================================
# NEW: DUTY LEAVE SERIALIZERS
# ==========================================

class DutyLeaveParticipantSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    department = serializers.CharField(source='student.department.name', read_only=True)
    semester = serializers.IntegerField(source='student.current_semester', read_only=True)

    class Meta:
        model = DutyLeaveParticipant
        fields = [
            'id', 'student', 'student_name', 'roll_number', 'department', 'semester',
            'class_teacher_status', 'hod_status', 'final_status'
        ]

class DutyLeaveRequestSerializer(serializers.ModelSerializer):
    participants = DutyLeaveParticipantSerializer(many=True, read_only=True)
    initiator_name = serializers.CharField(source='initiator.user.get_full_name', read_only=True)
    event_in_charge_name = serializers.CharField(source='event_in_charge.user.get_full_name', read_only=True)

    class Meta:
        model = DutyLeaveRequest
        fields = [
            'id', 'title', 'reason', 'initiator', 'initiator_name', 
            'event_in_charge', 'event_in_charge_name', 
            'start_date', 'end_date', 'in_charge_status', 
            'created_at', 'participants'
        ]