from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.models import Student, UserProfile, Course, TeachingAllocation, Department
from attendance.models import ClassSession, AttendanceRecord
from django.db.models import Count

class AdvancedDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_profile = request.user.profile
        dept_id = request.headers.get('X-Department-Id')
        ay_id = request.headers.get('X-Academic-Year-Id')
        study_year = request.query_params.get('year', 'ALL')

        # 1. Base Querysets
        students = Student.objects.filter(is_active=True)
        faculty = UserProfile.objects.filter(role__in=['FACULTY', 'HOD'], user__is_active=True)
        courses = Course.objects.all()
        allocations = TeachingAllocation.objects.all()
        departments = Department.objects.all()

        if ay_id:
            students = students.filter(academic_year_id=ay_id)
            allocations = allocations.filter(student_group__academic_year_id=ay_id)

        # 2. Department Lock
        if user_profile.role in ['HOD', 'FACULTY'] or (dept_id and dept_id != 'ALL'):
            target_dept = user_profile.department_id if user_profile.role in ['HOD', 'FACULTY'] else dept_id
            students = students.filter(department_id=target_dept)
            faculty = faculty.filter(department_id=target_dept)
            courses = courses.filter(department_id=target_dept)
            allocations = allocations.filter(subject__department_id=target_dept)
            departments = departments.filter(id=target_dept)

        # 3. Study Year Local Filter
        if study_year != 'ALL':
            year_map = {'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8]}
            sems = year_map.get(study_year, [])
            if sems:
                students = students.filter(current_semester__in=sems)
                courses = courses.filter(semester__in=sems)
                allocations = allocations.filter(subject__semester__in=sems)

        total_students = students.count()

        # ==========================================
        # REAL ATTENDANCE CALCULATIONS
        # ==========================================
        sessions = ClassSession.objects.filter(allocation__in=allocations)
        # We need session to accurately calculate multi-hour labs using lecture_count
        records = AttendanceRecord.objects.filter(session__in=sessions, student__in=students).select_related('student', 'session')
        
        valid_present = ['PRESENT', 'LATE', 'DUTY_SPORTS', 'DUTY_CULTURE', 'DUTY_OTHER']
        
        # Calculate Overall Institute Attendance
        total_lecture_hours = 0
        total_present_hours = 0
        for rec in records:
            hrs = rec.session.lecture_count
            total_lecture_hours += hrs
            if rec.status in valid_present:
                total_present_hours += hrs
                
        overall_att = round((total_present_hours / total_lecture_hours * 100) if total_lecture_hours > 0 else 0, 1)

        # Attendance Trend (Last 7 active days)
        recent_dates = sessions.order_by('-date').values_list('date', flat=True).distinct()[:7]
        trend_data = []
        for d in reversed(recent_dates):
            day_records = records.filter(session__date=d)
            d_total = 0
            d_pres = 0
            for r in day_records:
                d_total += r.session.lecture_count
                if r.status in valid_present: d_pres += r.session.lecture_count
                
            att_pct = round((d_pres / d_total * 100) if d_total > 0 else 0, 1)
            trend_data.append({
                "date": d.strftime('%b %d'), "attendance": att_pct,
                "details": [{"name": "Attendance Info", "value": f"{d_pres} hours present out of {d_total} total hours"}]
            })

        # ==========================================
        # OVERALL DEFAULTERS & TOP CLASSES
        # ==========================================
        # 1. Build a global ledger for each student across ALL subjects
        student_ledger = {}
        for rec in records:
            sid = rec.student.id
            if sid not in student_ledger:
                sem = rec.student.current_semester
                y_key = 'FE' if sem in [1,2] else 'SE' if sem in [3,4] else 'TE' if sem in [5,6] else 'BE'
                student_ledger[sid] = {
                    'name': rec.student.full_name,
                    'y_key': y_key,
                    'total_hrs': 0,
                    'pres_hrs': 0
                }
            
            hrs = rec.session.lecture_count
            student_ledger[sid]['total_hrs'] += hrs
            if rec.status in valid_present:
                student_ledger[sid]['pres_hrs'] += hrs

        # 2. Group aggregated students into their Classes
        class_stats = {
            'FE': {'total_hrs': 0, 'pres_hrs': 0, 'defaulters': []},
            'SE': {'total_hrs': 0, 'pres_hrs': 0, 'defaulters': []},
            'TE': {'total_hrs': 0, 'pres_hrs': 0, 'defaulters': []},
            'BE': {'total_hrs': 0, 'pres_hrs': 0, 'defaulters': []}
        }

        for sid, data in student_ledger.items():
            y_key = data['y_key']
            
            # Add to class totals for the Top Classes chart
            class_stats[y_key]['total_hrs'] += data['total_hrs']
            class_stats[y_key]['pres_hrs'] += data['pres_hrs']
            
            # Calculate Student's OVERALL Percentage
            if data['total_hrs'] > 0:
                overall_pct = round((data['pres_hrs'] / data['total_hrs']) * 100, 1)
                
                # If their total aggregate is < 75%, they are a definitive defaulter
                if overall_pct < 75.0:
                    class_stats[y_key]['defaulters'].append({
                        "name": data['name'], 
                        "value": f"{overall_pct}% (Attended {data['pres_hrs']} / {data['total_hrs']} hrs)"
                    })

        defaulters_matrix = []
        top_classes = []
        
        for cls, data in class_stats.items():
            if data['total_hrs'] > 0:
                cls_att = round((data['pres_hrs'] / data['total_hrs']) * 100, 1)
                top_classes.append({"name": cls, "attendance": cls_att, "details": [{"name": "Class Average", "value": f"{cls_att}%"}]})
                
                if len(data['defaulters']) > 0:
                    # Sort defaulters lowest attendance first
                    sorted_defs = sorted(data['defaulters'], key=lambda x: float(x['value'].split('%')[0]))
                    defaulters_matrix.append({
                        "class": cls, 
                        "defaulters": len(sorted_defs), 
                        "details": sorted_defs
                    })
        
        top_classes = sorted(top_classes, key=lambda x: x['attendance'], reverse=True)

        # ==========================================
        # AGGREGATIONS & DEMOGRAPHICS
        # ==========================================
        # Student Demographics
        m_students = [{"name": s.full_name, "value": "Male"} for s in students if s.gender in ['Male', 'M']]
        f_students = [{"name": s.full_name, "value": "Female"} for s in students if s.gender in ['Female', 'F']]
        demographics = []
        if m_students: demographics.append({"name": "Male", "value": len(m_students), "color": "#4f46e5", "details": m_students})
        if f_students: demographics.append({"name": "Female", "value": len(f_students), "color": "#ec4899", "details": f_students})

        # Faculty Demographics (By Designation)
        fac_designations = {}
        for f in faculty:
            # Group by designation, default to 'Faculty' if blank
            d = f.designation if f.designation else "Faculty"
            if d not in fac_designations: fac_designations[d] = []
            fac_designations[d].append({"name": f.user.get_full_name() or "Staff", "value": d})
            
        fac_demographics = [{"name": desig.replace('_', ' ').title(), "value": len(lst), "details": lst} for desig, lst in fac_designations.items()]

        # Subject Breakdown
        subj_dict = {}
        for c in courses:
            t = c.subject_type.replace('_', ' ').title()
            if t not in subj_dict: subj_dict[t] = []
            subj_dict[t].append({"name": c.name, "value": c.code})
        subject_distribution = [{"name": k, "value": len(v), "details": v} for k, v in subj_dict.items()]

        # Workload
        wl_dict = {}
        for a in allocations.select_related('faculty__user', 'subject'):
            if not a.faculty: continue
            fname = a.faculty.user.get_full_name()
            if fname not in wl_dict: wl_dict[fname] = []
            wl_dict[fname].append({"name": a.subject.name, "value": "Allocated"})
        workload = sorted([{"name": k, "Load": len(v), "details": v} for k, v in wl_dict.items()], key=lambda x: x['Load'], reverse=True)[:6]

        # Detailed KPI Lists
        student_list = [{"name": s.full_name, "value": s.enrollment_number} for s in students[:100]]
        faculty_list = [{"name": f.user.get_full_name(), "value": f.department.code if f.department else ''} for f in faculty[:100]]
        dept_list = [{"name": d.name, "value": d.code} for d in departments]

        return Response({
            "user_name": request.user.first_name or request.user.username.split('@')[0],
            "kpis": {
                "total_departments": {"value": departments.count(), "details": dept_list},
                "total_students": {"value": total_students, "details": student_list},
                "total_faculty": {"value": faculty.count(), "details": faculty_list},
                "active_courses": {"value": courses.count(), "details": [{"name": c.name, "value": c.code} for c in courses]},
                "overall_attendance": {"value": overall_att, "details": []}
            },
            "charts": {
                "demographics": demographics,
                "faculty_demographics": fac_demographics,
                "subject_distribution": subject_distribution,
                "workload": workload,
                "attendance_trend": trend_data,
                "defaulters_matrix": defaulters_matrix,
                "top_classes": top_classes
            }
        })