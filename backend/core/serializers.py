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

class CustomPasswordResetSerializer(PasswordResetSerializer):
    # 2. Force the serializer to use the Standard Django Form (which supports your custom templates)
    #    instead of the AllAuth form (which ignores them).
    @property
    def password_reset_form_class(self):
        return PasswordResetForm

    def save(self):
        print("--------------------------------------------------")
        print("🔥 DEBUG: CUSTOM SERIALIZER IS RUNNING!")
        print("--------------------------------------------------")
        
        request = self.context.get('request')
        opts = {
            'use_https': request.is_secure(),
            'from_email': None, 
            'request': request,
            # 3. For the Plain Text email, use the default Django one (or create a .txt file).
            #    Do NOT use your .html file here, or the user will see raw HTML code.
            'email_template_name': 'registration/password_reset_email.html', 
            
            # 4. YOUR CUSTOM HTML TEMPLATE
            'html_email_template_name': 'emails/password_reset_email.html',
        }
        # Now this will respect the 'html_email_template_name' argument
        self.reset_form.save(**opts)