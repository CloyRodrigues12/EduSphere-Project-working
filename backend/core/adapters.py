# backend/core/adapters.py
from allauth.account.adapter import DefaultAccountAdapter
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator

class CustomAccountAdapter(DefaultAccountAdapter):
    def render_mail(self, template_prefix, email, context):
        """
        Injects 'uid' and 'token' into the email context so that
        our React Frontend link works with AllAuth.
        """
        user = context.get('user')
        if user:
            context['uid'] = urlsafe_base64_encode(force_bytes(user.pk))
            context['token'] = default_token_generator.make_token(user)
            
        return super().render_mail(template_prefix, email, context)