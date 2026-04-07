from django.db import models
from core.models import UserProfile, AcademicYear, Student, Department

class ClassTeacher(models.Model):
    faculty = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='class_teacher_roles')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='class_teachers')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='class_teachers')
    year_level = models.CharField(max_length=2) # 'FE', 'SE', 'TE', 'BE'
    division = models.CharField(max_length=10, default='A') 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('department', 'academic_year', 'year_level', 'division') 

    def __str__(self):
        return f"CT: {self.faculty.user.first_name} -> {self.year_level}-{self.division}"