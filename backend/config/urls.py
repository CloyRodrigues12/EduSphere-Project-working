from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from core.views import GoogleLogin 
from core.views import GoogleLogin, SetupOrganizationView
from core.views import GoogleLogin, SetupOrganizationView, StaffManagementView
from core.views import GoogleLogin, SetupOrganizationView, StaffManagementView, CurrentUserView # <--- Import CurrentUserView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Standard Auth (Login/Logout/Password Reset)
    path('api/auth/', include('dj_rest_auth.urls')),
    
    # Registration
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),
    
    # Google Login Endpoint
    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),

    # Setup Organization Endpoint
    path('api/setup-organization/', SetupOrganizationView.as_view()),
 
    # Staff Management Endpoint
    path('api/staff/', StaffManagementView.as_view()),

    path('api/user/me/', CurrentUserView.as_view()),

    path(
        'password-reset/confirm/<uidb64>/<token>/', 
        TemplateView.as_view(), 
        name='password_reset_confirm'
    ),


]