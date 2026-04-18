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
from core.models import Department

from django.core.mail import send_mail
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from core.models import DataImportLog
from core.ingestion.ecs_pipeline.students import StudentIngestionService

from django.db import transaction
from .models import UserProfile, Department
from .serializers import FacultySerializer, AddFacultySerializer

from core.serializers import DepartmentSerializer
from core.models import Course, TeachingAllocation
from core.serializers import CourseSerializer

# --- CRITICAL IMPORT FOR SANDBOXING ---
from django.db.models import Q

from core.models import Student, StudentGroup
from core.serializers import StudentSerializer, StudentGroupSerializer
from core.serializers import TeachingAllocationSerializer

from core.models import AcademicYear
from rest_framework import serializers

from django.db.models import Count
        
import random
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from .models import EmailVerificationOTP

from .models import Notification


# 1. Google Login
class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173"
    client_class = OAuth2Client

# 2. Setup Organization
class SetupOrganizationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_profile = request.user.profile

        if user_profile.is_setup_complete:
            return Response({"error": "Setup is already complete."}, status=status.HTTP_400_BAD_REQUEST)

        org_name = request.data.get('organization_name')
        org_type = request.data.get('type')
        dept_name = request.data.get('department_name') 
        academic_year_name = request.data.get('academic_year_name') 
        designation = request.data.get('designation')

        if not all([org_name, org_type, dept_name, academic_year_name]):
            return Response({"error": "Organization, Department, and Academic Year are all required."}, status=status.HTTP_400_BAD_REQUEST)

        # ==========================================
        # DYNAMIC YEAR CALCULATION
        # ==========================================
        from django.utils import timezone
        
        try:
            # If they type "2024-2025", this grabs the "2024"
            start_year = int(academic_year_name.split('-')[0].strip())
        except (ValueError, AttributeError, IndexError):
            # Fallback: Calculate based on current month (Assuming June start)
            today = timezone.now().date()
            start_year = today.year if today.month >= 6 else today.year - 1
            
        end_year = start_year + 1

        try:
            with transaction.atomic():
                org = Organization.objects.create(name=org_name, type=org_type)
                dept = Department.objects.create(
                    organization=org, 
                    name=dept_name, 
                    code=dept_name[:4].upper() 
                )
                ay = AcademicYear.objects.create(
                    organization=org,
                    name=academic_year_name,
                    # --- Dynamically Inject the Years ---
                    start_date=f"{start_year}-06-01", 
                    end_date=f"{end_year}-05-31",
                    odd_term_start_date=f"{start_year}-07-01",
                    odd_term_end_date=f"{start_year}-12-15",
                    even_term_start_date=f"{end_year}-01-01",
                    even_term_end_date=f"{end_year}-05-15",
                    is_active=True
                )

                user_profile.organization = org
                user_profile.department = dept
                user_profile.role = 'SUPER_ADMIN'
                user_profile.designation = designation
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

# ==========================================
# OTP REGISTRATION FLOW
# ==========================================
class RequestRegistrationOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({"error": "An account with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

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
            message=f'Your verification code is: {otp_code}', 
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
            html_message=html_message
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
            
            base_username = email.split('@')[0].replace(".", "")
            username = f"{base_username}{random.randint(1000, 9999)}"
            
            user = User.objects.create_user(
                username=username, 
                email=email, 
                password=password,
                first_name=first_name,
                last_name=last_name
            )
            # --- FIX: Explicitly set the role to Admin for new registrations ---
            if hasattr(user, 'profile'):
                user.profile.role = 'SUPER_ADMIN'  # Initial registrant is always the Super Admin
                user.profile.is_setup_complete = False
                user.profile.save()
        # ------------------------------------------------------------------
            
            
            
            otp_record.delete()
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

class JoinTeamRequestOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        
        try:
            user = User.objects.get(email=email)
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
            message=f'Your verification code is: {otp_code}', 
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
            html_message=html_message
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

            if hasattr(user, 'profile'):
                user.profile.is_setup_complete = True
                user.profile.save()

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
                    "is_setup_complete": True 
                }
            })

        except (EmailVerificationOTP.DoesNotExist, User.DoesNotExist):
            return Response({"error": "Invalid OTP or Email."}, status=status.HTTP_400_BAD_REQUEST)

