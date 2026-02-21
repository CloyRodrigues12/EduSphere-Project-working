from django.urls import path
from .views import ClassSessionView, BulkAttendanceUpdateView

urlpatterns = [
    path('sessions/', ClassSessionView.as_view(), name='class-sessions'),
    path('bulk-update/', BulkAttendanceUpdateView.as_view(), name='bulk-attendance'),
]