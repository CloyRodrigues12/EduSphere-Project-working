from django.db import models
from core.models import UserProfile, Student

class Mentorship(models.Model):
    mentor = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='mentees')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='mentorship')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student',) # Ensures a student only has 1 active mentor at a time

    def __str__(self):
        return f"Mentor: {self.mentor.user.first_name} -> Student: {self.student.full_name}"
    

class MenteeProfile(models.Model):
    """
    1-to-1 extension of the Student model specifically for Counselling & Mentorship data.
    Digitizes the 'Mentee Registration Form'.
    """
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='mentee_profile')
    
    # --- New Personal Info ---
    address = models.TextField(blank=True, null=True)
    pin_code = models.CharField(max_length=20, blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    
    # --- Family Details ---
    father_name = models.CharField(max_length=150, blank=True, null=True)
    father_occupation = models.CharField(max_length=150, blank=True, null=True)
    father_contact = models.CharField(max_length=20, blank=True, null=True)
    
    mother_name = models.CharField(max_length=150, blank=True, null=True)
    mother_occupation = models.CharField(max_length=150, blank=True, null=True)
    mother_contact = models.CharField(max_length=20, blank=True, null=True)
    
    guardian_name = models.CharField(max_length=150, blank=True, null=True)
    guardian_contact = models.CharField(max_length=20, blank=True, null=True)
    
    # --- Extra-Curriculars ---
    hobbies = models.TextField(blank=True, null=True, help_text="Hobbies / Interests")
    achievements = models.TextField(blank=True, null=True, help_text="Achievements & Victories")
    
    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile: {self.student.full_name} ({self.student.roll_number})"