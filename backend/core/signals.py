from django.dispatch import receiver
from allauth.account.signals import user_signed_up
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings

@receiver(user_signed_up)
def send_welcome_email(request, user, **kwargs):
    """
    Sends a styled welcome email immediately after a user signs up.
    """
    subject = "Welcome to EduSphere! 🚀"
    from_email = settings.EMAIL_HOST_USER
    to_email = [user.email]

    # Load the HTML template
    html_content = render_to_string('emails/welcome_email.html', {'user': user})
    
    # Create the email
    msg = EmailMultiAlternatives(subject, "Welcome to EduSphere!", from_email, to_email)
    msg.attach_alternative(html_content, "text/html")
    
    try:
        msg.send()
        print(f"✅ Welcome email sent to {user.email}")
    except Exception as e:
        print(f"❌ Failed to send welcome email: {e}")