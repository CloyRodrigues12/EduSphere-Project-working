from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MenteeProfileViewSet
from .views import (
    MentorSummaryView,
    MentorStudentListView,
    MyDetailedMenteesView,
)


router = DefaultRouter()
router.register(r'mentees', MenteeProfileViewSet, basename='mentees')

urlpatterns = [
    path('mentors/summary/', MentorSummaryView.as_view(), name='mentor-summary'),
    path('mentors/students/', MentorStudentListView.as_view(), name='mentor-students'),
    path('my-detailed-mentees/', MyDetailedMenteesView.as_view(), name='my-detailed-mentees'),
    path('', include(router.urls)),
]