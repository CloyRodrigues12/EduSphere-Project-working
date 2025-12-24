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

    def get_reset_password_from_key_url(self, key):
        """
        AllAuth tries to generate a URL for the email context (password_reset_url).
        By default, it looks for a view named 'account_reset_password_from_key', which we don't have.
        
        We return a dummy or actual frontend URL here to prevent the NoReverseMatch error.
        (Our custom template uses 'uid' and 'token', so this specific return value isn't strictly used,
        but it MUST return a string to stop the crash).
        """
        return f"http://localhost:5173/password-reset/confirm/{key}"