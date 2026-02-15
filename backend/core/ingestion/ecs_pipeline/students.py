# backend/core/ingestion/ecs_pipeline/students.py

import pandas as pd
from datetime import datetime
from django.db import transaction
from core.models import Student

# 1. Strict Mapping: Excel Header -> Database Field
ECS_STUDENT_MAPPING = {
    'ROLL NO': 'roll_number',
    'ENROLLMENT NO': 'enrollment_number',
    'NAME OF THE STUDENT': 'full_name',
    'DOB': 'dob',
    'GENDER': 'gender',
    'MOBILE NO': 'mobile_number',
    'AIC ID': 'aic_id',
    'AADHAR NO': 'aadhar_number',
    'NAME AS PER AADHAR CARD': 'name_on_aadhar',
    'SIGN': 'signature_status',
    'REMARK': 'remarks'
}

class StudentIngestionService:
    def __init__(self, file, organization, department, academic_year, semester):
        self.file = file
        self.organization = organization
        self.department = department
        self.academic_year = academic_year
        self.semester = semester
        self.errors = []
        self.success_count = 0

    def clean_date(self, date_val):
        """Converts DD-MM-YYYY or Excel timestamps to YYYY-MM-DD"""
        if pd.isna(date_val):
            return None
        try:
            # Handle string format "29-10-2004"
            if isinstance(date_val, str):
                return datetime.strptime(date_val.strip(), "%d-%m-%Y").date()
            # Handle pandas Timestamp
            return date_val.date()
        except Exception:
            return None # Return None if date is invalid

    def process(self):
        try:
            # Read Excel/CSV
            if self.file.name.endswith('.csv'):
                df = pd.read_csv(self.file)
            else:
                df = pd.read_excel(self.file)

            # Sanitize Headers (Strip whitespace)
            df.columns = df.columns.str.strip().str.upper()

            # Validate Required Columns
            missing_cols = [col for col in ECS_STUDENT_MAPPING.keys() if col not in df.columns]
            if missing_cols:
                return {
                    "status": "error", 
                    "message": f"Missing required columns: {', '.join(missing_cols)}"
                }

            # Transactional Injection
            with transaction.atomic():
                for index, row in df.iterrows():
                    try:
                        # 1. Clean Data
                        dob = self.clean_date(row.get('DOB'))
                        enrollment_no = str(row.get('ENROLLMENT NO')).strip()
                        
                        # 2. Update or Create Logic
                        student, created = Student.objects.update_or_create(
                            organization=self.organization,
                            enrollment_number=enrollment_no,
                            defaults={
                                'department': self.department,
                                'roll_number': str(row.get('ROLL NO')).strip(),
                                'full_name': str(row.get('NAME OF THE STUDENT')).strip(),
                                'dob': dob,
                                'gender': str(row.get('GENDER')).strip().capitalize(),
                                'mobile_number': str(row.get('MOBILE NO')).strip(),
                                'aic_id': str(row.get('AIC ID')).strip(),
                                'aadhar_number': str(row.get('AADHAR NO')).strip(),
                                'name_on_aadhar': str(row.get('NAME AS PER AADHAR CARD', '')).strip(),
                                'signature_status': str(row.get('SIGN', '')).strip(),
                                'remarks': str(row.get('REMARK', '')).strip(),
                                'academic_year': self.academic_year,
                                'current_semester': self.semester
                            }
                        )
                        self.success_count += 1
                        
                    except Exception as e:
                        self.errors.append(f"Row {index + 2}: {str(e)}")

            return {
                "status": "success" if not self.errors else "partial_success",
                "processed": self.success_count,
                "errors": self.errors
            }

        except Exception as e:
            return {"status": "error", "message": str(e)}