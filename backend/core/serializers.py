from rest_framework import serializers
from dj_rest_auth.serializers import UserDetailsSerializer
from core.models import UserProfile
from dj_rest_auth.serializers import PasswordResetSerializer
from django.contrib.auth.forms import PasswordResetForm
from allauth.account.forms import ResetPasswordForm as AllAuthPasswordResetForm

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


class CustomPasswordResetSerializer(PasswordResetSerializer):
    """
    Forces dj-rest-auth to use the AllAuth Password Reset Form.
    This ensures our 'CustomAccountAdapter' is called to inject 'uid' and 'token'.
    """
    @property
    def password_reset_form_class(self):
        return AllAuthPasswordResetForm