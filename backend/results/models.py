# backend/results/models.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import Student, Course, AcademicYear

class InternalAssessment(models.Model):
    TERM_CHOICES = [
        ('ODD', 'Odd Term'),
        ('EVEN', 'Even Term')
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='internal_results')
    subject = models.ForeignKey(Course, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    term = models.CharField(max_length=10, choices=TERM_CHOICES, default='ODD')
    
    it1 = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(25)], null=True, blank=True)
    it2 = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(25)], null=True, blank=True)
    it3 = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(25)], null=True, blank=True)
    
    final_score = models.FloatField(default=0.0)
    is_passing = models.BooleanField(default=False)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'subject', 'academic_year', 'term')
        verbose_name = "Internal Assessment"

    def save(self, *args, **kwargs):
        # Best 2 of 3 Logic
        marks = [self.it1 or 0, self.it2 or 0, self.it3 or 0]
        marks.sort(reverse=True)
        self.final_score = round(sum(marks[:2]) / 2, 2)
        self.is_passing = self.final_score >= 10.0
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.roll_number} - {self.subject.code} ({self.term})"