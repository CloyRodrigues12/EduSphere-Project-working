# In backend/student_portal/urls.py (create this file)
from django.urls import path
from .views import MyStudentDashboardView

urlpatterns = [
    path('dashboard/', MyStudentDashboardView.as_view(), name='student_dashboard_api'),
]

