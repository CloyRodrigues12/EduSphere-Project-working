from django.db import models
from core.models import UserProfile

class AcademicDocument(models.Model):
    CATEGORY_CHOICES = [
        ('RESULT', 'University Result'),
        ('REPORT', 'Academic Report'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending Processing'),
        ('PROCESSING', 'Analyzing...'),
        ('COMPLETED', 'Analysis Ready'),
        ('FAILED', 'Processing Failed'),
    ]

    # Link to the user who uploaded it
    uploaded_by = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    
    # The actual file
    file = models.FileField(upload_to='docusense_uploads/')
    
    # Metadata
    filename = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    upload_date = models.DateTimeField(auto_now_add=True)
    
    # Processing Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Store the AI Analysis result here (JSON) so we don't re-compute every time
    analysis_data = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.filename} ({self.get_status_display()})"
