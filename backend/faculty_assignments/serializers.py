from rest_framework import serializers
from core.models import Student
from .models import ClassTeacher
from counselling.models import Mentorship

class ClassTeacherSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.user.get_full_name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassTeacher
        fields = ['id', 'faculty', 'faculty_name', 'department', 'department_code', 'academic_year', 'year_level', 'division', 'student_count']

    def get_student_count(self, obj):
        # Map the year level string to actual semesters
        sem_map = {'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8]}
        sems = sem_map.get(obj.year_level, [])
        
        # Count all active students in this department for these semesters
        return Student.objects.filter(
            department=obj.department,
            current_semester__in=sems,
            is_active=True
        ).count()


class MentorshipSerializer(serializers.ModelSerializer):
    mentor_name = serializers.CharField(source='mentor.user.get_full_name', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_roll = serializers.CharField(source='student.roll_number', read_only=True)

    class Meta:
        model = Mentorship
        fields = ['id', 'mentor', 'mentor_name', 'student', 'student_name', 'student_roll']