from rest_framework import serializers
from .models import AcademicDocument

class AcademicDocumentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.user.get_full_name', read_only=True)

    class Meta:
        model = AcademicDocument
        fields = [
            'id', 'filename', 'category', 'upload_date', 
            'status', 'status_display', 'file', 'analysis_data',
            'uploaded_by_name'
        ]
        read_only_fields = ['id', 'upload_date', 'status', 'analysis_data', 'uploaded_by_name']