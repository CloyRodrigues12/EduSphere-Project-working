from django.urls import path
from .views import ClassSessionView, BulkAttendanceUpdateView, AttendanceReportView # <-- Import it

urlpatterns = [
    path('sessions/', ClassSessionView.as_view(), name='class-sessions'),
    path('bulk-update/', BulkAttendanceUpdateView.as_view(), name='bulk-attendance'),
    path('report/', AttendanceReportView.as_view(), name='attendance-report'), # <-- Add this line
]