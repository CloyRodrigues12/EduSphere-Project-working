from rest_framework import serializers
from dj_rest_auth.serializers import UserDetailsSerializer
from core.models import UserProfile
from dj_rest_auth.serializers import PasswordResetSerializer
from django.contrib.auth.forms import PasswordResetForm

class CustomUserDetailsSerializer(UserDetailsSerializer):
    """
    Extends the default user data to include SaaS-specific fields.
    """
    role = serializers.CharField(source="profile.role", read_only=True)
    organization_name = serializers.CharField(source="profile.organization.name", read_only=True, allow_null=True)
    is_setup_complete = serializers.BooleanField(source="profile.is_setup_complete", read_only=True)
    permissions = serializers.JSONField(source="profile.permissions", read_only=True)

    class Meta(UserDetailsSerializer.Meta):
        fields = UserDetailsSerializer.Meta.fields + (
            'role', 'organization_name', 'is_setup_complete', 'permissions'
        )

# backend/core/serializers.py
from dj_rest_auth.serializers import PasswordResetSerializer

class CustomPasswordResetSerializer(PasswordResetSerializer):
    """
    Serializer is now empty because we want to use the default 
    AllAuth behavior (which handles Social Users correctly).
    We will handle the Template and Variables via an Adapter.
    """
    pass