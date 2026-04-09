# backend/results/serializers.py
from rest_framework import serializers
from .models import InternalAssessment

class InternalAssessmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)

    class Meta:
        model = InternalAssessment
        fields = ['id', 'student', 'student_name', 'roll_number', 'it1', 'it2', 'it3', 'final_score', 'is_passing']