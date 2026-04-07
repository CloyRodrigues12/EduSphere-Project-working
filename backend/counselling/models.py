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