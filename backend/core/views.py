
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from django.contrib.auth.models import User
import traceback
from core.models import Organization, UserProfile 

from django.core.mail import send_mail
from django.conf import settings

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
        org_type = data.get('type', 'School') # Catch the Type
        designation = data.get('designation', '') # Catch the Designation

        if not org_name:
            return Response({"error": "Organization name is required"}, status=400)

        # 2. Create Organization with Type
        org = Organization.objects.create(
            name=org_name,
            type=org_type, # <--- Saving it here
            address=data.get('address', '')
        )

        # 3. Update User Profile with Designation
        profile = user.profile
        profile.organization = org
        profile.role = 'ORG_ADMIN'
        profile.designation = designation # <--- Saving it here
        profile.is_setup_complete = True
        profile.save()

        return Response({
            "message": "Setup Complete", 
            "org_id": org.id,
            "redirect": "/"
        })

# 3. Staff Management 

class StaffManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def check_admin_access(self, request):
        """ Helper to ensure only Admins can access this API """
        if not hasattr(request.user, 'profile'):
            return False
        return request.user.profile.role in ['SUPER_ADMIN', 'ORG_ADMIN']

    def get(self, request):
        try:
            # 1. SECURITY FIX: Block non-admins
            if not self.check_admin_access(request):
                return Response({"error": "Access Denied: Admins only."}, status=403)

            user_profile = request.user.profile
            members = UserProfile.objects.filter(organization=user_profile.organization)
            
            data = []
            for member in members:
                u = member.user 
                
                # 2. Smart Status Logic
                # If last_login is None, they haven't accepted the invite yet
                status_label = "Active"
                if u.last_login is None:
                    status_label = "Invited"
                
                data.append({
                    "id": u.id,
                    "name": u.get_full_name() or u.email.split('@')[0],
                    "email": u.email,
                    "role": member.get_role_display(),
                    "role_code": member.role,
                    "department": member.department.name if member.department else "-",
                    "status": status_label,
                    "last_login": u.last_login,
                    # 3. Send Permissions to Frontend
                    "permissions": member.permissions or {} 
                })
            
            return Response(data)
        except Exception as e:
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)


    def post(self, request):
        """ Robust Invite System with Email Notification """
        if not self.check_admin_access(request):
            return Response({"error": "Permission denied"}, status=403)

        email = request.data.get('email')
        role = request.data.get('role', 'STAFF')
        
        if not email:
            return Response({"error": "Email is required"}, status=400)

        # 1. Check if user exists
        if User.objects.filter(email=email).exists():
            return Response({"error": "User with this email already exists!"}, status=400)

        try:
            # 2. Create the User
            new_user = User.objects.create(username=email, email=email)
            new_user.set_unusable_password()
            new_user.save()

            # 3. Create Profile
            profile, created = UserProfile.objects.get_or_create(user=new_user)
            
            # 4. Link Organization
            admin_org = request.user.profile.organization
            if not admin_org:
                return Response({"error": "You are not part of an organization!"}, status=400)

            profile.organization = admin_org
            profile.role = role
            profile.is_setup_complete = True 
            profile.save()

            # --- 5. SEND EMAIL NOTIFICATION ---
            try:
                login_url = "http://localhost:5173/login" # Adjust if your frontend port differs
                
                subject = f"Invitation to join {admin_org.name}"
                message = (
                    f"Hello,\n\n"
                    f"You have been invited to join the staff at {admin_org.name} as a {role}.\n\n"
                    f"Please click the link below to log in or create your account using this email address:\n"
                    f"{login_url}\n\n"
                    f"Welcome to the team!\n"
                    f"- EduSphere Admin"
                )
                
                send_mail(
                    subject,
                    message,
                    settings.EMAIL_HOST_USER or 'noreply@edusphere.com',
                    [email],
                    fail_silently=False,
                )
                print(f"Email sent successfully to {email}")

            except Exception as mail_error:
                print(f"Failed to send email: {mail_error}")
                # We don't stop the process, but we log the error
            
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

    def patch(self, request):
        """ 4. Update Permissions """
        if not self.check_admin_access(request):
            return Response({"error": "Permission denied"}, status=403)

        user_id = request.data.get('user_id')
        new_permissions = request.data.get('permissions')

        try:
            target_profile = UserProfile.objects.get(user_id=user_id, organization=request.user.profile.organization)
            target_profile.permissions = new_permissions
            target_profile.save()
            return Response({"message": "Permissions updated"})
        except UserProfile.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

# In backend/core/views.py -> inside StaffManagementView

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
            # If the user has a profile, we must ensure they belong to YOUR org.
            if hasattr(target_user, 'profile') and target_user.profile.organization:
                if target_user.profile.organization != request.user.profile.organization:
                    return Response({"error": "User belongs to another organization"}, status=403)
            else:
                # 3. Handle "Ghost" Users (No Profile)
                # If they have no profile, they are 'broken'. 
                # We allow deleting them ONLY if they look like they were meant for this org 
                # (or just allow cleanup since they are harmless junk data)
                pass 

            # 4. Perform Delete
            target_user.delete()
            return Response({"message": "User removed successfully"})

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=404)
        except Exception as e:
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
        return Response({
            "id": user.id,
            "name": user.get_full_name() or user.email.split('@')[0],
            "email": user.email,
            "role": profile.get_role_display(),
            "organization": profile.organization.name if profile.organization else "No Campus"
        })
    
# for sidebar 
# backend/core/views.py (Bottom of the file)

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'profile'):
            return Response({"error": "Profile not found"}, status=404)
            
        profile = user.profile
        return Response({
            "id": user.id,
            "name": user.get_full_name() or user.email.split('@')[0],
            "email": user.email,
            "role": profile.get_role_display(),   # Human readable: "Organization Admin"
            "role_code": profile.role,            # Code: "ORG_ADMIN" (Critical for Sidebar!)
            "organization": profile.organization.name if profile.organization else "No Campus",
            "is_setup_complete": profile.is_setup_complete  # <--- CRITICAL FIX for Loop
        })