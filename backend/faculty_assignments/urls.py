from django.urls import path
from .views import (
    ClassTeacherManagerView,
    ClassTeacherStudentListView,
    MyClassDashboardView,
    MyMenteesDashboardView,      
    MenteeSubjectAttendanceView  
)

urlpatterns = [
    path('class-teachers/', ClassTeacherManagerView.as_view(), name='class-teacher-manager'),
    path('class-teachers/students/', ClassTeacherStudentListView.as_view(), name='class-teacher-students'),
    path('my-class/', MyClassDashboardView.as_view(), name='my-class-dashboard'),
    
    # --- RESTORED DASHBOARD ROUTES FOR FACULTY ---
    path('my-mentees/', MyMenteesDashboardView.as_view(), name='my-mentees-dashboard'),
    path('my-mentees/subjects/', MenteeSubjectAttendanceView.as_view(), name='mentee-subject-attendance'),
]