class SetGooglePasswordView(APIView):
    permission_classes = [IsAuthenticated] 

    def post(self, request):
        user = request.user
        new_password = request.data.get('password')
        
        if not new_password:
            return Response({"error": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()

        # 4. FIXED: Only mark setup as complete if they are a STUDENT.
        # Admins must remain False so they get routed to the Setup Wizard!
        if hasattr(user, 'profile') and user.profile.role == 'STUDENT':
            user.profile.is_setup_complete = True
            user.profile.save()

        return Response({"message": "Password set successfully."})

class StaffManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def check_admin_access(self, request):
        if not hasattr(request.user, 'profile'):
            return False
        return request.user.profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']

    def get(self, request):
        user_profile = request.user.profile
        
        # Security Check
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        # Fetch all non-teaching staff
        members = UserProfile.objects.filter(
            organization=user_profile.organization,
            role__in=['STAFF', 'ORG_ADMIN', 'SUPER_ADMIN', 'COUNSELLOR', 'SPORTS_STAFF']
        ).select_related('user', 'department')

        data = []
        for m in members:
            # --- THE FIX: Mark as "Active" if they have a password OR if they have logged in at least once! ---
            is_active = m.user.has_usable_password() or m.user.last_login is not None
            
            data.append({
                "id": m.user.id,
                "name": m.user.get_full_name() or m.user.first_name,
                "full_name": m.user.get_full_name() or m.user.first_name,
                "email": m.user.email,
                "role_code": m.role,
                "status": "Active" if is_active else "Invited",
                "is_setup_complete": m.is_setup_complete,
                "profile_picture": m.profile_picture.url if m.profile_picture else None,
                "department": m.department.name if m.department else "",
                "department_name": m.department.name if m.department else ""
            })

        return Response(data)

    def post(self, request):
        if not self.check_admin_access(request):
            return Response({"error": "Permission denied"}, status=403)

        email = request.data.get('email')
        role = request.data.get('role', 'STAFF')
        action = request.data.get('action') 
        full_name = request.data.get('full_name', '').strip() # <--- NEW: Get the name
        
        if not email:
            return Response({"error": "Email is required"}, status=400)

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
            
            # --- FIXED: Save the name when creating the user ---
            new_user = User.objects.create(
                username=email, 
                email=email,
                first_name=full_name[:30] 
            )
            new_user.set_unusable_password()
            new_user.save()

        try:
            profile, created = UserProfile.objects.get_or_create(user=new_user)
            admin_org = request.user.profile.organization
            
            profile.organization = admin_org
            profile.role = role
            profile.is_setup_complete = True 
            profile.save()

            try:
                login_url = "http://localhost:5173/login" 
                sender_name = request.user.get_full_name()
                if not sender_name:
                    sender_name = "The Administrator"

                # --- NEW: Personalize the email ---
                greeting_name = full_name if full_name else "there"

                subject = f"You're invited to join {admin_org.name} on EduSphere"
                plain_message = (
                    f"Hello {greeting_name},\n\n"
                    f"{sender_name} has invited you to join the staff at {admin_org.name} as a {role}.\n\n"
                    f"Click here to get started: {login_url}\n\n"
                    f"Welcome to the team!"
                )

                html_message = f"""
                <!DOCTYPE html>
                <html>
                <body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9;">
                    <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to EduSphere</h1>
                        </div>
                        <div style="padding: 40px 30px; text-align: center; color: #333333;">
                            <h2 style="color: #1e1b4b; margin-top: 0;">Hello {greeting_name}, you've been invited!</h2>
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
        
        
    def delete(self, request):
        if not self.check_admin_access(request):
            return Response({"error": "Permission denied"}, status=403)

        user_id = request.GET.get('id') or request.data.get('id')
        try:
            if int(user_id) == request.user.id:
                return Response({"error": "You cannot delete yourself."}, status=400)

            target_user = User.objects.get(id=user_id)
            if hasattr(target_user, 'profile') and target_user.profile.organization:
                if target_user.profile.organization != request.user.profile.organization:
                    return Response({"error": "User belongs to another organization"}, status=403)

            target_user.delete()
            return Response({"message": "User removed successfully"})

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
        
class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # 1. Safety net: Guarantee profile exists for fresh Google Logins
        profile, created = UserProfile.objects.get_or_create(user=user)
            
        org = profile.organization
        dept = profile.department

        return Response({
            "id": user.id,
            "name": user.get_full_name() or user.email.split('@')[0],
            "email": user.email,
            
            # 2. FIXED: Send raw role code so frontend logic doesn't break
            "role": profile.role, 
            "role_display": profile.get_role_display(), 
            "role_code": profile.role,
            
            "organization": org.name if org else "No Campus",
            "location": org.address if org else "",
            "designation": profile.designation or "Staff Member",
            "org_type": org.type if org else "Institute",
            "is_setup_complete": profile.is_setup_complete,
            "is_teaching_faculty": profile.is_teaching_faculty ,
            "has_usable_password": user.has_usable_password(),
            
            
            "requires_password_setup": not user.has_usable_password(),
            
            "department_id": dept.id if dept else None,
            "department_name": dept.name if dept else None,
            "department_code": dept.code if dept else None
        })
    

class StudentUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        ay_id = request.data.get('academic_year')
        semester = request.data.get('semester') 
        
        if not file_obj:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = request.user.profile
            org = profile.organization
            department = profile.department
        except AttributeError:
            return Response({"error": "User profile not found."}, status=status.HTTP_400_BAD_REQUEST)

        academic_year_obj = None
        if ay_id:
            try:
                academic_year_obj = AcademicYear.objects.get(id=ay_id, organization=org)
            except AcademicYear.DoesNotExist:
                pass

        import_log = DataImportLog.objects.create(
            organization=org,
            academic_year=academic_year_obj,
            uploaded_by=profile,
            file_name=file_obj.name,
            import_type='STUDENT_REGISTRATION',
            status='PENDING'
        )

        try:
            service = StudentIngestionService(
                file=file_obj,
                organization=org,
                department=department,
                academic_year=academic_year_obj, 
                semester=semester
            )
            
            result = service.process()
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
            ay_obj = None
            if ay_val:
                if str(ay_val).isdigit():
                    ay_obj = AcademicYear.objects.filter(id=ay_val, organization=org).first()
                else:
                    ay_obj = AcademicYear.objects.filter(name=ay_val, organization=org).first()

            log = DataImportLog.objects.create(
                organization=org,
                uploaded_by=request.user.profile,
                academic_year=ay_obj, 
                file_name=file_obj.name,
                file=file_obj,
                import_type='STUDENT_REGISTRATION',
                status='PENDING'
            )

            service = StudentIngestionService(log.id)
            if not service.load_and_validate_schema():
                return Response({
                    "status": "schema_error", 
                    "errors": service.validation_report["schema_errors"]
                }, status=400)

            report = service.validate_data()

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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def commit_upload(request):
    log_id = request.data.get('log_id')
    mode = request.data.get('mode') 
    dept_id = request.data.get('department_id') # <-- NEW
    semester = request.data.get('semester')     # <-- NEW
    
    try:
        # Pass the UI context directly into the ingestion engine
        service = StudentIngestionService(
            import_log_id=log_id, 
            target_department_id=dept_id, 
            target_semester=semester
        )
        
        if mode == 'PARTIAL':
            count = service.commit_data(partial=True)
            return Response({"status": "success", "message": f"Successfully imported {count} valid records. Errors were skipped."})
        else:
            count = service.commit_data(partial=False)
            return Response({"status": "success", "message": f"Successfully imported all {count} records."})
            
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


class CheckDuplicateUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        filename = request.data.get('filename')
        ay_val = request.data.get('academic_year')
        org = request.user.profile.organization
        
        ay_obj = None
        if ay_val:
            if str(ay_val).isdigit():
                ay_obj = AcademicYear.objects.filter(id=ay_val, organization=org).first()
            else:
                ay_obj = AcademicYear.objects.filter(name=ay_val, organization=org).first()

        exists = DataImportLog.objects.filter(
            organization=org,
            academic_year=ay_obj,
            file_name=filename,
            status__in=['SUCCESS', 'PARTIAL_SUCCESS']
        ).exists()
        
        return Response({'exists': exists})


class FacultyManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated] 
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN', 'COUNSELLOR']
        target_dept_id = request.headers.get('X-Department-Id')
        is_global = request.GET.get('global') == 'true' 
        
        faculties = UserProfile.objects.filter(
            Q(role__in=['FACULTY', 'HOD', 'SPORTS_STAFF', 'COUNSELLOR']) | Q(is_teaching_faculty=True),
            user__is_active=True,
            organization=user_profile.organization
        ).select_related('user', 'department')
        
        if is_global:
            # Allocation Matrix: Bypass sandbox to assign external faculty
            pass 
        elif not is_admin:
            if not user_profile.department:
                return Response([])
            # HOD Registry: Show home faculty + external faculty teaching in this dept
            faculties = faculties.filter(
                Q(department=user_profile.department) | 
                Q(allocations__subject__department=user_profile.department)
            ).distinct()
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
                
                target_dept_id = data['department_id']
                if request.user.profile.role == 'HOD' and str(target_dept_id) != str(request.user.profile.department.id):
                    return Response({"error": "HODs can only assign faculty to their own department."}, status=403)

                dept = Department.objects.get(id=target_dept_id, organization=org)

                with transaction.atomic():
                    # --- VULNERABILITY FIX: Prevent Overwriting Existing Users ---
                    if User.objects.filter(email=data['email']).exists():
                        return Response({"error": "A user with this email already exists!"}, status=400)
                    
                    user = User.objects.create(
                        username=data['email'],
                        email=data['email'], 
                        first_name=data['full_name'], 
                        is_active=True
                    )
                    user.set_unusable_password()
                    user.save()

                    profile, profile_created = UserProfile.objects.get_or_create(user=user)
                    
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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        profile_id = request.GET.get('id')
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                profile = UserProfile.objects.get(id=profile_id, organization=user_profile.organization)
            else:
                profile = UserProfile.objects.get(id=profile_id, department=user_profile.department)
            
            full_name = request.data.get('full_name')
            if full_name:
                profile.user.first_name = full_name
                profile.user.save()
            
            if 'role' in request.data and user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                profile.role = request.data['role']
            if 'department_id' in request.data and user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                dept = Department.objects.get(id=request.data['department_id'], organization=profile.organization)
                profile.department = dept
                
            if 'designation' in request.data:
                profile.designation = request.data['designation']
            if 'phone_number' in request.data:
                profile.phone_number = request.data['phone_number']
                
            if 'profile_picture' in request.FILES:
                profile.profile_picture = request.FILES['profile_picture']
            elif 'remove_picture' in request.data and request.data['remove_picture'] == 'true':
                profile.profile_picture = None
                
            if 'role' in request.data:
                if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                    profile.role = request.data['role']
    # If role isn't in request.data, it remains unchanged in the DB

            profile.save()
            from core.serializers import FacultySerializer
            return Response(FacultySerializer(profile).data)

        except UserProfile.DoesNotExist:
            return Response({"error": "Faculty not found or not in your department"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
            
    def delete(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        profile_id = request.GET.get('id')
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                target_profile = UserProfile.objects.get(id=profile_id, organization=user_profile.organization)
            else:
                target_profile = UserProfile.objects.get(id=profile_id, department=user_profile.department)
            
            if target_profile.user.id == request.user.id:
                return Response({"error": "You cannot delete your own account!"}, status=400)
            
            target_profile.user.is_active = False
            target_profile.user.save()
            return Response({"message": "Faculty deactivated successfully"})

        except UserProfile.DoesNotExist:
            return Response({"error": "Faculty not found or not in your department"}, status=404)


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
            if dept.userprofile_set.exists() or dept.course_set.exists():
                return Response({"error": "Cannot delete a department that contains staff or subjects."}, status=400)
                
            dept.delete()
            return Response({"message": "Department deleted successfully"})
        except Department.DoesNotExist:
            return Response({"error": "Department not found"}, status=404)


class SubjectCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        courses = Course.objects.filter(department__organization=user_profile.organization)
        
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
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        target_dept_id = request.headers.get('X-Department-Id')
        
        if target_dept_id == 'ALL':
            return Response({"error": "Please select a specific department from the Topbar to create a subject."}, status=400)

        data = request.data.copy()
        
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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        course_id = request.data.get('id')
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                course = Course.objects.get(id=course_id, department__organization=user_profile.organization)
            else:
                course = Course.objects.get(id=course_id, department=user_profile.department)
                
            serializer = CourseSerializer(course, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)

    def delete(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        course_id = request.GET.get('id')
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                course = Course.objects.get(id=course_id, department__organization=user_profile.organization)
            else:
                course = Course.objects.get(id=course_id, department=user_profile.department)
            
            if TeachingAllocation.objects.filter(subject=course).exists():
                return Response({
                    "error": "Cannot delete this subject because it is already allocated to a teacher. Remove the allocation first."
                }, status=400)
                
            course.delete()
            return Response({"message": "Subject deleted successfully"})
            
        except Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=404)


class StudentDirectoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        students = Student.objects.filter(organization=user_profile.organization)
        
        if not is_admin:
            if not user_profile.department:
                return Response({"error": "You are not assigned to a department"}, status=400)
            students = students.filter(department=user_profile.department)
        elif target_dept_id and target_dept_id != 'ALL':
            students = students.filter(department_id=target_dept_id)

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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        student_ids = request.data.get('student_ids', [])
        new_sem = request.data.get('new_semester')
        target_ay_id = request.data.get('academic_year_id') 
        
        if not student_ids or not new_sem:
            return Response({"error": "Missing student IDs or target semester"}, status=400)
            
        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            students = Student.objects.filter(id__in=student_ids, organization=user_profile.organization)
        else:
            students = Student.objects.filter(id__in=student_ids, department=user_profile.department)
        
        update_data = {'current_semester': new_sem}
        if target_ay_id:
            update_data['academic_year_id'] = target_ay_id
            
        students.update(**update_data)
        return Response({"message": f"Successfully promoted/demoted {len(student_ids)} students."})
    
import math
import string

class StudentGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        target_dept_id = request.headers.get('X-Department-Id')
        
        groups = StudentGroup.objects.filter(department__organization=user_profile.organization)

        if not is_admin:
            if not user_profile.department:
                return Response([])
            groups = groups.filter(department=user_profile.department)
        elif target_dept_id and target_dept_id != 'ALL':
            groups = groups.filter(department_id=target_dept_id)

        ay_id = request.query_params.get('academic_year') or request.GET.get('academic_year')
        if ay_id:
            groups = groups.filter(academic_year_id=ay_id)
            
        # --- SMART TERM FILTERING ---
        term = request.headers.get('X-Term', 'ODD')
        valid_sems = [1, 3, 5, 7, 9] if term == 'ODD' else [2, 4, 6, 8, 10]
        
        semester = request.query_params.get('semester') or request.GET.get('semester')
        if semester:
            groups = groups.filter(semester=semester)
        else:
            # If no specific semester requested, only show groups for the active term!
            groups = groups.filter(semester__in=valid_sems)

        # Order by semester, then by parent-child relationship so Batches appear under their Master Class
        groups = groups.order_by('semester', 'parent_group_id', 'name')
        return Response(StudentGroupSerializer(groups, many=True).data)

    def post(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        target_dept_id = request.headers.get('X-Department-Id')
        
        if target_dept_id == 'ALL':
            return Response({"error": "Please select a specific department from the Topbar to create a batch."}, status=400)

        data = request.data.copy()
        
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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        group_id = request.data.get('id')
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                group = StudentGroup.objects.get(id=group_id, department__organization=user_profile.organization)
            else:
                group = StudentGroup.objects.get(id=group_id, department=user_profile.department)
                
            serializer = StudentGroupSerializer(group, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=400)
        except StudentGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)

    def patch(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        group_id = request.data.get('group_id')
        action = request.data.get('action') 
        student_ids = request.data.get('student_ids', [])
        
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                group = StudentGroup.objects.get(id=group_id, department__organization=user_profile.organization)
            else:
                group = StudentGroup.objects.get(id=group_id, department=user_profile.department)
            
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
        user_profile = request.user.profile
        
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        group_id = request.GET.get('id')
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                group = StudentGroup.objects.get(id=group_id, department__organization=user_profile.organization)
            else:
                group = StudentGroup.objects.get(id=group_id, department=user_profile.department)
            group.delete()
            return Response({"message": "Group deleted successfully"})
        except StudentGroup.DoesNotExist:
            return Response({"error": "Group not found"}, status=404)


# ====================================================================
# NEW: SMART BATCHING ENGINES
# ====================================================================
class AutoGenerateClassGroupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        ay_id = request.data.get('academic_year_id')
        semester = int(request.data.get('semester'))
        subject_id = request.data.get('subject_id')

        if not all([ay_id, semester, subject_id]):
            return Response({"error": "Academic Year, Semester, and Subject are required."}, status=400)

        # ---> FIX: Properly intercept the 'ALL' string before querying the DB
        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            target_dept_id = request.headers.get('X-Department-Id')
            if not target_dept_id or target_dept_id == 'ALL':
                return Response({"error": "Please select a specific department from the Topbar to generate classes."}, status=400)
            
            try:
                dept = Department.objects.get(id=target_dept_id, organization=user_profile.organization)
            except Department.DoesNotExist:
                return Response({"error": "Department not found."}, status=404)
        else:
            dept = user_profile.department

        try:
            subject = Course.objects.get(id=subject_id)
            
            students = Student.objects.filter(
                department=dept, current_semester=semester, is_active=True
            ).filter(Q(academic_year_id=ay_id) | Q(studentgroup__academic_year_id=ay_id)).distinct()

            if not students.exists():
                return Response({"error": f"No active students found in Semester {semester}."}, status=404)

            # Calculate Year Level Abbreviation
            if semester in [1, 2]: yl = "FE"
            elif semester in [3, 4]: yl = "SE"
            elif semester in [5, 6]: yl = "TE"
            elif semester in [7, 8]: yl = "BE"
            else: yl = f"Sem{semester}"

            # Auto-Generate Name: e.g., "BE ECS: Database Systems"
            group_name = f"{yl} {dept.code}: {subject.name}"

            with transaction.atomic():
                group, created = StudentGroup.objects.get_or_create(
                    academic_year_id=ay_id,
                    department=dept,
                    subject=subject,
                    name=group_name,
                    type='CLASS',
                    semester=semester
                )
                group.students.set(students)
                
            return Response({"message": f"Created Master Class for {subject.name}", "group": StudentGroupSerializer(group).data}, status=201)
            
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AutoSplitLabBatchesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        semester = int(request.data.get('semester'))
        ay_id = request.data.get('academic_year_id')
        subject_id = request.data.get('subject_id') 
        num_batches = int(request.data.get('num_batches', 3))

        if not all([ay_id, semester, subject_id]):
            return Response({"error": "Academic Year, Semester, and Subject are required."}, status=400)

        # ---> FIX: Properly intercept the 'ALL' string before querying the DB
        if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
            target_dept_id = request.headers.get('X-Department-Id')
            if not target_dept_id or target_dept_id == 'ALL':
                return Response({"error": "Please select a specific department from the Topbar to split batches."}, status=400)
            
            try:
                dept = Department.objects.get(id=target_dept_id, organization=user_profile.organization)
            except Department.DoesNotExist:
                return Response({"error": "Department not found."}, status=404)
        else:
            dept = user_profile.department

        try:
            subject = Course.objects.get(id=subject_id)
            
            students = list(Student.objects.filter(
                department=dept, current_semester=semester, is_active=True
            ).filter(Q(academic_year_id=ay_id) | Q(studentgroup__academic_year_id=ay_id)).distinct().order_by('roll_number'))
            
            if len(students) == 0:
                return Response({"error": f"No active students to split."}, status=400)

            chunk_size = math.ceil(len(students) / num_batches)
            created_batches = []
            labels = string.ascii_uppercase 

            with transaction.atomic():
                for i in range(num_batches):
                    batch_students = students[i * chunk_size : (i + 1) * chunk_size]
                    if not batch_students: continue

                    # Auto-Generate Name: e.g., "Web Dev Lab - Batch A"
                    batch_name = f"{subject.name} - Batch {labels[i]}"
                    
                    batch = StudentGroup.objects.create(
                        academic_year_id=ay_id,
                        department=dept,
                        subject=subject,
                        name=batch_name,
                        type='BATCH',
                        semester=semester
                    )
                    batch.students.set(batch_students)
                    created_batches.append(batch)

            return Response({"message": f"Generated {len(created_batches)} batches for {subject.name}."}, status=201)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class AllocationManagerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        is_org_admin = user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']
        is_hod = user_profile.role == 'HOD'
        target_dept_id = request.headers.get('X-Department-Id')
        
        # --- NEW: Catch the Term Header ---
        term = request.headers.get('X-Term', 'ODD')
        
        ay_id = request.GET.get('academic_year')
        faculty_id = request.GET.get('faculty_id') 
        
        if faculty_id == 'undefined':
            faculty_id = None
        
        allocations = TeachingAllocation.objects.filter(
            subject__department__organization=user_profile.organization,
            academic_year_id=ay_id
        )
        
        if is_org_admin:
            if target_dept_id and target_dept_id != 'ALL':
                allocations = allocations.filter(subject__department_id=target_dept_id)
        elif is_hod:
            if user_profile.department:
                if faculty_id:
                     try:
                         target_faculty = UserProfile.objects.get(id=faculty_id)
                         if target_faculty.department != user_profile.department:
                             allocations = allocations.filter(subject__department=user_profile.department)
                     except UserProfile.DoesNotExist:
                         pass
                else:
                    allocations = allocations.filter(
                        Q(subject__department=user_profile.department) | Q(faculty=user_profile)
                    ).distinct()
            else:
                allocations = allocations.filter(faculty=user_profile)
        else:
            allocations = allocations.filter(faculty=user_profile)
            
        if faculty_id: 
            allocations = allocations.filter(faculty_id=faculty_id)
            
        # --- NEW: SMART TERM FILTERING ---
        from django.db.models import F
        allocations = allocations.annotate(sem_parity=F('subject__semester') % 2)
        if term == 'ODD':
            allocations = allocations.filter(sem_parity=1)
        else:
            allocations = allocations.filter(sem_parity=0)
            
        return Response(TeachingAllocationSerializer(allocations, many=True).data)

    def post(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        ay_id = request.data.get('academic_year')
        faculty_id = request.data.get('faculty_id')
        subject_id = request.data.get('subject_id')
        group_ids = request.data.get('student_group_ids', []) 
        
        if not all([ay_id, faculty_id, subject_id, group_ids]):
            return Response({"error": "Missing required fields"}, status=400)

        # --- NEW STRICT SANDBOX CHECK ---
        if user_profile.role == 'HOD':
            try:
                subject = Course.objects.get(id=subject_id)
                if subject.department != user_profile.department:
                    return Response({"error": "You can only assign teachers to subjects within your own department."}, status=403)
            except Course.DoesNotExist:
                return Response({"error": "Subject not found."}, status=404)
        # --------------------------------

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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        allocation_id = request.GET.get('id')
        try:
            allocation = TeachingAllocation.objects.get(id=allocation_id)
            
            # --- NEW STRICT SANDBOX CHECK ---
            if user_profile.role == 'HOD' and allocation.subject.department != user_profile.department:
                return Response({"error": "You cannot delete allocations outside your department."}, status=403)
            # --------------------------------
            
            allocation.delete()
            return Response({"message": "Allocation removed"})
        except TeachingAllocation.DoesNotExist:
            return Response({"error": "Not found"}, status=404)
        
class MyClassesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            allocations = TeachingAllocation.objects.filter(
                faculty=request.user.profile,
                academic_year__is_active=True
            ).order_by('subject__semester', 'subject__name')
            
            return Response(TeachingAllocationSerializer(allocations, many=True).data)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = '__all__'

class AcademicYearView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        org = request.user.profile.organization
        years = AcademicYear.objects.filter(organization=org).order_by('-start_date')
        return Response(AcademicYearSerializer(years, many=True).data)

    def post(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        data = request.data.copy()
        data['organization'] = request.user.profile.organization.id
        
        serializer = AcademicYearSerializer(data=data)
        if serializer.is_valid():
            if serializer.validated_data.get('is_active', False):
                AcademicYear.objects.filter(organization=request.user.profile.organization).update(is_active=False)
            
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def put(self, request):
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        ay_id = request.data.get('id')
        try:
            year = AcademicYear.objects.get(id=ay_id, organization=request.user.profile.organization)
            
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
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)
            
        ay_id = request.GET.get('year_id')
        if not ay_id:
            return Response({"error": "Year ID is required"}, status=400)

        groups = StudentGroup.objects.filter(academic_year_id=ay_id)
        sem_data = groups.values('semester').annotate(batch_count=Count('id')).order_by('semester')
        
        total_students = groups.aggregate(total=Count('students', distinct=True))['total'] or 0

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
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)
            
        try:
            if user_profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                student = Student.objects.get(id=pk, organization=user_profile.organization)
            else:
                student = Student.objects.get(id=pk, department=user_profile.department)
                
            student.is_active = not student.is_active
            student.save()
            status_text = "Activated" if student.is_active else "Deactivated"
            return Response({'message': f'Student successfully {status_text}', 'is_active': student.is_active})
        except Student.DoesNotExist:
            return Response({"error": "Student not found"}, status=404)

class ToggleTeachingRoleView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        profile = request.user.profile
        if profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Only Admins can toggle this."}, status=403)
            
        profile.is_teaching_faculty = not profile.is_teaching_faculty
        profile.save()
        status_text = "Added to" if profile.is_teaching_faculty else "Removed from"
        return Response({"message": f"Successfully {status_text} the Faculty Registry.", "is_teaching_faculty": profile.is_teaching_faculty})
    
    
    
    
class StudentAccountManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.profile.role
        if user_role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Access Denied."}, status=403)
        
        org = request.user.profile.organization
        
        # Optimized with select_related to prevent N+1 queries
        students = Student.objects.filter(organization=org, is_active=True).select_related('user', 'department')
        
        # Sandbox: HODs only see their department. Admins see the filter.
        if user_role == 'HOD':
            students = students.filter(department=request.user.profile.department)
        else:
            target_dept_id = request.headers.get('X-Department-Id')
            if target_dept_id and target_dept_id != 'ALL':
                students = students.filter(department_id=target_dept_id)

        audit_data = []
        dept_breakdown = {}
        total_students = 0
        created_accounts = 0

        for s in students:
            total_students += 1
            has_account = bool(s.user)
            if has_account:
                created_accounts += 1

            # Aggregate Department Stats
            dept_code = s.department.code if s.department else "N/A"
            if dept_code not in dept_breakdown:
                dept_breakdown[dept_code] = {"total": 0, "created": 0}
            
            dept_breakdown[dept_code]["total"] += 1
            if has_account:
                dept_breakdown[dept_code]["created"] += 1

            # Predict email
            predicted_email = f"{s.roll_number.lower().strip()}@{org.student_email_domain}" if org.student_email_domain else "Domain not set"
            
            # Determine specific status
            if has_account:
                if s.user.last_login:
                    status_label = "Active"
                else:
                    status_label = "Never Logged In"
            else:
                status_label = "Pending"

            # Determine Year Level
            sem = s.current_semester
            if sem in [1, 2]: yl = "FE"
            elif sem in [3, 4]: yl = "SE"
            elif sem in [5, 6]: yl = "TE"
            elif sem in [7, 8]: yl = "BE"
            else: yl = "Alumni"

            audit_data.append({
                "id": s.id,
                "roll_number": s.roll_number,
                "name": s.full_name,
                "email": s.user.email if has_account else predicted_email,
                "status": status_label,
                "department": dept_code,
                "year_level": yl,
                "has_dob": bool(s.dob)
            })

        return Response({
            "domain": org.student_email_domain or "",
            "stats": {
                "total": total_students,
                "created": created_accounts,
                "pending": total_students - created_accounts,
                "departments": dept_breakdown
            },
            "students": audit_data
        })

    def post(self, request):
        user_profile = request.user.profile
        if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN', 'HOD']:
            return Response({"error": "Permission denied"}, status=403)

        action = request.data.get('action')
        org = user_profile.organization

        # -------------------------------------------------------------
        # ACTION 1: UPDATE DOMAIN (Protected by Password)
        # -------------------------------------------------------------
        if action == 'update_domain':
            if user_profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
                return Response({"error": "Only Organization Admins can change the domain."}, status=403)

            new_domain = request.data.get('domain')
            password = request.data.get('password')

            if not new_domain or not password:
                return Response({"error": "Domain and password are required."}, status=400)

            if not request.user.check_password(password):
                return Response({"error": "Incorrect password. Domain update aborted."}, status=403)

            # Clean the domain input
            new_domain = new_domain.replace('@', '').strip().lower()
            org.student_email_domain = new_domain
            org.save()

            return Response({"message": f"Domain successfully updated to @{new_domain}", "domain": org.student_email_domain})

        # -------------------------------------------------------------
        # ACTION 2: BULK GENERATE STUDENT ACCOUNTS
        # -------------------------------------------------------------
        elif action == 'generate_accounts':
            if not org.student_email_domain:
                return Response({"error": "Please configure the Organization Email Domain first."}, status=400)

            # Find all students missing a user account
            students = Student.objects.filter(organization=org, is_active=True, user__isnull=True)
            
            if user_profile.role == 'HOD':
                students = students.filter(department=user_profile.department)
            else:
                target_dept_id = request.headers.get('X-Department-Id')
                if target_dept_id and target_dept_id != 'ALL':
                    students = students.filter(department_id=target_dept_id)

            if not students.exists():
                return Response({"message": "No pending accounts to generate!"})

            generated_count = 0
            errors = []

            for student in students:
                email = f"{student.roll_number.lower().strip()}@{org.student_email_domain}"
                
                # Generate Password: DOB if exists (DDMMYYYY), else Roll@123
                if student.dob:
                    default_password = student.dob.strftime('%d%m%Y')
                else:
                    default_password = f"{student.roll_number.strip()}@123"

                try:
                    with transaction.atomic():
                        # Prevent duplicate email crashes
                        if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
                            errors.append(f"Email {email} is already in use.")
                            continue

                        # Extract basic first/last name
                        name_parts = student.full_name.split()
                        first_name = name_parts[0][:30]
                        last_name = " ".join(name_parts[1:])[:30] if len(name_parts) > 1 else ""

                        new_user = User.objects.create_user(
                            username=email,
                            email=email,
                            password=default_password,
                            first_name=first_name,
                            last_name=last_name
                        )

                    
                        # Set up the UserProfile as a STUDENT
                        profile, _ = UserProfile.objects.get_or_create(user=new_user)
                        profile.role = 'STUDENT'
                        profile.organization = org
                        profile.department = student.department
                        profile.is_setup_complete = False # <-- FLAG FOR FORCED PASSWORD RESET
                        profile.save()

                        # Link back to the Student record
                        student.user = new_user
                        student.email = email
                        student.save()

                        generated_count += 1
                except Exception as e:
                    errors.append(f"Failed for {student.roll_number}: {str(e)}")

            return Response({
                "message": f"Successfully generated {generated_count} accounts.",
                "errors": errors
            })

        return Response({"error": "Invalid action."}, status=400)
    
    


from django.utils import timezone 

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        notifs = Notification.objects.filter(recipient=request.user).order_by('-created_at')[:20]
        data = [{
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "action_url": n.action_url,
            "is_read": n.is_read,
            # FIXED: Converts UTC to your system's Local Time Zone
            "created_at": timezone.localtime(n.created_at).strftime("%b %d, %I:%M %p")
        } for n in notifs]
        return Response(data)

class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, notif_id):
        try:
            notif = Notification.objects.get(id=notif_id, recipient=request.user)
            notif.is_read = True
            notif.save()
            return Response({"success": True})
        except Notification.DoesNotExist:
            return Response({"error": "Not found"}, status=404)
        
        
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class UploadSchemaView(APIView):
    """
    Returns the exact column headers expected by the ECS pipeline
    so the frontend can generate dynamic templates.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category = request.query_params.get('category', 'STUDENTS').upper()
        
        if category == 'STUDENTS':
            from core.ingestion.ecs_pipeline.students import ECS_STUDENT_MAPPING, OPTIONAL_MAPPING
            return Response({
                "mandatory": list(ECS_STUDENT_MAPPING.keys()),
                "optional": list(OPTIONAL_MAPPING.keys())
            })
        elif category == 'FEES':
            # Placeholder for your fees mapping
            return Response({
                "mandatory": ["ENROLLMENT NO", "RECEIPT NO", "AMOUNT", "DATE", "PAYMENT MODE", "REMARKS"],
                "optional": []
            })
            
        return Response({"error": "Unknown category"}, status=400)