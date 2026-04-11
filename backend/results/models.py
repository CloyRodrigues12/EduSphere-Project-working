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
        # 1. FORCE EVERYTHING TO FLOAT BEFORE MATH
        def to_float(val):
            if val in [None, "", "null"]:
                return None
            return float(val)

        self.it1 = to_float(self.it1)
        self.it2 = to_float(self.it2)
        self.it3 = to_float(self.it3)

        # 2. USE 0.0 (FLOAT) AS FALLBACK, NEVER 0 (INT)
        m1 = self.it1 if self.it1 is not None else 0.0
        m2 = self.it2 if self.it2 is not None else 0.0
        m3 = self.it3 if self.it3 is not None else 0.0
        
        marks = [m1, m2, m3]
        marks.sort(reverse=True) # Will never crash because it's specifically [float, float, float]
        
        self.final_score = round(sum(marks[:2]) / 2, 2)
        self.is_passing = self.final_score >= 10.0
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.roll_number} - {self.subject.code} ({self.term})"