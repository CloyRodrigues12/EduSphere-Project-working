from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
import random
from django.utils import timezone
from datetime import timedelta

# ==========================================
# 1. THE STRUCTURE (Space)
# ==========================================

class Organization(models.Model):
    """ The College/Institute """
    TYPE_CHOICES = [
        ('School', 'School'),
        ('College', 'College'),
        ('University', 'University'),
    ]
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES, default='College')
    address = models.TextField(blank=True, null=True)
    # Enforced domain for auto-generating student emails
    student_email_domain = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. dbcegoa.ac.in")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Department(models.Model):
    """ The Functional Unit (e.g., 'ECS', 'IT', 'Exam Cell') """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=100) # e.g., "Electronics & Computer Science"
    
    # 1. REMOVE unique=True from here
    code = models.CharField(max_length=20) 
    
    class Meta:
        # 2. ADD THIS: Code is only unique PER organization
        unique_together = ('organization', 'code')
        
    def __str__(self):
        return self.name

# ==========================================
# 2. THE CHRONOMETER (Time)
# ==========================================

class AcademicYear(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='academic_years')
    name = models.CharField(max_length=20) # e.g., "2025-2026"
    start_date = models.DateField()
    end_date = models.DateField()
    
    # --- NEW TERM FIELDS ---
    odd_term_start_date = models.DateField(null=True, blank=True)
    odd_term_end_date = models.DateField(null=True, blank=True)
    even_term_start_date = models.DateField(null=True, blank=True)
    even_term_end_date = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

    class Meta:
        unique_together = ('organization', 'name')

    def save(self, *args, **kwargs):
        # Logic: If setting this to active, set all others to inactive
        if self.is_active:
            AcademicYear.objects.filter(organization=self.organization).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Closed'})"

# ==========================================
# 3. THE ACTORS (People)
# ==========================================

class UserProfile(models.Model):
    """
    The Single Source of Truth for Staff.
    Includes both 'System Viewers' and 'Faculty'.
    """
    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Principal / Director'),
        ('ORG_ADMIN', 'Organization Admin'),
        ('HOD', 'Head of Department'),      
        ('STAFF', 'Office Staff'),
        ('FACULTY', 'Teaching Faculty'),
        ('COUNSELLOR', 'Counselling Department'), 
        ('SPORTS_STAFF', 'Sports Department'),
        ('STUDENT', 'Student'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    
    
    # Context
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='FACULTY') 
    
    # Registry Details
    designation = models.CharField(max_length=100, blank=True, null=True) # e.g. "Asst. Professor"
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='faculty_profiles/', blank=True, null=True)
    
    # Feature Flags
    is_setup_complete = models.BooleanField(default=False)
    is_teaching_faculty = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} - {self.role}"

@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)






# ==========================================
# 8. AUTHENTICATION & SECURITY (OTP)
# ==========================================

class EmailVerificationOTP(models.Model):
    """
    Temporarily stores OTPs for sign-ups and 'Join Team' flows.
    """
    email = models.EmailField(unique=True)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        # OTP is valid for 10 minutes from creation
        expiration_time = self.created_at + timedelta(minutes=10)
        return timezone.now() < expiration_time

    @classmethod
    def generate_otp(cls):
        # Generates a random 6-digit number
        return str(random.randint(100000, 999999))

    def __str__(self):
        return f"{self.email} - {self.otp}"

# ==========================================
# 4. THE CURRICULUM (The "Factory" Rules)
# ==========================================

class Course(models.Model):
    """
    A Subject in the Catalog.
    Defines 'What' is taught, not 'When' or 'Who'.
    """
    SUBJECT_TYPE_CHOICES = [
        ('THEORY', 'Theory (Compulsory)'),         # Updated Label
        ('LAB', 'Practical / Lab'),       
        ('PRO_ELECTIVE', 'Professional Elective'), 
        ('OPEN_ELECTIVE', 'Open Elective'),
        ('PRO_ELECTIVE_LAB', 'Professional Elective Lab'),        
    ]

    department = models.ForeignKey(Department, on_delete=models.CASCADE) 
    name = models.CharField(max_length=255) 
    code = models.CharField(max_length=20)  
    
    semester = models.IntegerField() 
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPE_CHOICES)
    credits = models.IntegerField(default=3) # Changed default to 3
    
    is_open_elective = models.BooleanField(default=False)

    class Meta:
        unique_together = ('department', 'code')

    def __str__(self):
        return f"{self.code} - {self.name} ({self.subject_type})"

