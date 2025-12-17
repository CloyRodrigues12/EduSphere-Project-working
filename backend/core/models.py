# backend/core/models.py

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# --- 1. The SaaS Hierarchy ---

class Organization(models.Model):
    """
    The top-level entity (e.g., 'St. Xavier's Trust').
    Created during the Setup Wizard.
    """
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Department(models.Model):
    """
    Sub-divisions (e.g., 'Computer Engineering', 'Accounts').
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=100)
    
    # Configuration for this department (e.g., specific Excel format)
    config = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.name} - {self.organization.name}"

# --- 2. The User Profile (The Glue) ---

class UserProfile(models.Model):
    """
    Extends the standard Django User to add SaaS roles.
    """
    ROLE_CHOICES = [
        ('SUPER_ADMIN', 'Super Admin'),
        ('ORG_ADMIN', 'Organization Admin'), 
        ('STAFF', 'Staff/Teacher'), 
        ('STUDENT', 'Student'), 
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    # Links to the SaaS Tenant
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STAFF')
    
    # Setup Flags & Permissions
    is_setup_complete = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    permissions = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

# --- 3. Signals (ROBUST VERSION) ---

@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    """
    This signal runs every time a User is saved.
    It ensures a UserProfile ALWAYS exists, fixing 'Zombie Users'.
    """
    # Check if the user has a profile safely
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        # If profile is missing (Zombie User), create it now!
        UserProfile.objects.create(user=instance)