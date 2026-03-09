from django.urls import path
from .views import (
    ClassTeacherManagerView, MentorSummaryView, MentorStudentListView, 
    ClassTeacherStudentListView, MyClassDashboardView,
    MyMenteesDashboardView, MenteeSubjectAttendanceView 
)

urlpatterns = [
    path('class-teachers/', ClassTeacherManagerView.as_view(), name='class_teachers'),
    path('class-teachers/students/', ClassTeacherStudentListView.as_view(), name='class_teacher_students'),
    path('my-class/', MyClassDashboardView.as_view(), name='my_class_dashboard'),
    
    path('mentors/summary/', MentorSummaryView.as_view(), name='mentor_summary'),
    path('mentors/students/', MentorStudentListView.as_view(), name='mentor_students'),
    path('my-mentees/', MyMenteesDashboardView.as_view(), name='my_mentees_dashboard'), 
    path('my-mentees/subjects/', MenteeSubjectAttendanceView.as_view(), name='mentee_subjects'), 
]