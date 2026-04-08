from django.urls import path
from .views import (
    ClassSessionView, 
    BulkAttendanceUpdateView, 
    AttendanceReportView, 
    CumulativeReportView,
    AnalyticsRadarView,
    FacultyAllocationsView,
    ClassRosterView,
    MarkAttendanceView,
    DutyLeaveAPIView,       # <-- NEW
    DutyLeaveActionView ,    # <-- NEW
    DutyLeaveStudentListView
)

urlpatterns = [
    # New Smart Roster APIs
    path('allocations/', FacultyAllocationsView.as_view(), name='faculty-allocations'),
    path('roster/<int:allocation_id>/', ClassRosterView.as_view(), name='class-roster'),
    path('mark/', MarkAttendanceView.as_view(), name='mark-attendance'),

    # NEW: Duty Leave APIs
    path('duty-leave/', DutyLeaveAPIView.as_view(), name='duty-leave-api'),
    path('duty-leave/action/', DutyLeaveActionView.as_view(), name='duty-leave-action'),

    # Existing APIs
    path('sessions/', ClassSessionView.as_view(), name='class-sessions'),
    path('bulk-update/', BulkAttendanceUpdateView.as_view(), name='bulk-attendance-update'),
    path('report/', AttendanceReportView.as_view(), name='attendance-report'),
    path('cumulative-report/', CumulativeReportView.as_view(), name='cumulative-report'),
    path('analytics/', AnalyticsRadarView.as_view(), name='analytics-radar'),
    
    path('duty-leave/action/', DutyLeaveActionView.as_view(), name='duty-leave-action'),
    path('duty-leave/students/', DutyLeaveStudentListView.as_view(), name='duty-leave-students'), # <-- ADD THIS LINE
]