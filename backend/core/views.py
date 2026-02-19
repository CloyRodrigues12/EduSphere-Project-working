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

# 1. Google Login
class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173"
    client_class = OAuth2Client

# 2. Setup Organization
class SetupOrganizationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data
        
        # 1. Prevent duplicate setup
        if hasattr(user, 'profile') and user.profile.organization:
            return Response({"error": "Organization already exists."}, status=400)

        org_name = data.get('name')
        org_type = data.get('type', 'School')
        designation = data.get('designation', '')

        if not org_name:
            return Response({"error": "Organization name is required"}, status=400)

        # 2. Create Organization with Type
        org = Organization.objects.create(
            name=org_name,
            type=org_type, 
            address=data.get('address', '')
        )

        # 3. Update User Profile with Designation
        profile = user.profile
        profile.organization = org
        profile.role = 'ORG_ADMIN'
        profile.designation = designation 
        profile.is_setup_complete = True
        profile.save()

        return Response({
            "message": "Setup Complete", 
            "org_id": org.id,
            "redirect": "/"
        })

# 3. Staff Management 

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
                role__in=['STAFF', 'ORG_ADMIN'] # Only fetch Staff/Admins, not Faculty
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
        
# 4. Current User (Topbar)
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
            "organization": profile.organization.name if profile.organization else "No Campus",
            "designation": profile.designation or "Staff Member", 
            "location": org.address if org else "",
            "org_type": org.type if org else "Institute",       
            "is_setup_complete": profile.is_setup_complete
        })
    
#For sidebar

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
            "is_setup_complete": profile.is_setup_complete
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
        # List all FACULTY members for this organization
        # Filter by the logged-in user's organization to ensure multi-tenancy safety
        org = request.user.profile.organization
        
        faculty_profiles = UserProfile.objects.filter(
            organization=org,
            role='FACULTY'
        ).select_related('user', 'department')
        
        serializer = FacultySerializer(faculty_profiles, many=True)
        return Response(serializer.data)

    def post(self, request):
        """ Add a new Faculty member to the Registry """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)

        serializer = AddFacultySerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            try:
                # 1. Define 'org' and 'dept' before using them!
                org = request.user.profile.organization
                dept = Department.objects.get(id=data['department_id'], organization=org)

                with transaction.atomic():
                    # 2. Create or Get User
                    user, created = User.objects.get_or_create(
                        username=data['email'],
                        defaults={'email': data['email'], 'first_name': data['full_name'], 'is_active': True}
                    )
                    
                    # 3. Create or Get Profile
                    profile, profile_created = UserProfile.objects.get_or_create(user=user)
                    
                    # 🚨 SECURITY FIX: Prevent Admins from downgrading themselves
                    if not profile_created and profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']:
                        return Response({
                            "error": "This email belongs to an Admin. You cannot overwrite an Admin account into a Faculty account."
                        }, status=400)

                    # 4. Save Faculty Data
                    profile.role = 'FACULTY'
                    profile.organization = org
                    profile.department = dept
                    profile.designation = data['designation']
                    profile.phone_number = data.get('phone_number', '')
                    
                    if 'profile_picture' in request.FILES:
                        profile.profile_picture = request.FILES['profile_picture']
                        
                    profile.save()

                    return Response(
                        FacultySerializer(profile).data, 
                        status=status.HTTP_201_CREATED
                    )

            except Department.DoesNotExist:
                return Response({"error": "Invalid Department ID"}, status=400)
            except Exception as e:
                return Response({"error": str(e)}, status=500)
        
        return Response(serializer.errors, status=400)
    
    def patch(self, request):
        """ Edit a Faculty Member """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)

        profile_id = request.GET.get('id')
        try:
            profile = UserProfile.objects.get(
                id=profile_id, 
                organization=request.user.profile.organization,
                role='FACULTY'
            )
            
            # Update User Base Name
            full_name = request.data.get('full_name')
            if full_name:
                profile.user.first_name = full_name
                profile.user.save()
            
            # Update Profile Details
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
            return Response(FacultySerializer(profile).data)

        except UserProfile.DoesNotExist:
            return Response({"error": "Faculty not found"}, status=404)
        except Department.DoesNotExist:
            return Response({"error": "Invalid Department ID"}, status=400)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
            
    def delete(self, request):
        """ Remove a Faculty member and their shadow account """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)

        profile_id = request.GET.get('id')
        try:
            target_profile = UserProfile.objects.get(
                id=profile_id, 
                organization=request.user.profile.organization,
                role='FACULTY'
            )
            
            # 🚨 SECURITY FIX: Prevent deleting yourself
            if target_profile.user.id == request.user.id:
                return Response({"error": "You cannot delete your own account!"}, status=400)
            
            target_profile.user.delete()
            return Response({"message": "Faculty removed successfully"})

        except UserProfile.DoesNotExist:
            return Response({"error": "Faculty not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
        
        return Response(serializer.errors, status=400)





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
# NEW: Department Dropdown Fetcher
# ==========================================
class DepartmentListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        org = request.user.profile.organization
        departments = Department.objects.filter(organization=org)
        return Response(DepartmentSerializer(departments, many=True).data)


#------------------------------------------------------------------------------------------------------------------


# ==========================================
# SUBJECT CATALOG (Phase 2)
# ==========================================
class SubjectCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ Fetch subjects for the user's department, optionally filtered by semester """
        dept = request.user.profile.department
        if not dept:
            return Response({"error": "You are not assigned to a department"}, status=400)

        semester = request.GET.get('semester')
        courses = Course.objects.filter(department=dept)
        
        if semester:
            courses = courses.filter(semester=semester)
            
        return Response(CourseSerializer(courses, many=True).data)

    def post(self, request):
        """ Create a new subject """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
            return Response({"error": "Permission denied"}, status=403)

        data = request.data.copy()
        data['department'] = request.user.profile.department.id

        serializer = CourseSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def put(self, request):
        """ Update an existing subject """
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
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
        if request.user.profile.role not in ['SUPER_ADMIN', 'ORG_ADMIN']:
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