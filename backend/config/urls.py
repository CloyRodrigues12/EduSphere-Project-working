from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.shortcuts import redirect
from django.conf.urls.static import static
from core.views import GoogleLogin, SetupOrganizationView, StaffManagementView
from core.views import GoogleLogin, SetupOrganizationView, StaffManagementView, CurrentUserView
from django.urls import path, include
from core.views import CheckDuplicateUploadView
from core.views import CheckDuplicateUploadView, StudentUploadView
from core.views import UploadPreviewView, commit_upload, CheckDuplicateUploadView 
from core.views import DepartmentListView 
from core.views import SubjectCatalogView
from core.views import AllocationManagerView, MyClassesView
from core.views import AcademicYearView
from core.views import AcademicYearSummaryView
from core.views import ToggleTeachingRoleView

from core.views import StudentDirectoryView, StudentGroupView, StudentToggleStatusView,AutoGenerateClassGroupView, AutoSplitLabBatchesView,UploadSchemaView

from core.dashboard import AdvancedDashboardView

from core.views import (
    RequestRegistrationOTPView,
    VerifyRegistrationOTPView,
    JoinTeamRequestOTPView,
    JoinTeamCompleteView,
    SetGooglePasswordView,StudentAccountManagementView,NotificationMarkReadView,NotificationListView
)

def password_reset_redirect(request, uidb64, token):
    # This takes the tokens from the email link and sends the user to React (port 5173)
    return redirect(f"http://localhost:5173/password-reset/confirm/{uidb64}/{token}")


# Import ALL your views here
from core.views import (
    GoogleLogin, 
    SetupOrganizationView, 
    StaffManagementView, 
    CurrentUserView, 
    StudentUploadView,
    FacultyManagementView, 
    NotificationListView,         
    NotificationMarkReadView,InstituteDirectoryView, Student360View,       
)

def password_reset_redirect(request, uidb64, token):
    # This takes the tokens from the email link and sends the user to React (port 5173)
    return redirect(f"http://localhost:5173/password-reset/confirm/{uidb64}/{token}")

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # --- AUTHENTICATION ---
    path('api/auth/', include('dj_rest_auth.urls')),
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),
    
    # --- CUSTOM AUTH & OTP ROUTES ---
    path('api/auth/register/request-otp/', RequestRegistrationOTPView.as_view(), name='request-otp'),
    path('api/auth/register/verify-otp/', VerifyRegistrationOTPView.as_view(), name='verify-otp'),
    
    path('api/auth/join-team/request-otp/', JoinTeamRequestOTPView.as_view(), name='join-team-request-otp'),
    path('api/auth/join-team/complete/', JoinTeamCompleteView.as_view(), name='join-team-complete'),
    
    path('api/auth/set-google-password/', SetGooglePasswordView.as_view(), name='set-google-password'),


    # --- ORGANIZATION & USER ---
    path('api/setup-organization/', SetupOrganizationView.as_view()),
    path('api/user/me/', CurrentUserView.as_view()),

    path('api/user/toggle-teaching/', ToggleTeachingRoleView.as_view(), name='toggle-teaching'),

    path('api/academic-years/', AcademicYearView.as_view(), name='academic-years'),
    path('api/academic-summary/', AcademicYearSummaryView.as_view(), name='academic-summary'),

    # --- TEAM MANAGEMENT ---
    path('api/staff/', StaffManagementView.as_view()),  # For Viewers/Clerks
    path('api/faculty/', FacultyManagementView.as_view(), name='faculty-list'), # For Teachers

    path('api/departments/', DepartmentListView.as_view(), name='department-list'),
    
   
    path('api/student-accounts/', StudentAccountManagementView.as_view(), name='student_accounts'),





path('api/dashboard/advanced/', AdvancedDashboardView.as_view(), name='advanced_dashboard'),

    
    ## --- STUDENT DATA ---
    path('api/upload/check-duplicate/', CheckDuplicateUploadView.as_view(), name='check-duplicate'),
    path('api/upload/preview/', UploadPreviewView.as_view(), name='upload-preview'),
    path('api/upload/commit/', commit_upload, name='commit-upload'),
    path('api/upload/schema/', UploadSchemaView.as_view(), name='upload-schema'),

    # --- PASSWORD RESET ---
    path('password-reset/confirm/<uidb64>/<token>/', password_reset_redirect, name='password_reset_confirm'),

    


# --- ACADEMIC CONFIGURATION ---
    path('api/subjects/', SubjectCatalogView.as_view(), name='subject-catalog'),
    path('api/students/directory/', StudentDirectoryView.as_view(), name='student-directory'),
    path('api/students/toggle-status/<int:pk>/', StudentToggleStatusView.as_view(), name='student-toggle-status'),
    
    path('api/student-groups/', StudentGroupView.as_view(), name='student-groups'),
    path('api/student-groups/auto-generate/', AutoGenerateClassGroupView.as_view(), name='auto-generate-class'),
    path('api/student-groups/auto-split/', AutoSplitLabBatchesView.as_view(), name='auto-split-batches'),

    
    # --- PHASE 3: ALLOCATIONS & DASHBOARDS ---
    path('api/allocations/', AllocationManagerView.as_view(), name='allocation-manager'),
    path('api/faculty/my-classes/', MyClassesView.as_view(), name='my-classes'),
    
    


    # --- PHASE 4: ATTENDANCE ---
    path('api/attendance/', include('attendance.urls')), 

    # Class and Mentor assignment
     path('api/assignments/', include('faculty_assignments.urls')),
     path('api/counselling/', include('counselling.urls')),


     path('api/student-portal/', include('student_portal.urls')),
     
 
    path('api/user/notifications/', NotificationListView.as_view(), name='notifications'),
    path('api/user/notifications/<int:notif_id>/read/', NotificationMarkReadView.as_view(), name='mark-notification-read'),
    
    path('api/results/', include('results.urls')),
    
    
    path('api/institute/directory/', InstituteDirectoryView.as_view(), name='institute-directory'),
    path('api/institute/student-360/<int:student_id>/', Student360View.as_view(), name='student-360'),
    
    path('api/chatbot/', include('chatbot.urls')),
]

# This allows Django to serve uploaded images during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)