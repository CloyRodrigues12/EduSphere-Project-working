from django.urls import path
from .views import ClassSessionView, BulkAttendanceUpdateView, AttendanceReportView, CumulativeReportView,AnalyticsRadarView

# Add it to the urlpatterns:
urlpatterns = [
    path('sessions/', ClassSessionView.as_view(), name='class-sessions'),
    path('bulk-update/', BulkAttendanceUpdateView.as_view(), name='bulk-attendance'),
    path('report/', AttendanceReportView.as_view(), name='attendance-report'),
    path('cumulative-report/', CumulativeReportView.as_view(), name='cumulative-report'),
    path('analytics/', AnalyticsRadarView.as_view(), name='analytics-radar'),
]