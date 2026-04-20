import requests
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class ChatBotConverseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_message = request.data.get('message')
        if not user_message:
            return Response({"error": "Message is required"}, status=400)

        # 1. Identify the User and Role
        user = request.user
        profile = getattr(user, 'profile', None)
        
        user_name = user.get_full_name() or user.username
        role = profile.role if profile else "STUDENT"
        
        # 2. Craft the Dynamic System Prompt
        system_prompt = f"""
        You are EduBot, the official AI assistant for the EduSphere College Management System.
        
        Current User Info:
        - Name: {user_name}
        - Role: {role}
        
        CRITICAL RULES YOU MUST FOLLOW:
        1. KEEP RESPONSES EXTREMELY SHORT. Maximum 2 to 3 sentences. Be direct and concise.
        2. DO NOT hallucinate features. We DO NOT have a mobile app yet. Do not mention one.
        3. DO NOT invent specific click-paths or menu names unless you are absolutely sure. If you don't know the exact path, tell them to check the left sidebar navigation.
        4. If a user asks a highly specific data question (like "How many females are in the institute?"), explain clearly that you do not have direct database access to fetch sensitive demographic numbers yet.
        5. Format your text cleanly using markdown and appropriate emojis.
        
        Role specific behavior:
        - STUDENT: Be encouraging.
        - FACULTY: Be professional.
        - ADMIN/HOD: Be analytical.
        """

        # 3. Send the conversation to local Ollama
        try:
            ollama_payload = {
                "model": "llama3.1", # Change to "phi3" if you downloaded that instead
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                "stream": False
            }
            
            response = requests.post("http://localhost:11434/api/chat", json=ollama_payload)
            response.raise_for_status()
            
            ai_reply = response.json().get("message", {}).get("content", "")
            
            return Response({"reply": ai_reply})
            
        except requests.exceptions.RequestException as e:
            print(f"Ollama Connection Error: {e}")
            return Response(
                {"reply": "I'm having trouble connecting to my AI core. Make sure Ollama is running locally!"}, 
                status=503
            )