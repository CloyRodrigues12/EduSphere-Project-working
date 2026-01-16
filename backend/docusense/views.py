from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import permissions, status
from django.http import HttpResponse, FileResponse
import os
from django.conf import settings
from .models import AcademicDocument
from .serializers import AcademicDocumentSerializer
from .services import trigger_analysis_background

class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        docs = AcademicDocument.objects.filter(uploaded_by=request.user.profile).order_by('-upload_date')
        serializer = AcademicDocumentSerializer(docs, many=True)
        return Response(serializer.data)

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file provided"}, status=400)

        doc = AcademicDocument.objects.create(
            uploaded_by=request.user.profile,
            file=file_obj,
            filename=file_obj.name,
            status='PENDING'
        )
        
        trigger_analysis_background(doc.id)
        return Response(AcademicDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

class DocumentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, doc_id):
        try:
            doc = AcademicDocument.objects.get(id=doc_id, uploaded_by=request.user.profile)
            return Response(AcademicDocumentSerializer(doc).data)
        except AcademicDocument.DoesNotExist:
            return Response({"error": "Document not found"}, status=404)

class ExcelDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, doc_id):
        try:
            doc = AcademicDocument.objects.get(id=doc_id, uploaded_by=request.user.profile)
            
            if not doc.analysis_data or 'excel_path' not in doc.analysis_data:
                return Response({"error": "Excel not generated yet."}, status=400)

            # Construct full path
            relative_path = doc.analysis_data['excel_path']
            full_path = os.path.join(settings.MEDIA_ROOT, relative_path)
            
            if os.path.exists(full_path):
                f = open(full_path, 'rb')
                response = FileResponse(f)
                response['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                response['Content-Disposition'] = f'attachment; filename="{os.path.basename(full_path)}"'
                return response
            else:
                return Response({"error": "File missing on server."}, status=404)

        except AcademicDocument.DoesNotExist:
            return Response({"error": "Document not found"}, status=404)