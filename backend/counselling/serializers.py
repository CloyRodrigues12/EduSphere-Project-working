
from rest_framework import serializers
from .models import Mentorship, MenteeProfile
from core.models import Student
from core.serializers import StudentSerializer

class MentorshipSerializer(serializers.ModelSerializer):
    mentor_name = serializers.CharField(source='mentor.user.get_full_name', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_roll = serializers.CharField(source='student.roll_number', read_only=True)
    student_semester = serializers.IntegerField(source='student.current_semester', read_only=True)

    class Meta:
        model = Mentorship
        fields = ['id', 'mentor', 'mentor_name', 'student', 'student_name', 'student_roll', 'student_semester', 'created_at']
        


class MenteeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenteeProfile
        fields = [
            'id', 'address', 'pin_code', 'contact_number',
            'father_name', 'father_occupation', 'father_contact',
            'mother_name', 'mother_occupation', 'mother_contact',
            'guardian_name', 'guardian_contact',
            'hobbies', 'achievements', 'updated_at'
        ]

class MenteeRegistrationFormSerializer(serializers.ModelSerializer):
    """
    Composite Serializer: Combines core Student data with their Counselling Profile.
    This serves the complete digitized 'Mentee Registration Form' to the frontend.
    """
    # Nested profile data (Read & Write)
    profile = MenteeProfileSerializer(source='mentee_profile', required=False)
    
    # Read-only core fields mapped for the UI
    department_name = serializers.CharField(source='department.name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = Student
        fields = [
            'id', 'roll_number', 'full_name', 'gender', 'dob', 
            'current_semester', 'department_name', 'email', 'profile'
        ]
        read_only_fields = [
            'id', 'roll_number', 'full_name', 'gender', 'dob', 
            'current_semester', 'department_name', 'email'
        ]

    def update(self, instance, validated_data):
        """ Custom update method to handle the nested profile saving """
        profile_data = validated_data.pop('mentee_profile', None)
        
        # We don't update the core Student here (that's handled in ECS/Directory)
        
        if profile_data:
            # Get or Create the MenteeProfile
            profile, created = MenteeProfile.objects.get_or_create(student=instance)
            
            # Update the profile fields
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
            
        return instance