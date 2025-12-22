from rest_framework import serializers
from dj_rest_auth.serializers import UserDetailsSerializer
from core.models import UserProfile
from dj_rest_auth.serializers import PasswordResetSerializer

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
    Custom serializer to send HTML email for password reset.
    """
    def save(self):
        request = self.context.get('request')
        # Configure the form to use our custom template
        opts = {
            'use_https': request.is_secure(),
            'from_email': None, 
            'request': request,
            'email_template_name': 'registration/password_reset_email.html',
            'html_email_template_name': 'registration/password_reset_email.html', # <--- IMPORTANT
        }
        self.reset_form.save(**opts)