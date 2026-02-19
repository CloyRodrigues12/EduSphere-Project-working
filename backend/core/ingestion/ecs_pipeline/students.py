import pandas as pd
from datetime import datetime
from django.db import transaction
from core.models import Student, DataImportLog
import re

# Strict Mapping
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
    def __init__(self, import_log_id):
        self.log = DataImportLog.objects.get(id=import_log_id)
        self.file_path = self.log.file.path
        self.organization = self.log.organization
        
        # Pulling the newly required relational data
        self.academic_year = self.log.academic_year 
        self.department = self.log.uploaded_by.department if self.log.uploaded_by else None
        
        self.df = None
        self.validation_report = {
            "valid_rows": [],
            "error_rows": [],
            "preview_data": [],
            "schema_valid": False,
            "schema_errors": []
        }

    def load_and_validate_schema(self):
        try:
            if self.file_path.endswith('.csv'):
                self.df = pd.read_csv(self.file_path)
            else:
                self.df = pd.read_excel(self.file_path)
            
            # Normalize Headers
            self.df.columns = self.df.columns.str.strip().str.upper()
            
            # Check Missing Columns
            missing = [col for col in ECS_STUDENT_MAPPING.keys() if col not in self.df.columns]
            if missing:
                self.validation_report["schema_errors"].append(f"Missing Columns: {', '.join(missing)}")
                return False
            
            self.validation_report["schema_valid"] = True
            return True
        except Exception as e:
            self.validation_report["schema_errors"].append(f"File Read Error: {str(e)}")
            return False

    def validate_data(self):
        """Performs Row-Level Validation without saving"""
        if not self.validation_report["schema_valid"]:
            return self.validation_report

        # Sanitize for JSON Preview
        preview_df = self.df.fillna('')
        self.validation_report["preview_data"] = preview_df.head(5).to_dict(orient='records')

        # DB Duplicates check
        existing_enrollments = set(Student.objects.filter(
            organization=self.organization
        ).values_list('enrollment_number', flat=True))

        # In-File Duplicate Check
        seen_in_file = set()

        for index, row in self.df.iterrows():
            row_data = row.to_dict()
            errors = []
            
            enrollment_no = str(row.get('ENROLLMENT NO', '')).strip()
            name = str(row.get('NAME OF THE STUDENT', '')).strip()

            # 1. Mandatory Fields
            if not enrollment_no or enrollment_no.lower() == 'nan':
                errors.append("Missing Enrollment No")
            if not name or name.lower() == 'nan':
                errors.append("Missing Student Name")

            # 2. Check DB Duplicates
            if enrollment_no in existing_enrollments:
                errors.append(f"Already in Database (Enrollment: {enrollment_no})")

            # 3. Check In-File Duplicates 
            if enrollment_no in seen_in_file:
                errors.append(f"Duplicate in this file (Enrollment: {enrollment_no})")
            elif enrollment_no and enrollment_no.lower() != 'nan':
                seen_in_file.add(enrollment_no)

            # 4. Date Validation
            dob_val = row.get('DOB')
            parsed_dob = self.clean_date(dob_val)
            if dob_val and not parsed_dob and not pd.isna(dob_val):
                 errors.append(f"Invalid Date Format: {dob_val}")

            # Note: Changing keys to 'row' and 'error' to match your React UI mapping
            record = {
                "row": index + 2,
                "data": {k: str(v) if not pd.isna(v) else "" for k, v in row_data.items()},
                "cleaned_dob": parsed_dob
            }

            if errors:
                record["error"] = " | ".join(errors)
                self.validation_report["error_rows"].append(record)
            else:
                self.validation_report["valid_rows"].append(record)

        return self.validation_report

    def commit_data(self, partial=False):
        """Saves data based on user decision"""
        self.load_and_validate_schema()
        report = self.validate_data()
        
        rows_to_insert = report["valid_rows"]
        
        if not partial and report["error_rows"]:
            raise Exception("Validation Failed: Cannot perform Full Upload with errors.")

        saved_count = 0
        with transaction.atomic():
            for row in rows_to_insert:
                data = row["data"]
                
                Student.objects.update_or_create(
                    organization=self.organization,
                    enrollment_number=str(data.get('ENROLLMENT NO')).strip(),
                    defaults={
                        'department': self.department,  # Added new relation
                        'roll_number': str(data.get('ROLL NO', '')).strip(),
                        'full_name': str(data.get('NAME OF THE STUDENT', '')).strip(),
                        'dob': row["cleaned_dob"],
                        'gender': str(data.get('GENDER', '')).strip(),
                        'mobile_number': str(data.get('MOBILE NO', '')).strip(),
                        'aic_id': str(data.get('AIC ID', '')).strip(),
                        'aadhar_number': str(data.get('AADHAR NO', '')).strip(),
                        'name_on_aadhar': str(data.get('NAME AS PER AADHAR CARD', '')).strip(),
                        'signature_status': str(data.get('SIGN', '')).strip(),
                        'remarks': str(data.get('REMARK', '')).strip(),
                        'academic_year': self.academic_year, # Converted to dynamic object
                        'current_semester': 1 # Defaulting to 1 for generic import
                    }
                )
                saved_count += 1
        
        # Update Audit Log
        self.log.status = 'PARTIAL_SUCCESS' if report["error_rows"] else 'SUCCESS'
        self.log.success_count = saved_count
        self.log.save()
        
        return saved_count

    def clean_date(self, date_val):
        if pd.isna(date_val): return None
        try:
            if isinstance(date_val, str):
                return datetime.strptime(date_val.strip(), "%d-%m-%Y").date()
            return date_val.date()
        except:
            return None