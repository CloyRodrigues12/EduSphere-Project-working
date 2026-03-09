from django.urls import path
from .views import ClassTeacherManagerView, MentorSummaryView, MentorStudentListView, ClassTeacherStudentListView

urlpatterns = [
    path('class-teachers/', ClassTeacherManagerView.as_view(), name='class_teachers'),
    path('class-teachers/students/', ClassTeacherStudentListView.as_view(), name='class_teacher_students'), # <-- NEW
    path('mentors/summary/', MentorSummaryView.as_view(), name='mentor_summary'),
    path('mentors/students/', MentorStudentListView.as_view(), name='mentor_students'),
]