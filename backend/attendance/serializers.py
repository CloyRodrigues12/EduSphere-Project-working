from rest_framework import serializers
from .models import ClassSession, AttendanceRecord, DutyLeaveRequest, DutyLeaveParticipant


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    
    class Meta:
        model = AttendanceRecord
        fields = ['id', 'student', 'student_name', 'roll_number', 'status', 'remarks']

class ClassSessionSerializer(serializers.ModelSerializer):
    # Nests the roll call grid inside the session automatically
    records = AttendanceRecordSerializer(many=True, read_only=True)
    subject_name = serializers.CharField(source='allocation.subject.name', read_only=True)
    group_name = serializers.CharField(source='allocation.student_group.name', read_only=True)

    class Meta:
        model = ClassSession
        fields = [
            'id', 'allocation', 'date', 'lecture_count', 
            'is_extra_class', 'topics_covered', 
            'subject_name', 'group_name', 'records','updated_at'
        ]
        



# ==========================================
# NEW: DUTY LEAVE SERIALIZERS
# ==========================================
class DutyLeaveParticipantSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    department = serializers.CharField(source='student.department.name', read_only=True)
    semester = serializers.IntegerField(source='student.current_semester', read_only=True)
    
    attendance_percentage = serializers.SerializerMethodField()
    class_teacher_name = serializers.SerializerMethodField()
    hod_name = serializers.SerializerMethodField()
    class_teacher_id = serializers.SerializerMethodField()
    hod_id = serializers.SerializerMethodField()
    
    # --- NEW: Fetch Protected Lectures ---
    protected_sessions = serializers.SerializerMethodField()

    class Meta:
        model = DutyLeaveParticipant
        fields = [
            'id', 'student', 'student_name', 'roll_number', 'department', 'semester',
            'class_teacher_status', 'hod_status', 'final_status',
            'attendance_percentage', 'class_teacher_name', 'hod_name',
            'class_teacher_id', 'hod_id', 'protected_sessions' # <-- Added
        ]

    def get_attendance_percentage(self, obj):
        records = AttendanceRecord.objects.filter(student=obj.student).select_related('session')
        ta = sum(r.session.lecture_count for r in records if r.status in ['PRESENT', 'LATE'] or r.status.startswith('DUTY'))
        tc = sum(r.session.lecture_count for r in records)
        return round((ta / tc) * 100, 1) if tc > 0 else 100.0

    def get_class_teacher_name(self, obj):
        from faculty_assignments.models import ClassTeacher
        sem_to_year = {1: 'FE', 2: 'FE', 3: 'SE', 4: 'SE', 5: 'TE', 6: 'TE', 7: 'BE', 8: 'BE'}
        y_level = sem_to_year.get(obj.student.current_semester)
        ct = ClassTeacher.objects.filter(department=obj.student.department, year_level=y_level).first()
        if ct and ct.faculty and ct.faculty.user:
            return f"Prof. {ct.faculty.user.last_name or ct.faculty.user.first_name}"
        return "Unassigned"

    def get_hod_name(self, obj):
        from core.models import UserProfile
        hod = UserProfile.objects.filter(department=obj.student.department, role='HOD').first()
        if hod and hod.user:
            return f"Prof. {hod.user.last_name or hod.user.first_name}"
        return "Unassigned"

    def get_class_teacher_id(self, obj):
        from faculty_assignments.models import ClassTeacher
        sem_to_year = {1: 'FE', 2: 'FE', 3: 'SE', 4: 'SE', 5: 'TE', 6: 'TE', 7: 'BE', 8: 'BE'}
        y_level = sem_to_year.get(obj.student.current_semester)
        ct = ClassTeacher.objects.filter(department=obj.student.department, year_level=y_level).first()
        if ct and ct.faculty and ct.faculty.user:
            return ct.faculty.user.id
        return None

    def get_hod_id(self, obj):
        from core.models import UserProfile
        hod = UserProfile.objects.filter(department=obj.student.department, role='HOD').first()
        if hod and hod.user:
            return hod.user.id
        return None

    # --- NEW METHOD: Grabs actual lectures marked as DUTY ---
    def get_protected_sessions(self, obj):
        if obj.final_status != 'APPROVED':
            return []
            
        records = AttendanceRecord.objects.filter(
            student=obj.student,
            session__date__gte=obj.request.start_date,
            session__date__lte=obj.request.end_date,
            status__startswith='DUTY'
        ).select_related('session__allocation__subject')
        
        sessions = []
        for r in records:
            sessions.append({
                'date': r.session.date.strftime('%b %d'),
                'subject': r.session.allocation.subject.name,
                'type': r.session.allocation.subject.subject_type
            })
        return sessions
    
class DutyLeaveRequestSerializer(serializers.ModelSerializer):
    participants = DutyLeaveParticipantSerializer(many=True, read_only=True)
    initiator_name = serializers.CharField(source='initiator.user.get_full_name', read_only=True)
    event_in_charge_name = serializers.CharField(source='event_in_charge.user.get_full_name', read_only=True)

    class Meta:
        model = DutyLeaveRequest
        fields = [
            'id', 'title', 'reason', 'initiator', 'initiator_name', 
            'event_in_charge', 'event_in_charge_name', 
            'start_date', 'end_date', 'in_charge_status', 
            'created_at', 'participants'
        ]