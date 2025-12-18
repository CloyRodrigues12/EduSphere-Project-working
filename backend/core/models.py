# backend/core/models.py

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# --- 1. The SaaS Hierarchy ---

class Organization(models.Model):
    """
    The top-level entity (e.g., 'St. Xavier's Trust').
    """
    TYPE_CHOICES = [
        ('School', 'School'),
        ('College', 'College'),
        ('University', 'University'),
        ('Coaching', 'Coaching'),
    ]

    name = models.CharField(max_length=255)
    # NEW FIELD: Store the type (School, College, etc.)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='School') 
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.type})"

class Department(models.Model):
    """
    Sub-divisions (e.g., 'Computer Engineering', 'Accounts').
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=100)
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
    
    # NEW FIELD: Store the specific job title (Principal, HOD, etc.)
    designation = models.CharField(max_length=100, blank=True, null=True) 
    
    # Setup Flags & Permissions
    is_setup_complete = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    permissions = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

# --- 3. Signals ---

@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        UserProfile.objects.create(user=instance)