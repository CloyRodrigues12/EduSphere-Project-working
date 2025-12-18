
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


    # In backend/core/views.py

    def post(self, request):
        """ Robust Invite System with Styled Email Notification """
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

            # --- 5. PREPARE EMAIL DATA ---
            try:
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

                            <p style="margin-top: 30px; font-size: 14px; color: #9ca3af;">
                                If the button above doesn't work, verify your email at: <br/>
                                <a href="{login_url}" style="color: #4f46e5;">{login_url}</a><br/>
                                  or contact {sender_name} for assistance.
                            </p>
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
                    plain_message, # Plain text fallback
                    settings.EMAIL_HOST_USER,
                    [email],
                    fail_silently=False,
                    html_message=html_message # <--- The Styled Version
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