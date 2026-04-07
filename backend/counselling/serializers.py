from rest_framework import serializers
from .models import Mentorship

class MentorshipSerializer(serializers.ModelSerializer):
    mentor_name = serializers.CharField(source='mentor.user.get_full_name', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_roll = serializers.CharField(source='student.roll_number', read_only=True)
    student_semester = serializers.IntegerField(source='student.current_semester', read_only=True)

    class Meta:
        model = Mentorship
        fields = ['id', 'mentor', 'mentor_name', 'student', 'student_name', 'student_roll', 'student_semester', 'created_at']