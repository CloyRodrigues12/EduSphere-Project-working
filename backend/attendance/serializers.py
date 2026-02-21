from rest_framework import serializers
from .models import ClassSession, AttendanceRecord

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