class StudentGroup(models.Model):
    """
    The Audience.
    Instead of just 'Class', we have flexible groups.
    """
    GROUP_TYPE_CHOICES = [
        ('CLASS', 'Whole Class'),         # e.g. "TE ECS"
        ('BATCH', 'Lab Batch'),           # e.g. "TE ECS - A"
        ('ELECTIVE', 'Elective Section')  # e.g. "PE-Blockchain"
    ]

    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    subject = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='linked_groups')
    name = models.CharField(max_length=50) 
    type = models.CharField(max_length=20, choices=GROUP_TYPE_CHOICES)
    semester = models.IntegerField()
    
    # Hierarchy: Batch A belongs to TE ECS
    parent_group = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE)
    
    # M2M Link: Which students are in this group?
    # (We will link this to your existing Student model)
    students = models.ManyToManyField('Student', blank=True)

    def __str__(self):
        return f"{self.name} ({self.academic_year.name})"

# ==========================================
# 5. THE ALLOCATION (The Permission System)
# ==========================================

class TeachingAllocation(models.Model):
    """
    The Commissioning Table.
    This Row = Permission to Teach.
    """
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    
    # Who?
    faculty = models.ForeignKey(
        'UserProfile', 
        on_delete=models.CASCADE, 
        related_name='allocations',
        # NEW: Allow Admins to be assigned to classes!
        limit_choices_to={'role__in': ['FACULTY', 'ORG_ADMIN', 'SUPER_ADMIN']} 
    )
    
    # What?
    subject = models.ForeignKey(Course, on_delete=models.CASCADE)
    
    # To Whom? (The critical fix for Theory vs Lab)
    student_group = models.ForeignKey(StudentGroup, on_delete=models.CASCADE)
    
    # Constraints
    allocated_hours = models.FloatField(default=0) # For Workload Calc
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('academic_year', 'faculty', 'subject', 'student_group')
        verbose_name = "Teaching Allocation"

    def __str__(self):
        return f"{self.faculty.user.first_name} - {self.subject.name} - {self.student_group.name}"
        

# ==========================================
# STUDENT MODEL 
# ==========================================
class Student(models.Model):
    
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='student_record')
    
    # Link to the Organization & Department
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE)
    department = models.ForeignKey('Department', on_delete=models.CASCADE, null=True, blank=True)
    
    # Identifiers
    roll_number = models.CharField(max_length=50)  
    enrollment_number = models.CharField(max_length=50, unique=True) 
    aic_id = models.CharField(max_length=50, null=True, blank=True) 
    aadhar_number = models.CharField(max_length=20, null=True, blank=True) 
    
    # Personal Info
    full_name = models.CharField(max_length=255) 
    email = models.EmailField(blank=True, null=True) 
    
    # Restored Fields
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, null=True, blank=True)
    mobile_number = models.CharField(max_length=15, null=True, blank=True)
    name_on_aadhar = models.CharField(max_length=255, null=True, blank=True)
    signature_status = models.CharField(max_length=50, null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    
    # Context
    academic_year = models.ForeignKey('AcademicYear', on_delete=models.SET_NULL, null=True, blank=True)
    current_semester = models.IntegerField(default=1) 
    
    # ---> DEACTIVATE FEATURE <---
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.roll_number} - {self.full_name}"
    
# ==========================================
# 7. THE AUDIT TRAIL (Data Import Logs)
# ==========================================

class DataImportLog(models.Model):
    """
    Tracks every bulk upload event for audit purposes.
    "Who changed the data and when?"
    """
    STATUS_CHOICES = [
        ('PENDING', 'Processing...'),
        ('SUCCESS', 'Success'),
        ('PARTIAL_SUCCESS', 'Partial Success (Some rows failed)'),
        ('FAILED', 'Failed'),
    ]

    IMPORT_TYPE_CHOICES = [
        ('STUDENT_REGISTRATION', 'Student Registration'),
        ('FACULTY_LOAD', 'Faculty Workload'),
        ('MARKS_ENTRY', 'Exam Marks'),
        ('ATTENDANCE', 'Attendance Records'),
    ]

    # Context
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    
    # File Details
    file_name = models.CharField(max_length=255)
    import_type = models.CharField(max_length=50, choices=IMPORT_TYPE_CHOICES)
    file = models.FileField(upload_to='import_logs/', null=True, blank=True)
    
    # Outcome
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    success_count = models.IntegerField(default=0)
    error_log = models.TextField(blank=True, null=True) # Stores JSON or Text of specific row errors
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.import_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"

# ==========================================
# GLOBAL NOTIFICATION SYSTEM
# ==========================================
class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=100)
    message = models.TextField()
    action_url = models.CharField(max_length=255, blank=True, null=True) # E.g., '/duty-leave'
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"To {self.recipient.email}: {self.title}"