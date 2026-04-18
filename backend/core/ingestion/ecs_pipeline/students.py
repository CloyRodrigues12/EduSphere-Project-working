import pandas as pd
from datetime import datetime
from django.db import transaction
from core.models import Student, DataImportLog
import re

# --- MANDATORY COLUMNS (Core Student Data) ---
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
    'REMARK': 'remarks'
}

# --- NEW: OPTIONAL COLUMNS (Mentee Profile Data) ---
OPTIONAL_MAPPING = {
    'ADDRESS': 'address',
    'PIN CODE': 'pin_code',
    'MENTEE CONTACT': 'contact_number',
    'FATHER NAME': 'father_name',
    'FATHER OCCUPATION': 'father_occupation',
    'FATHER CONTACT': 'father_contact',
    'MOTHER NAME': 'mother_name',
    'MOTHER OCCUPATION': 'mother_occupation',
    'MOTHER CONTACT': 'mother_contact',
    'GUARDIAN NAME': 'guardian_name',
    'GUARDIAN CONTACT': 'guardian_contact',
    'HOBBIES': 'hobbies',
    'ACHIEVEMENTS': 'achievements'
}

class StudentIngestionService:
    def __init__(self, import_log_id, target_department_id=None, target_semester=None):
        self.log = DataImportLog.objects.get(id=import_log_id)
        self.file_path = self.log.file.path
        self.organization = self.log.organization
        self.academic_year = self.log.academic_year 
        
        # Override department if provided by the UI
        if target_department_id:
            from core.models import Department
            self.department = Department.objects.get(id=target_department_id)
        else:
            self.department = self.log.uploaded_by.department if self.log.uploaded_by else None
            
        # Override semester
        self.semester = int(target_semester) if target_semester else 1
        
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
            
            # Check Missing Mandatory Columns Only
            missing = [col for col in ECS_STUDENT_MAPPING.keys() if col not in self.df.columns]
            if missing:
                self.validation_report["schema_errors"].append(f"Missing Mandatory Columns: {', '.join(missing)}")
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

        # DB Duplicates check
        existing_enrollments = set(Student.objects.filter(
            organization=self.organization
        ).values_list('enrollment_number', flat=True))

        seen_in_file = set()
        
        valid_preview_data = [] 

        for index, row in self.df.iterrows():
            row_data = row.to_dict()
            errors = []
            
            enrollment_no = str(row.get('ENROLLMENT NO', '')).strip()
            name = str(row.get('NAME OF THE STUDENT', '')).strip()

            if not enrollment_no or enrollment_no.lower() == 'nan':
                errors.append("Missing Enrollment No")
            if not name or name.lower() == 'nan':
                errors.append("Missing Student Name")

            if enrollment_no in existing_enrollments:
                errors.append(f"Already in Database (Enrollment: {enrollment_no})")

            if enrollment_no in seen_in_file:
                errors.append(f"Duplicate in this file (Enrollment: {enrollment_no})")
            elif enrollment_no and enrollment_no.lower() != 'nan':
                seen_in_file.add(enrollment_no)

            dob_val = row.get('DOB')
            parsed_dob = self.clean_date(dob_val)
            if dob_val and not parsed_dob and not pd.isna(dob_val):
                 errors.append(f"Invalid Date Format: {dob_val}")

            # Format data safely for JSON
            safe_data = {k: str(v) if not pd.isna(v) else "" for k, v in row_data.items()}

            record = {
                "row": index + 2,
                "data": safe_data,
                "cleaned_dob": parsed_dob
            }

            if errors:
                record["error"] = " | ".join(errors)
                self.validation_report["error_rows"].append(record)
            else:
                self.validation_report["valid_rows"].append(record)
                valid_preview_data.append(safe_data) 

        self.validation_report["preview_data"] = valid_preview_data
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
                
                # 1. Save or Update Core Student
                student, created = Student.objects.update_or_create(
                    organization=self.organization,
                    enrollment_number=str(data.get('ENROLLMENT NO')).strip(),
                    defaults={
                        'department': self.department, 
                        'roll_number': str(data.get('ROLL NO', '')).strip(),
                        'full_name': str(data.get('NAME OF THE STUDENT', '')).strip(),
                        'dob': row["cleaned_dob"],
                        'gender': str(data.get('GENDER', '')).strip(),
                        'mobile_number': str(data.get('MOBILE NO', '')).strip(),
                        'aic_id': str(data.get('AIC ID', '')).strip(),
                        'aadhar_number': str(data.get('AADHAR NO', '')).strip(),
                        'name_on_aadhar': str(data.get('NAME AS PER AADHAR CARD', '')).strip(),
                        'remarks': str(data.get('REMARK', '')).strip(),
                        'academic_year': self.academic_year, 
                        'current_semester': self.semester 
                    }
                )
                
                # 2. Extract and Save Optional Mentee Profile Data
                profile_defaults = {}
                for excel_col, db_field in OPTIONAL_MAPPING.items():
                    val = data.get(excel_col, "")
                    if val and str(val).strip() != "" and str(val).lower() != 'nan':
                        profile_defaults[db_field] = str(val).strip()
                
                if profile_defaults:
                    from counselling.models import MenteeProfile
                    MenteeProfile.objects.update_or_create(
                        student=student,
                        defaults=profile_defaults
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