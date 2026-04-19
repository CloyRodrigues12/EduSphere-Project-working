# In backend/student_portal/urls.py 
from django.urls import path
from .views import MyStudentDashboardView
from .views import StudentProfileView 

urlpatterns = [
    path('dashboard/', MyStudentDashboardView.as_view(), name='student_dashboard_api'),
    path('profile/', StudentProfileView.as_view(), name='student-profile'),
]

