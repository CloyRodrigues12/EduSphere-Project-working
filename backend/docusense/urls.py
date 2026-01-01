# backend/docusense/urls.py
from django.urls import path
from .views import DocumentUploadView, DocumentDetailView
from .views import DocumentUploadView, DocumentDetailView, DocumentDownloadView

urlpatterns = [
    path('upload/', DocumentUploadView.as_view(), name='doc_upload'),
    path('status/<int:doc_id>/', DocumentDetailView.as_view(), name='doc_status'),
    path('download/<int:doc_id>/', DocumentDownloadView.as_view(), name='doc_download'),
]