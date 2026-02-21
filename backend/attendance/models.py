from django.db import models
from core.models import TeachingAllocation, Student

class ClassSession(models.Model):
    allocation = models.ForeignKey(TeachingAllocation, on_delete=models.CASCADE, related_name='sessions')
    date = models.DateField()
    
    # The Multiplier (e.g., 2 for a 2-hour lab). Defaults to 1.
    lecture_count = models.IntegerField(default=1, help_text="Multiplier for TA/TC")
    
    is_extra_class = models.BooleanField(default=False)
    topics_covered = models.TextField(blank=True, null=True)
    
    # Hidden Audit Timestamp for "Infinite Edits" tracking
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f"{self.allocation.subject.code} - {self.date} ({self.lecture_count} hrs)"

class AttendanceRecord(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('DUTY_SPORTS', 'Duty Leave - Sports'),
        ('DUTY_CULTURE', 'Duty Leave - Cultural'),
        ('DUTY_OTHER', 'Duty Leave - Other'),
    ]
    
    session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PRESENT')
    
    remarks = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        unique_together = ('session', 'student')

    def __str__(self):
        return f"{self.student.full_name} - {self.status}"