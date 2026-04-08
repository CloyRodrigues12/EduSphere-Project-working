from django.db import models
from core.models import TeachingAllocation, Student, UserProfile

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


# ==========================================
# NEW: OFFICIAL DUTY / LEAVE MANAGEMENT
# ==========================================

class DutyLeaveRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('SKIPPED', 'Skipped (Faculty Initiated)')
    ]

    title = models.CharField(max_length=255)
    reason = models.TextField()
    
    # Initiator can be a Student (via their UserProfile) or a Faculty member
    initiator = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='initiated_leaves')
    
    # The global faculty member selected to verify the event (e.g., Sports Director)
    event_in_charge = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='supervised_events')
    
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Stage 1 Approval
    in_charge_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.start_date} to {self.end_date})"

class DutyLeaveParticipant(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]
    
    request = models.ForeignKey(DutyLeaveRequest, on_delete=models.CASCADE, related_name='participants')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='duty_leaves')
    
    # Stage 2 & 3 Approvals (Tracked individually per student)
    class_teacher_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    hod_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Ultimate Status
    final_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    def __str__(self):
        return f"{self.student.full_name} - {self.request.title}"