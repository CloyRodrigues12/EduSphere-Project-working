from django.urls import path
from .views import (
    MentorSummaryView,
    MentorStudentListView,
)

urlpatterns = [
    path('mentors/summary/', MentorSummaryView.as_view(), name='mentor-summary'),
    path('mentors/students/', MentorStudentListView.as_view(), name='mentor-students'),
]