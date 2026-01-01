from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import permissions, status
from .models import AcademicDocument
from .serializers import AcademicDocumentSerializer
from .services import trigger_analysis_background
from django.http import HttpResponse
from .generators import generate_pdf_report




class DocumentUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser) # Necessary for File Uploads

    def get(self, request):
        """ List all documents uploaded by the current user """
        docs = AcademicDocument.objects.filter(uploaded_by=request.user.profile).order_by('-upload_date')
        serializer = AcademicDocumentSerializer(docs, many=True)
        return Response(serializer.data)

    def post(self, request):
        """ Upload and Trigger Analysis """
        # 1. Validate File
        file_obj = request.FILES.get('file')
        category = request.data.get('category', 'RESULT')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=400)

        # 2. Save to DB
        doc = AcademicDocument.objects.create(
            uploaded_by=request.user.profile,
            file=file_obj,
            filename=file_obj.name,
            category=category,
            status='PENDING'
        )

        # 3. Trigger the Service (Background)
        trigger_analysis_background(doc.id)

        # 4. Return Success
        return Response(
            AcademicDocumentSerializer(doc).data, 
            status=status.HTTP_201_CREATED
        )

class DocumentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, doc_id):
        """ Poll this to check status (PENDING -> COMPLETED) """
        try:
            doc = AcademicDocument.objects.get(id=doc_id, uploaded_by=request.user.profile)
            return Response(AcademicDocumentSerializer(doc).data)
        except AcademicDocument.DoesNotExist:
            return Response({"error": "Document not found"}, status=404)



class DocumentDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, doc_id):
        try:
            doc = AcademicDocument.objects.get(id=doc_id, uploaded_by=request.user.profile)
            
            if doc.status != 'COMPLETED':
                return Response({"error": "Analysis not ready yet."}, status=400)

            # Generate PDF
            pdf_buffer = generate_pdf_report(doc)

            # Return as File Response
            filename = f"DocuSense_Report_{doc.id}.pdf"
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except AcademicDocument.DoesNotExist:
            return Response({"error": "Document not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)