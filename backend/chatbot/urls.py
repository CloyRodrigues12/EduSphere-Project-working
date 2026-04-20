from django.urls import path
from .views import ChatBotConverseView

urlpatterns = [
    path('converse/', ChatBotConverseView.as_view(), name='chatbot-converse'),
]