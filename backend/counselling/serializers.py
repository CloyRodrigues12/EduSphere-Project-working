from rest_framework import serializers
from .models import Mentorship, MenteeProfile
from core.models import Student
from core.serializers import StudentSerializer

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
    profile = MenteeProfileSerializer(source='mentee_profile', required=False)
    department_name = serializers.CharField(source='department.name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = Student
        fields = [
            'id', 'enrollment_number', 'roll_number', 'full_name', 'gender', 'dob', 
            'current_semester', 'department_name', 'email', 'profile',
            # --- NEW MISSING FIELDS ADDED HERE ---
            'mobile_number', 'aic_id', 'aadhar_number', 'name_on_aadhar', 'remarks'
        ]
        read_only_fields = [
            'id', 'enrollment_number', 'roll_number', 'full_name', 'gender', 'dob', 
            'current_semester', 'department_name', 'email',
            # --- NEW MISSING FIELDS ADDED HERE ---
            'mobile_number', 'aic_id', 'aadhar_number', 'name_on_aadhar', 'remarks'
        ]

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('mentee_profile', None)
        
        if profile_data:
            profile, created = MenteeProfile.objects.get_or_create(student=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
            
        return instance