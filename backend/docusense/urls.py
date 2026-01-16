from django.urls import path
from .views import DocumentUploadView, DocumentDetailView, ExcelDownloadView

urlpatterns = [
    path('upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('status/<int:doc_id>/', DocumentDetailView.as_view(), name='document-detail'),
    path('download/<int:doc_id>/', ExcelDownloadView.as_view(), name='document-download'),
]