from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from django.contrib.auth.models import User
import traceback
from core.models import Organization, UserProfile 

from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from core.models import Department

from django.core.mail import send_mail
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from core.models import DataImportLog
from core.ingestion.ecs_pipeline.students import StudentIngestionService


from django.db import transaction
from .models import UserProfile, Department
from .serializers import FacultySerializer, AddFacultySerializer

from core.serializers import DepartmentSerializer

from core.models import Course, TeachingAllocation
from core.serializers import CourseSerializer

from django.db.models import Q
from core.models import Student, StudentGroup
from core.serializers import StudentSerializer, StudentGroupSerializer

from django.db import transaction
from core.models import TeachingAllocation, UserProfile
from core.serializers import TeachingAllocationSerializer

from core.models import AcademicYear
from rest_framework import serializers


from django.db.models import Count
from core.models import StudentGroup, TeachingAllocation

        
import random
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .models import EmailVerificationOTP


# 1. Google Login
class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173"
    client_class = OAuth2Client

# 2. Setup Organization
from django.db import transaction
from core.models import Organization, Department, AcademicYear

from django.db import transaction
from core.models import Organization, Department, AcademicYear

class SetupOrganizationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_profile = request.user.profile

        if user_profile.is_setup_complete:
            return Response({"error": "Setup is already complete."}, status=status.HTTP_400_BAD_REQUEST)

        org_name = request.data.get('organization_name')
        org_type = request.data.get('type')
        dept_name = request.data.get('department_name') # NEW
        academic_year_name = request.data.get('academic_year_name') # NEW

        if not all([org_name, org_type, dept_name, academic_year_name]):
            return Response({"error": "Organization, Department, and Academic Year are all required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Enforce multi-tenant baseline initialization
            with transaction.atomic():
                # 1. Create the Organization
                org = Organization.objects.create(name=org_name, type=org_type)
                
                # 2. Create the first Department
                dept = Department.objects.create(
                    organization=org, 
                    name=dept_name, 
                    code=dept_name[:4].upper() 
                )
                
                # 3. Create the first Academic Year
                ay = AcademicYear.objects.create(
                    organization=org,
                    name=academic_year_name,
                    start_date="2025-06-01", 
                    end_date="2026-05-31",
                    is_active=True
                )

                # 4. Link everything to the Super Admin (User)
                user_profile.organization = org
                user_profile.department = dept
                user_profile.role = 'SUPER_ADMIN'
                user_profile.is_setup_complete = True
                user_profile.save()

            return Response({
                "message": "Setup complete. Welcome to EduSphere!",
                "organization": org.name,
                "department": dept.name,
                "academic_year": ay.name
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


# --- HELPER FUNCTION FOR JWT ---
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }
    
def get_queryset(self):
    user_profile = self.request.user.profile
    if user_profile.role == 'HOD':
        # Force sandbox: HOD can ONLY fetch users/allocations in their own department
        return UserProfile.objects.filter(department=user_profile.department)
    elif user_profile.role in ['ORG_ADMIN', 'SUPER_ADMIN']:
        return UserProfile.objects.filter(organization=user_profile.organization)
    return UserProfile.objects.none() # Faculty can't view staff list


# ==========================================
# OTP REGISTRATION FLOW
# ==========================================
    # For RequestRegistrationOTPView and JoinTeamRequestOTPView:


class RequestRegistrationOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        otp_code = EmailVerificationOTP.generate_otp()
        
        # Save or update existing OTP for this email
        EmailVerificationOTP.objects.update_or_create(
            email=email,
            defaults={'otp': otp_code, 'created_at': timezone.now()}
        )
        
        html_message = f"""
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9;">
    <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">EduSphere Verification</h1>
        </div>
        <div style="padding: 40px 30px; text-align: center; color: #333333;">
            <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">Use the code below to complete your setup.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: inline-block;">
                <p style="margin: 0; font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #4f46e5;">{otp_code}</p>
            </div>
            <p style="font-size: 12px; color: #9ca3af;">This code expires in 10 minutes.</p>
        </div>
    </div>
</body>
</html>
"""

        # Send the email
        send_mail(
    subject='EduSphere - Verification Code',
    message=f'Your verification code is: {otp_code}', # Plaintext fallback
    from_email=settings.EMAIL_HOST_USER,
    recipient_list=[email],
    fail_silently=False,
    html_message=html_message # Styled HTML version
)
        return Response({"message": "OTP sent successfully."})


class VerifyRegistrationOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        try:
            otp_record = EmailVerificationOTP.objects.get(email=email, otp=otp_code)
            
            if not otp_record.is_valid():
                return Response({"error": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
            
            # 1. Create User
            base_username = email.split('@')[0].replace(".", "")
            username = f"{base_username}{random.randint(1000, 9999)}"
            
            user = User.objects.create_user(
                username=username, 
                email=email, 
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            
            # 2. Cleanup OTP
            otp_record.delete()

            # 3. Generate JWT Tokens
            tokens = get_tokens_for_user(user)
            
            return Response({
                "message": "Account created successfully.",
                "access": tokens['access'],
                "refresh": tokens['refresh'],
                "user": {
                    "id": user.id, 
                    "email": user.email, 
                    "first_name": user.first_name, 
                    "is_setup_complete": getattr(user.profile, 'is_setup_complete', False)
                }
            })
            
        except EmailVerificationOTP.DoesNotExist:
            return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# JOIN TEAM FLOW (For Pre-added Faculty)
# ==========================================



class JoinTeamRequestOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        
        try:
            user = User.objects.get(email=email)
            # If the user has a usable password, they've already set up their account
            # If the user has a password AND has successfully logged in before, they are active.
            # If last_login is None, they are still "fresh" and can use the Join Team flow.
            if user.has_usable_password() and user.last_login is not None:
                return Response({"error": "This account is already active. Please log in normally."}, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({"error": "No invitation found for this email. Contact your administrator."}, status=status.HTTP_404_NOT_FOUND)
        otp_code = EmailVerificationOTP.generate_otp()
        
        EmailVerificationOTP.objects.update_or_create(
            email=email,
            defaults={'otp': otp_code, 'created_at': timezone.now()}
        )
        
        html_message = f"""
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9;">
    <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">EduSphere Verification</h1>
        </div>
        <div style="padding: 40px 30px; text-align: center; color: #333333;">
            <p style="font-size: 16px; color: #4b5563; margin-bottom: 20px;">Use the code below to complete your setup.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: inline-block;">
                <p style="margin: 0; font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #4f46e5;">{otp_code}</p>
            </div>
            <p style="font-size: 12px; color: #9ca3af;">This code expires in 10 minutes.</p>
        </div>
    </div>
</body>
</html>
"""

        send_mail(
    subject='EduSphere - Verification Code',
    message=f'Your verification code is: {otp_code}', # Plaintext fallback
    from_email=settings.EMAIL_HOST_USER,
    recipient_list=[email],
    fail_silently=False,
    html_message=html_message # Styled HTML version
)
        return Response({"message": "OTP sent to your email."})


class JoinTeamCompleteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        new_password = request.data.get('password')

        try:
            otp_record = EmailVerificationOTP.objects.get(email=email, otp=otp_code)
            
            if not otp_record.is_valid():
                return Response({"error": "OTP has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
            user = User.objects.get(email=email)
            
            user.set_password(new_password)
            user.save()

            # --- ADD THIS BLOCK ---
            # Automatically bypass the Setup Wizard for invited staff
            if hasattr(user, 'profile'):
                user.profile.is_setup_complete = True
                user.profile.save()
            # ----------------------

            otp_record.delete()

            tokens = get_tokens_for_user(user)
            return Response({
                "message": "Account activated successfully.",
                "access": tokens['access'],
                "refresh": tokens['refresh'],
                "user": {
                    "id": user.id, 
                    "email": user.email, 
                    "first_name": user.first_name,
                    # --- UPDATE THIS TO True ---
                    "is_setup_complete": True 
                }
            })

        except (EmailVerificationOTP.DoesNotExist, User.DoesNotExist):
            return Response({"error": "Invalid OTP or Email."}, status=status.HTTP_400_BAD_REQUEST)

# ==========================================
# GOOGLE AUTH: SET PASSWORD
# ==========================================

class SetGooglePasswordView(APIView):
    permission_classes = [IsAuthenticated] # Must be logged in via Google token

    def post(self, request):
        user = request.user
        new_password = request.data.get('password')
        
        if not new_password:
            return Response({"error": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()
        return Response({"message": "Password set successfully."})

# ==========================================
# 2. STAFF MANAGEMENT (The Office Clerks / Admins)
# ==========================================

class StaffManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def check_admin_access(self, request):
        """ Helper to ensure only Admins can access this API """
        if not hasattr(request.user, 'profile'):
            return False
        return request.user.profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']

    # --- THE MISSING GET METHOD (Restored) ---
    def get(self, request):
        try:
            if not self.check_admin_access(request):
                return Response({"error": "Access Denied: Admins only."}, status=403)

            user_profile = request.user.profile
            members = UserProfile.objects.filter(
                organization=user_profile.organization,
                role__in=['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN']
            )
            
            data = []
            for member in members:
                u = member.user 
                status_label = "Active" if u.last_login else "Invited"
                
                data.append({
                    "id": u.id,
                    "name": u.get_full_name() or u.email.split('@')[0],
                    "email": u.email,
                    "role": member.get_role_display(),
                    "role_code": member.role,
                    "department": member.department.name if member.department else "-",
                    "status": status_label,
                    "last_login": u.last_login
                })
            
            return Response(data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)

    # --- THE UPDATED POST METHOD (With Resend Logic) ---
    def post(self, request):
        if not self.check_admin_access(request):
            return Response({"error": "Permission denied"}, status=403)

        email = request.data.get('email')
        role = request.data.get('role', 'STAFF')
        action = request.data.get('action') # 'resend' or None
        
        if not email:
            return Response({"error": "Email is required"}, status=400)

        # 1. Handle New vs Resend
        if User.objects.filter(email=email).exists():
            if action == 'resend':
                new_user = User.objects.get(email=email)
                if new_user.profile.organization != request.user.profile.organization:
                    return Response({"error": "Unauthorized to resend to this user"}, status=403)
            else:
                return Response({"error": "User with this email already exists!"}, status=400)
        else:
            if action == 'resend':
                return Response({"error": "User not found to resend"}, status=404)
            # Create fresh user
            new_user = User.objects.create(username=email, email=email)
            new_user.set_unusable_password()
            new_user.save()

        try:
            profile, created = UserProfile.objects.get_or_create(user=new_user)
            admin_org = request.user.profile.organization
            
            profile.organization = admin_org
            profile.role = role
            profile.is_setup_complete = True 
            profile.save()

            # --- PREPARE EMAIL DATA ---
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                
                login_url = "http://localhost:5173/login" 
                
                # Get Sender Name (The Admin who clicked invite)
                sender_name = request.user.get_full_name()
                if not sender_name:
                    sender_name = "The Administrator"

                subject = f"You're invited to join {admin_org.name} on EduSphere"
                
                # --- PLAIN TEXT VERSION (Fallback) ---
                plain_message = (
                    f"Hello,\n\n"
                    f"{sender_name} has invited you to join the staff at {admin_org.name} as a {role}.\n\n"
                    f"Click here to get started: {login_url}\n\n"
                    f"Welcome to the team!"
                )

                # --- HTML STYLED VERSION ---
                html_message = f"""
                <!DOCTYPE html>
                <html>
                <body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9;">
                    <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to EduSphere</h1>
                        </div>
                        <div style="padding: 40px 30px; text-align: center; color: #333333;">
                            <h2 style="color: #1e1b4b; margin-top: 0;">You've been invited!</h2>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 25px;">
                                <strong>{sender_name}</strong> has invited you to join the team at <strong>{admin_org.name}</strong>.
                            </p>
                            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 30px; display: inline-block;">
                                <p style="margin: 0; font-size: 14px; color: #6b7280;">Your Role</p>
                                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #4f46e5;">{role}</p>
                            </div>
                            <br/>
                            <a href="{login_url}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.25);">
                                Accept Invitation
                            </a>
                        </div>
                        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">&copy; 2026 EduSphere. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                send_mail(
                    subject,
                    plain_message, 
                    settings.EMAIL_HOST_USER,
                    [email],
                    fail_silently=False,
                    html_message=html_message
                )
                print(f"Email sent successfully to {email}")

            except Exception as mail_error:
                print(f"Failed to send email: {mail_error}")
            
            return Response({
                "message": f"Invite sent to {email}",
                "user": {
                    "id": new_user.id,
                    "email": new_user.email,
                    "status": "Invited"
                }
            })

        except Exception as e:
            if 'new_user' in locals():
                new_user.delete()
            print("Invite Error:", e)
            return Response({"error": "Failed to create user. Check server logs."}, status=500)

    # --- THE DELETE METHOD ---
    def delete(self, request):
        """ Safe Delete: Handles normal users AND broken 'ghost' users """
        if not self.check_admin_access(request):
            return Response({"error": "Permission denied"}, status=403)

        user_id = request.GET.get('id') or request.data.get('id')
        
        try:
            # 1. Prevent suicide (Admin deleting themselves)
            if int(user_id) == request.user.id:
                return Response({"error": "You cannot delete yourself."}, status=400)

            target_user = User.objects.get(id=user_id)
            
            # 2. Check Permissions (Safe Mode)
            if hasattr(target_user, 'profile') and target_user.profile.organization:
                if target_user.profile.organization != request.user.profile.organization:
                    return Response({"error": "User belongs to another organization"}, status=403)

            # 3. Perform Delete
            target_user.delete()
            return Response({"message": "User removed successfully"})

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
        
# 4. Current User (Used by Topbar and Sidebar)
class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'profile'):
            return Response({"error": "Profile not found"}, status=404)
            
        profile = user.profile
        org = profile.organization

        return Response({
            "id": user.id,
            "name": user.get_full_name() or user.email.split('@')[0],
            "email": user.email,
            "role": profile.get_role_display(),
            "role_code": profile.role,
            "organization": org.name if org else "No Campus",
            "location": org.address if org else "",
            "designation": profile.designation or "Staff Member",
            "org_type": org.type if org else "Institute",
            "is_setup_complete": profile.is_setup_complete,
            "is_teaching_faculty": profile.is_teaching_faculty 
        })
    

class StudentUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        academic_year = request.data.get('academic_year')
        semester = request.data.get('semester') 
        
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # FIX: Change 'userprofile' to 'profile' (matching your models.py related_name)
        try:
            organization = request.user.profile.organization
            department = request.user.profile.department
        except AttributeError:
            return Response({"error": "User profile not found."}, status=status.HTTP_400_BAD_REQUEST)

        # Initialize Service
        service = StudentIngestionService(
            file=file_obj,
            organization=organization,
            department=department,
            academic_year=academic_year,
            semester=semester
        )
        
        # Run Process
        result = service.process()
        
        if result['status'] == 'error':
             return Response(result, status=status.HTTP_400_BAD_REQUEST)
             
        return Response(result, status=status.HTTP_201_CREATED)
    


# 1. Check Duplicate File
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_duplicate_file(request):
    filename = request.data.get('filename')
    exists = DataImportLog.objects.filter(
        organization=request.user.profile.organization,
        file_name=filename,
        status__in=['SUCCESS', 'PARTIAL']
    ).exists()
    return Response({'exists': exists})

# 2. Upload & Generate Preview (No Save to Master)
# backend/core/views.py

class UploadPreviewView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated] # Ensure permissions are imported

    def post(self, request):
        file_obj = request.FILES.get('file')
        
        # 1. SAFETY CHECK
        if not file_obj:
            return Response(
                {"error": "No file received. Please try selecting the file again."}, 
                status=400
            )

        try:
            # 2. Save to Temp Log
            log = DataImportLog.objects.create(
                organization=request.user.profile.organization,
                user=request.user,
                file_name=file_obj.name,
                file=file_obj,
                category='STUDENTS'
            )

            # 3. Run Validation Logic
            service = StudentIngestionService(log.id)
            if not service.load_and_validate_schema():
                return Response({
                    "status": "schema_error", 
                    "errors": service.validation_report["schema_errors"]
                }, status=400)

            report = service.validate_data()

            # 4. Return Report for UI
            return Response({
                "log_id": log.id,
                "status": "ready_for_review",
                "summary": {
                    "total_rows": len(report["valid_rows"]) + len(report["error_rows"]),
                    "valid_count": len(report["valid_rows"]),
                    "error_count": len(report["error_rows"]),
                },
                "preview_data": report["preview_data"], 
                "error_report": report["error_rows"] 
            })
            
        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)

# 3. Commit Data (Full or Partial)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def commit_upload(request):
    log_id = request.data.get('log_id')
    mode = request.data.get('mode') # 'FULL' or 'PARTIAL'
    
    try:
        service = StudentIngestionService(log_id)
        
        if mode == 'PARTIAL':
            count = service.commit_data(partial=True)
            return Response({"status": "success", "message": f"Successfully imported {count} valid records. Errors were skipped."})
        else:
            # Full Mode - Will fail if errors exist
            count = service.commit_data(partial=False)
            return Response({"status": "success", "message": f"Successfully imported all {count} records."})
            
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)
    




class FacultyManagementView(APIView):
    """
    Manages the 'Academic Team' (The Factory Workers).
    Distinct from 'StaffManagementView' (The Office Clerks).
    """
    permission_classes = [permissions.IsAuthenticated] # Only Admin/HOD can access
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        # FIX: Include FACULTY, HODs, OR any Admin who toggled 'is_teaching_faculty'
        faculties = UserProfile.objects.filter(
            Q(role__in=['FACULTY', 'HOD']) | Q(is_teaching_faculty=True),
            organization=user_profile.organization
        ).select_related('user', 'department')
        
        # Apply Security / Sandbox Filter
        if not is_admin:
            if not user_profile.department:
                return Response([])
            faculties = faculties.filter(department=user_profile.department)
        elif target_dept_id and target_dept_id != 'ALL':
            faculties = faculties.filter(department_id=target_dept_id)

        from core.serializers import FacultySerializer
        serializer = FacultySerializer(faculties, many=True)
        return Response(serializer.data)

    def post(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
        
        serializer = AddFacultySerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            try:
                org = request.user.profile.organization
                
                # SECURITY: HODs can only add faculty to their own department!
                target_dept_id = data['department_id']
                if request.user.profile.role == 'HOD' and str(target_dept_id) != str(request.user.profile.department.id):
                    return Response({"error": "HODs can only assign faculty to their own department."}, status=403)

                dept = Department.objects.get(id=target_dept_id, organization=org)

                with transaction.atomic():
                    user, created = User.objects.get_or_create(
                        username=data['email'],
                        defaults={'email': data['email'], 'first_name': data['full_name'], 'is_active': True}
                    )
                    profile, profile_created = UserProfile.objects.get_or_create(user=user)
                    
                    if not profile_created and profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                        return Response({"error": "This email belongs to an Admin."}, status=400)

                    # Admins can set someone as HOD, otherwise default to FACULTY
                    requested_role = request.data.get('role', 'FACULTY')
                    if requested_role == 'HOD' and request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
                        return Response({"error": "Only Admins can appoint HODs."}, status=403)

                    profile.role = requested_role
                    profile.organization = org
                    profile.department = dept
                    profile.designation = data['designation']
                    profile.phone_number = data.get('phone_number', '')
                    
                    if 'profile_picture' in request.FILES:
                        profile.profile_picture = request.FILES['profile_picture']
                        
                    profile.save()
                    return Response(FacultySerializer(profile).data, status=status.HTTP_201_CREATED)

            except Department.DoesNotExist:
                return Response({"error": "Invalid Department ID"}, status=400)
            except Exception as e:
                return Response({"error": str(e)}, status=500)
        return Response(serializer.errors, status=400)
    
    def patch(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        profile_id = request.GET.get('id')
        try:
            # FIX: Removed role='FACULTY' so HODs can be edited too
            profile = UserProfile.objects.get(
                id=profile_id, 
                organization=request.user.profile.organization
            )
            
            # Update User Base Name
            full_name = request.data.get('full_name')
            if full_name:
                profile.user.first_name = full_name
                profile.user.save()
            
            # Update Profile Details
            if 'role' in request.data and request.user.profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                profile.role = request.data['role']
            if 'designation' in request.data:
                profile.designation = request.data['designation']
            if 'phone_number' in request.data:
                profile.phone_number = request.data['phone_number']
            if 'department_id' in request.data:
                dept = Department.objects.get(id=request.data['department_id'], organization=profile.organization)
                profile.department = dept
                
            # Update Profile Picture
            if 'profile_picture' in request.FILES:
                profile.profile_picture = request.FILES['profile_picture']
            elif 'remove_picture' in request.data and request.data['remove_picture'] == 'true':
                profile.profile_picture = None

            profile.save()
            from core.serializers import FacultySerializer
            return Response(FacultySerializer(profile).data)

        except UserProfile.DoesNotExist:
            return Response({"error": "Faculty not found"}, status=404)
        except Department.DoesNotExist:
            return Response({"error": "Invalid Department ID"}, status=400)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
            
    def delete(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        profile_id = request.GET.get('id')
        try:
            # FIX: Removed role='FACULTY'
            target_profile = UserProfile.objects.get(
                id=profile_id, 
                organization=request.user.profile.organization
            )
            
            if target_profile.user.id == request.user.id:
                return Response({"error": "You cannot delete your own account!"}, status=400)
            
            target_profile.user.delete()
            return Response({"message": "Faculty removed successfully"})

        except UserProfile.DoesNotExist:
            return Response({"error": "Faculty not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

# ==========================================
# 3. Check Duplicate (Year-Aware)
# ==========================================
class CheckDuplicateUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        filename = request.data.get('filename')
        ay_val = request.data.get('academic_year')
        org = request.user.profile.organization
        
        # Robustly resolve the Academic Year (Handles both ID and String Name)
        ay_obj = None
        if ay_val:
            if str(ay_val).isdigit():
                ay_obj = AcademicYear.objects.filter(id=ay_val, organization=org).first()
            else:
                ay_obj = AcademicYear.objects.filter(name=ay_val, organization=org).first()

        # Check if this EXACT file was uploaded FOR THIS SPECIFIC YEAR
        exists = DataImportLog.objects.filter(
            organization=org,
            academic_year=ay_obj,  # <--- Now it only checks duplicates within the selected year
            file_name=filename,
            status__in=['SUCCESS', 'PARTIAL_SUCCESS']
        ).exists()
        
        return Response({'exists': exists})


# ==========================================
# 1. Preview View (Dynamic Year Support)
# ==========================================
class UploadPreviewView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file')
        ay_val = request.data.get('academic_year')
        org = request.user.profile.organization
        
        if not file_obj:
            return Response({"error": "No file received."}, status=400)

        try:
            # 1. Robustly Resolve Academic Year 
            ay_obj = None
            if ay_val:
                if str(ay_val).isdigit():
                    ay_obj = AcademicYear.objects.filter(id=ay_val, organization=org).first()
                else:
                    ay_obj = AcademicYear.objects.filter(name=ay_val, organization=org).first()

            # 2. Save to Temp Log with the specific Academic Year
            log = DataImportLog.objects.create(
                organization=org,
                uploaded_by=request.user.profile,
                academic_year=ay_obj, # <--- Successfully links the year to the Log
                file_name=file_obj.name,
                file=file_obj,
                import_type='STUDENT_REGISTRATION',
                status='PENDING'
            )

            # 3. Run Validation Logic
            service = StudentIngestionService(log.id)
            if not service.load_and_validate_schema():
                return Response({
                    "status": "schema_error", 
                    "errors": service.validation_report["schema_errors"]
                }, status=400)

            report = service.validate_data()

            # 4. Return Report for UI
            return Response({
                "log_id": log.id,
                "status": "ready_for_review",
                "summary": {
                    "total_rows": len(report["valid_rows"]) + len(report["error_rows"]),
                    "valid_count": len(report["valid_rows"]),
                    "error_count": len(report["error_rows"]),
                },
                "preview_data": report["preview_data"], 
                "error_report": report["error_rows"] 
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
# ==========================================
# STUDENT DATA INGESTION
# ==========================================
from core.models import DataImportLog, AcademicYear

class CheckDuplicateUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        filename = request.data.get('filename')
        
        # Check against the NEW DataImportLog statuses
        exists = DataImportLog.objects.filter(
            organization=request.user.profile.organization,
            file_name=filename,
            status__in=['SUCCESS', 'PARTIAL_SUCCESS'] # Updated to match your new choices
        ).exists()
        
        return Response({'exists': exists})

class StudentUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        ay_id = request.data.get('academic_year') # Frontend sends ID
        semester = request.data.get('semester') 
        
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Get User's Context
        try:
            profile = request.user.profile
            org = profile.organization
            department = profile.department
        except AttributeError:
            return Response({"error": "User profile not found."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Resolve Academic Year Object
        academic_year_obj = None
        if ay_id:
            try:
                academic_year_obj = AcademicYear.objects.get(id=ay_id, organization=org)
            except AcademicYear.DoesNotExist:
                pass

        # 3. Create Audit Trail (Pending)
        import_log = DataImportLog.objects.create(
            organization=org,
            academic_year=academic_year_obj,
            uploaded_by=profile,
            file_name=file_obj.name,
            import_type='STUDENT_REGISTRATION',
            status='PENDING'
        )

        try:
            # 4. Initialize Your Ingestion Service (students.py)
            service = StudentIngestionService(
                file=file_obj,
                organization=org,
                department=department,
                academic_year=academic_year_obj, # Pass the object
                semester=semester
            )
            
            # 5. Run Process
            result = service.process()
            
            # 6. Update Audit Log Outcome
            import_log.success_count = result.get('processed', 0)
            
            if result.get('status') == 'error':
                import_log.status = 'FAILED'
                import_log.error_log = result.get('message', 'Unknown Error')
                import_log.save()
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
                
            elif result.get('errors'):
                import_log.status = 'PARTIAL_SUCCESS'
                import_log.error_log = "\n".join(result['errors'])
                import_log.save()
                return Response(result, status=status.HTTP_201_CREATED)
                
            else:
                import_log.status = 'SUCCESS'
                import_log.save()
                return Response(result, status=status.HTTP_201_CREATED)

        except Exception as e:
            import_log.status = 'FAILED'
            import_log.error_log = f"System crash: {str(e)}"
            import_log.save()
            return Response({"error": str(e)}, status=500)




# ==========================================
# DEPARTMENT MANAGEMENT
# ==========================================
class DepartmentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        org = request.user.profile.organization
        departments = Department.objects.filter(organization=org)
        return Response(DepartmentSerializer(departments, many=True).data)

    def post(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        serializer = DepartmentSerializer(data=request.data)
        if serializer.is_valid():
            # Explicitly pass the organization directly to the database save method
            serializer.save(organization=request.user.profile.organization)
            return Response(serializer.data, status=201)
            
        return Response(serializer.errors, status=400)

    def put(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        dept_id = request.data.get('id')
        try:
            dept = Department.objects.get(id=dept_id, organization=request.user.profile.organization)
            serializer = DepartmentSerializer(dept, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except Department.DoesNotExist:
            return Response({"error": "Department not found"}, status=404)

    def delete(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        dept_id = request.GET.get('id')
        try:
            dept = Department.objects.get(id=dept_id, organization=request.user.profile.organization)
            # Security: Prevent deleting a department if it has users or subjects
            if dept.userprofile_set.exists() or dept.course_set.exists():
                return Response({"error": "Cannot delete a department that contains staff or subjects."}, status=400)
                
            dept.delete()
            return Response({"message": "Department deleted successfully"})
        except Department.DoesNotExist:
            return Response({"error": "Department not found"}, status=404)


#------------------------------------------------------------------------------------------------------------------


# ==========================================
# SUBJECT CATALOG (Phase 2)
# ==========================================
class SubjectCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        # FIX: Course is linked to department, so we check department__organization
        courses = Course.objects.filter(department__organization=user_profile.organization)
        
        # Apply Security / Sandbox Filter
        if not is_admin:
            if not user_profile.department:
                return Response([])
            courses = courses.filter(department=user_profile.department)
        elif target_dept_id and target_dept_id != 'ALL':
            courses = courses.filter(department_id=target_dept_id)

        semester = request.GET.get('semester')
        if semester:
            courses = courses.filter(semester=semester)

        return Response(CourseSerializer(courses, many=True).data)

    def post(self, request):
        """ Create a new subject """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        target_dept_id = request.headers.get('X-Department-Id')
        
        # FAILSAFE: Prevent creating subjects while viewing "All Departments"
        if target_dept_id == 'ALL':
            return Response({"error": "Please select a specific department from the Topbar to create a subject."}, status=400)

        data = request.data.copy()
        
        # SMART ROUTING: Use Topbar department if Admin, else use personal department (for HODs)
        if request.user.profile.role in ['SUPER_ADMIN', 'ORG_ADMIN'] and target_dept_id:
            data['department'] = target_dept_id
        else:
            data['department'] = request.user.profile.department.id

        serializer = CourseSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def put(self, request):
        """ Update an existing subject """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        course_id = request.data.get('id')
        try:
            course = Course.objects.get(id=course_id, department=request.user.profile.department)
            serializer = CourseSerializer(course, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)

    def delete(self, request):
        """ Safely delete a subject """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        course_id = request.GET.get('id')
        try:
            course = Course.objects.get(id=course_id, department=request.user.profile.department)
            
            # THE DELETION LOCK: Prevent deleting subjects that are already allocated!
            if TeachingAllocation.objects.filter(subject=course).exists():
                return Response({
                    "error": "Cannot delete this subject because it is already allocated to a teacher. Remove the allocation first."
                }, status=400)
                
            course.delete()
            return Response({"message": "Subject deleted successfully"})
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)






# ==========================================
# 1. THE STUDENT DIRECTORY (Master List & Bulk Promote)
# ==========================================

from django.db.models import Q
from core.models import AcademicYear, Student

class StudentDirectoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        # Start with the whole organization
        students = Student.objects.filter(organization=user_profile.organization)
        
        # Apply Security / Sandbox Filter
        if not is_admin:
            if not user_profile.department:
                return Response({"error": "You are not assigned to a department"}, status=400)
            students = students.filter(department=user_profile.department)
        elif target_dept_id and target_dept_id != 'ALL':
            students = students.filter(department_id=target_dept_id)

        # Smart Flow Logic (Academic Year)
        ay_id = request.GET.get('academic_year') 
        if ay_id:
            try:
                current_ay = AcademicYear.objects.get(id=ay_id)
                students = students.filter(
                    Q(academic_year_id=ay_id) | 
                    Q(studentgroup__academic_year_id=ay_id) |
                    (Q(academic_year__start_date__lt=current_ay.start_date) & Q(is_active=True) & Q(current_semester__lt=8))
                ).distinct()
            except AcademicYear.DoesNotExist:
                pass
            
        semester = request.GET.get('semester')
        if semester:
            students = students.filter(current_semester=semester)
            
        search = request.GET.get('search', '')
        if search:
            students = students.filter(Q(full_name__icontains=search) | Q(enrollment_number__icontains=search))
            
        return Response(StudentSerializer(students, many=True).data)

    def patch(self, request):
        """ Bulk update semester AND migrate them to the active academic year """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)

        student_ids = request.data.get('student_ids', [])
        new_sem = request.data.get('new_semester')
        target_ay_id = request.data.get('academic_year_id') # Catch the new year
        
        if not student_ids or not new_sem:
            return Response({"error": "Missing student IDs or target semester"}, status=400)
            
        students = Student.objects.filter(id__in=student_ids, department=request.user.profile.department)
        
        # Update Semester AND assign them to the new Academic Year
        update_data = {'current_semester': new_sem}
        if target_ay_id:
            update_data['academic_year_id'] = target_ay_id
            
        students.update(**update_data)
        
        return Response({"message": f"Successfully promoted/demoted {len(student_ids)} students."})

# ==========================================
# 2. STUDENT BATCH MANAGEMENT (The Buckets)
# ==========================================
class StudentGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        # FIX: StudentGroup is linked to department, so we check department__organization
        groups = StudentGroup.objects.filter(department__organization=user_profile.organization)

        # Apply Security / Sandbox Filter
        if not is_admin:
            if not user_profile.department:
                return Response([])
            groups = groups.filter(department=user_profile.department)
        elif target_dept_id and target_dept_id != 'ALL':
            groups = groups.filter(department_id=target_dept_id)

        # Academic Year Filter
        ay_id = request.query_params.get('academic_year') or request.GET.get('academic_year')
        if ay_id:
            groups = groups.filter(academic_year_id=ay_id)
            
        semester = request.query_params.get('semester') or request.GET.get('semester')
        if semester:
            groups = groups.filter(semester=semester)

        return Response(StudentGroupSerializer(groups, many=True).data)

    def post(self, request):
        """ Create a new Batch / Group """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        target_dept_id = request.headers.get('X-Department-Id')
        
        # FAILSAFE: Prevent creating batches while viewing "All Departments"
        if target_dept_id == 'ALL':
            return Response({"error": "Please select a specific department from the Topbar to create a batch."}, status=400)

        data = request.data.copy()
        
        # SMART ROUTING
        if request.user.profile.role in ['SUPER_ADMIN', 'ORG_ADMIN'] and target_dept_id:
            data['department'] = target_dept_id
        else:
            data['department'] = request.user.profile.department.id
        
        serializer = StudentGroupSerializer(data=data)
        if serializer.is_valid():
            group = serializer.save()
            return Response(StudentGroupSerializer(group).data, status=201)
        return Response(serializer.errors, status=400)
    
    def put(self, request):
        """ Update Batch / Group details (Name, Type) """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        group_id = request.data.get('id')
        try:
            group = StudentGroup.objects.get(id=group_id, department=request.user.profile.department)
            serializer = StudentGroupSerializer(group, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except StudentGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

    def patch(self, request):
        """ Add or Remove students from a specific group """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        group_id = request.data.get('group_id')
        action = request.data.get('action') # 'add', 'remove', or 'set'
        student_ids = request.data.get('student_ids', [])
        
        try:
            group = StudentGroup.objects.get(id=group_id, department=request.user.profile.department)
            
            # The Magic Django ManyToMany logic
            if action == 'add':
                group.students.add(*student_ids)
            elif action == 'remove':
                group.students.remove(*student_ids)
            elif action == 'set':
                group.students.set(student_ids)
            
            return Response(StudentGroupSerializer(group).data)
        except StudentGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

    def delete(self, request):
        """ Delete a Batch (This does NOT delete the students, just the bucket) """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        group_id = request.GET.get('id')
        try:
            group = StudentGroup.objects.get(id=group_id, department=request.user.profile.department)
            group.delete()
            return Response({"message": "Group deleted successfully"})
        except StudentGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)


from django.db.models import Q

# ==========================================
# 1. THE ALLOCATION MATRIX (Admin & HOD View)
# ==========================================
class AllocationManagerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Fetch all allocations for the department (Admin View) """
        user_profile = request.user.profile
        is_org_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        is_hod = user_profile.role == 'HOD'
        target_dept_id = request.headers.get('X-Department-Id')
        
        ay_id = request.GET.get('academic_year')
        faculty_id = request.GET.get('faculty_id') 
        
        # Base query: all allocations in the org for the year
        allocations = TeachingAllocation.objects.filter(
            subject__department__organization=user_profile.organization,
            academic_year_id=ay_id
        )
        
        # Apply Strict Security / Sandbox Filter
        if is_org_admin:
            if target_dept_id and target_dept_id != 'ALL':
                allocations = allocations.filter(subject__department_id=target_dept_id)
        elif is_hod:
            # HOD Sandbox: Show department classes AND any classes they personally teach
            if user_profile.department:
                allocations = allocations.filter(
                    Q(subject__department=user_profile.department) | Q(faculty=user_profile)
                ).distinct()
            else:
                allocations = allocations.filter(faculty=user_profile)
        else:
            # Normal faculty only see their own
            allocations = allocations.filter(faculty=user_profile)
            
        if faculty_id:
            allocations = allocations.filter(faculty_id=faculty_id)
            
        return Response(TeachingAllocationSerializer(allocations, many=True).data)

    def post(self, request):
        """ Bulk Create Allocations (The 'Multiple Batches' Magic) """
        # FIX: Added HOD to permissions
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        ay_id = request.data.get('academic_year')
        faculty_id = request.data.get('faculty_id')
        subject_id = request.data.get('subject_id')
        group_ids = request.data.get('student_group_ids', []) 
        
        if not all([ay_id, faculty_id, subject_id, group_ids]):
            return Response({"error": "Missing required fields"}, status=400)

        created_allocations = []
        try:
            with transaction.atomic():
                for group_id in group_ids:
                    allocation, created = TeachingAllocation.objects.get_or_create(
                        academic_year_id=ay_id,
                        faculty_id=faculty_id,
                        subject_id=subject_id,
                        student_group_id=group_id
                    )
                    created_allocations.append(allocation)
                    
            return Response({
                "message": f"Successfully created {len(created_allocations)} allocations!",
                "data": TeachingAllocationSerializer(created_allocations, many=True).data
            }, status=201)
            
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def delete(self, request):
        """ Remove a specific allocation """
        # FIX: Added HOD to permissions
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        allocation_id = request.GET.get('id')
        try:
            TeachingAllocation.objects.get(id=allocation_id).delete()
            return Response({"message": "Allocation removed"})
        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Not found"}, status=404)
        
        
# ==========================================
# 2. FACULTY DASHBOARD (Teacher View)
# ==========================================
class MyClassesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Fetch ONLY the classes assigned to the logged-in teacher """
        # We only want classes for the currently ACTIVE Academic Year
        try:
            allocations = TeachingAllocation.objects.filter(
                faculty=request.user.profile,
                academic_year__is_active=True
            ).order_by('subject__semester', 'subject__name')
            
            return Response(TeachingAllocationSerializer(allocations, many=True).data)
        except Exception as e:
            return Response({"error": str(e)}, status=500)



# Quick serializer for the view
class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = '__all__'

# ==========================================
# ACADEMIC YEAR MANAGEMENT
# ==========================================
class AcademicYearView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Fetch all academic years for the organization """
        # Only Org Admins/Super Admins might need to see all, 
        # but everyone needs to know the active one.
        org = request.user.profile.organization
        years = AcademicYear.objects.filter(organization=org).order_by('-start_date')
        return Response(AcademicYearSerializer(years, many=True).data)

    def post(self, request):
        """ Create a new Academic Year """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        data = request.data.copy()
        data['organization'] = request.user.profile.organization.id
        
        serializer = AcademicYearSerializer(data=data)
        if serializer.is_valid():
            # If they set this as active, deactivate all others first
            if serializer.validated_data.get('is_active', False):
                AcademicYear.objects.filter(organization=request.user.profile.organization).update(is_active=False)
            
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def put(self, request):
        """ Update an Academic Year (e.g., Set as Active) """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        ay_id = request.data.get('id')
        try:
            year = AcademicYear.objects.get(id=ay_id, organization=request.user.profile.organization)
            
            # If marking as active, deactivate the others
            is_active = request.data.get('is_active')
            if str(is_active).lower() == 'true':
                AcademicYear.objects.filter(organization=request.user.profile.organization).update(is_active=False)
                year.is_active = True
                
            serializer = AcademicYearSerializer(year, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except AcademicYear.DoesNotExist:
            return Response({"error": "Academic Year not found"}, status=404)



class AcademicYearSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Get structural analytics for a specific academic year """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        ay_id = request.GET.get('year_id')
        if not ay_id:
            return Response({"error": "Year ID is required"}, status=400)

        # 1. Batches Breakdown by Semester
        groups = StudentGroup.objects.filter(academic_year_id=ay_id)
        sem_data = groups.values('semester').annotate(batch_count=Count('id')).order_by('semester')
        
        # 2. Count UNIQUE students enrolled in at least one batch this year
        total_students = groups.aggregate(total=Count('students', distinct=True))['total'] or 0

        # 3. Faculty Workload Breakdown
        allocations = TeachingAllocation.objects.filter(academic_year_id=ay_id)
        faculty_data = allocations.values(
            'faculty__user__first_name', 
            'faculty__user__last_name'
        ).annotate(class_count=Count('id')).order_by('-class_count')

        return Response({
            "total_batches": groups.count(),
            "semester_breakdown": list(sem_data),
            "total_students": total_students,
            "total_allocations": allocations.count(),
            "faculty_workload": list(faculty_data)
        })


class StudentToggleStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        try:
            student = Student.objects.get(id=pk, department=request.user.profile.department)
            student.is_active = not student.is_active
            student.save()
            status_text = "Activated" if student.is_active else "Deactivated"
            return Response({'message': f'Student successfully {status_text}', 'is_active': student.is_active})
        except Student.DoesNotExist:
            return Response({"error": "Student not found"}, status=404)


class ToggleTeachingRoleView(APIView):
    """ Allows Admins to add themselves to the Faculty Registry """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        profile = request.user.profile
        if profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Only Admins can toggle this."}, status=403)
            
        profile.is_teaching_faculty = not profile.is_teaching_faculty
        profile.save()
        status_text = "Added to" if profile.is_teaching_faculty else "Removed from"
        return Response({"message": f"Successfully {status_text} the Faculty Registry.", "is_teaching_faculty": profile.is_teaching_faculty})