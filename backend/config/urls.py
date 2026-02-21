from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.shortcuts import redirect
from core.views import GoogleLogin 
from core.views import GoogleLogin, SetupOrganizationView
from core.views import GoogleLogin, SetupOrganizationView, StaffManagementView
from core.views import GoogleLogin, SetupOrganizationView, StaffManagementView, CurrentUserView
from django.urls import path, include
from core.views import StudentUploadView
from core.views import CheckDuplicateUploadView
from core.views import CheckDuplicateUploadView, StudentUploadView
from core.views import UploadPreviewView, commit_upload, CheckDuplicateUploadView 
from core.views import DepartmentListView 
from core.views import SubjectCatalogView
from core.views import StudentDirectoryView, StudentGroupView
from core.views import AllocationManagerView, MyClassesView
from core.views import AcademicYearView
from core.views import AcademicYearSummaryView

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
    FacultyManagementView 
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


    # --- ORGANIZATION & USER ---
    path('api/setup-organization/', SetupOrganizationView.as_view()),
    path('api/user/me/', CurrentUserView.as_view()),

    path('api/academic-years/', AcademicYearView.as_view(), name='academic-years'),
    path('api/academic-summary/', AcademicYearSummaryView.as_view(), name='academic-summary'),

    # --- TEAM MANAGEMENT ---
    path('api/staff/', StaffManagementView.as_view()),  # For Viewers/Clerks
    path('api/faculty/', FacultyManagementView.as_view(), name='faculty-list'), # For Teachers

    path('api/departments/', DepartmentListView.as_view(), name='department-list'),

    
    ## --- STUDENT DATA ---
    path('api/upload/check-duplicate/', CheckDuplicateUploadView.as_view(), name='check-duplicate'),
    path('api/upload/preview/', UploadPreviewView.as_view(), name='upload-preview'),
    path('api/upload/commit/', commit_upload, name='commit-upload'),

    # --- PASSWORD RESET ---
    path('password-reset/confirm/<uidb64>/<token>/', password_reset_redirect, name='password_reset_confirm'),

    


   # --- ACADEMIC CONFIGURATION ---
    path('api/subjects/', SubjectCatalogView.as_view(), name='subject-catalog'),
    path('api/students/directory/', StudentDirectoryView.as_view(), name='student-directory'),
    path('api/student-groups/', StudentGroupView.as_view(), name='student-groups'),
    
    # --- PHASE 3: ALLOCATIONS & DASHBOARDS ---
    path('api/allocations/', AllocationManagerView.as_view(), name='allocation-manager'),
    path('api/faculty/my-classes/', MyClassesView.as_view(), name='my-classes'),



    
    # --- DOCUSENSE ---
    path('api/docusense/', include('docusense.urls')),



    
]

# This allows Django to serve uploaded images during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)