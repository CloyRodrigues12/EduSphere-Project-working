import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add Token and Context Headers to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Automatically attach the target department to the request
  const savedDeptId = localStorage.getItem("edusphere_saved_dept");
  if (savedDeptId) {
    config.headers["X-Department-ID"] = savedDeptId;
  }

  // --- NEW: Automatically attach the target Term (Odd/Even) ---
  const savedTerm = localStorage.getItem("edusphere_saved_term");
  if (savedTerm) {
    config.headers["X-Term"] = savedTerm;
  }

  return config;
});

export const staffService = {

  // Inside staffService:
  getOrganizationFaculties: () => api.get('/core/faculties/'),          
  // --- Departments ---
  getDepartments: () => api.get("/departments/"),
  createDepartment: (data) => api.post("/departments/", data),
  updateDepartment: (data) => api.put("/departments/", data),
  deleteDepartment: (id) => api.delete(`/departments/?id=${id}`),

  getStaff: () => api.get("/staff/"),
  inviteStaff: (data) => api.post("/staff/", data),
  deleteStaff: (id) => api.delete(`/staff/?id=${id}`),

  getFaculty: () => api.get("/faculty/"),
  getOrganizationFaculties: () => api.get("/faculty/?global=true"),
  addFaculty: (formData) =>
    api.post("/faculty/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  editFaculty: (id, formData) =>
    api.patch(`/faculty/?id=${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteFaculty: (id) => api.delete(`/faculty/?id=${id}`),

  // --->Student Accounts API <---
  getStudentAccounts: () => api.get("/student-accounts/"),
  manageStudentAccounts: (data) => api.post("/student-accounts/", data),
};

export const academicService = {
  getSubjects: (semester) => api.get(`/subjects/?semester=${semester}`),
  addSubject: (data) => api.post("/subjects/", data),
  updateSubject: (data) => api.put("/subjects/", data),
  deleteSubject: (id) => api.delete(`/subjects/?id=${id}`),

  //Fetch the analytics report
  getAcademicYearSummary: (yearId) =>
    api.get(`/academic-summary/?year_id=${yearId}`),

  // --- Allocation Matrix ---
  getAllocations: (academicYearId, facultyId) =>
    api.get(
      `/allocations/?academic_year=${academicYearId}&faculty_id=${facultyId || ""}`,
    ),
  createAllocations: (data) => api.post("/allocations/", data), // Expects { academic_year, faculty_id, subject_id, student_group_ids: [] }
  deleteAllocation: (id) => api.delete(`/allocations/?id=${id}`),

  // --- Faculty Dashboard ---
  getMyClasses: () => api.get("/faculty/my-classes/"),

  // --- Academic Years ---
  getAcademicYears: () => api.get("/academic-years/"),
  createAcademicYear: (data) => api.post("/academic-years/", data),
  updateAcademicYear: (data) => api.put("/academic-years/", data),
};

export const studentService = {
  // Master Directory
  getStudents: (yearId, semester, search) =>
    api.get(
      `/students/directory/?academic_year=${yearId}&semester=${semester || ""}&search=${search || ""}`,
    ),
  bulkUpdateSemester: (studentIds, newSemester, academicYearId) =>
    api.patch("/students/directory/", {
      student_ids: studentIds,
      new_semester: newSemester,
      academic_year_id: academicYearId,
    }),

    getProfile: () => api.get("/student-portal/profile/"),

  // Toggle Active Status
  toggleStatus: (id) => api.post(`/students/toggle-status/${id}/`),

  // Batch Management
  getGroups: (academicYearId, semester) =>
    api.get(
      `/student-groups/?academic_year=${academicYearId}&semester=${semester || ""}`,
    ),
  createGroup: (data) => api.post("/student-groups/", data),
  updateGroup: (data) => api.put("/student-groups/", data),
  deleteGroup: (id) => api.delete(`/student-groups/?id=${id}`),
  updateGroupStudents: (groupId, studentIds, action) =>
    api.patch("/student-groups/", {
      group_id: groupId,
      student_ids: studentIds,
      action: action,
    }),
    
  // --- NEW: SMART BATCHING ENGINES ---
  autoGenerateClassGroup: (data) => api.post("/student-groups/auto-generate/", data),
  autoSplitBatches: (data) => api.post("/student-groups/auto-split/", data),
};

export const attendanceService = {
  // --- NEW: Faculty Smart Roster APIs ---
  getFacultyAllocations: () => api.get("/attendance/allocations/"),
  getClassRoster: (allocationId, dateStr) => {
    let url = `/attendance/roster/${allocationId}/`;
    if (dateStr) url += `?date=${dateStr}`;
    return api.get(url);
  },
  markClassAttendance: (data) => api.post("/attendance/mark/", data),

  // --- Existing Session APIs ---
  getSessions: (allocationId = "") =>
    api.get(
      `/attendance/sessions/${allocationId ? `?allocation_id=${allocationId}` : ""}`,
    ),
  createSession: (data) => api.post("/attendance/sessions/", data),
  updateAttendance: (records) =>
    api.put("/attendance/bulk-update/", { records }),
  deleteSession: (sessionId) =>
    api.delete(`/attendance/sessions/?session_id=${sessionId}`),
    
  getReport: (allocationId, startDate, endDate, mergeShared = false) => {
    let url = `/attendance/report/?allocation_id=${allocationId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    if (mergeShared) url += `&merge_shared=true`; 
    return api.get(url);
  },
  getCumulativeReport: (
    academicYearId,
    semester,
    subjectIds,
    startDate,
    endDate,
  ) => {
    let url = `/attendance/cumulative-report/?academic_year_id=${academicYearId}&semester=${semester}&subject_ids=${subjectIds}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    return api.get(url);
  },

  getAnalytics: (
    academicYearId,
    allocationId = "",
    semester = "",
    subjectId = "",
    startDate = "",
    endDate = "",
  ) => {
    let url = `/attendance/analytics/?academic_year_id=${academicYearId}`;
    if (allocationId) url += `&allocation_id=${allocationId}`;
    if (semester) url += `&semester=${semester}`;
    if (subjectId) url += `&subject_id=${subjectId}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    return api.get(url);
  },

  getDutyLeaves: () => api.get('/attendance/duty-leave/'),
  submitDutyLeave: (data) => api.post('/attendance/duty-leave/', data),
  processDutyLeaveAction: (data) => api.post('/attendance/duty-leave/action/', data),
  getDutyLeaveStudents: () => api.get('/attendance/duty-leave/students/'),

};

export const resultsService = {
  getAssessmentAllocations: (ayId, term) => 
    api.get(`/results/internal-assessments/?academic_year=${ayId}&term=${term}`),
    
  getMarksheet: (allocationId, term) => 
    api.get(`/results/internal-marksheet/?allocation_id=${allocationId}&term=${term}`),
    
  saveMarks: (data) => 
    api.post('/results/save-internal-marks/', data),
};

export const assignmentService = {
  // Class Teachers
  getClassTeachers: (ayId) => api.get(`/assignments/class-teachers/?academic_year=${ayId}`),
  assignClassTeacher: (data) => api.post("/assignments/class-teachers/", data),
  deleteClassTeacher: (id) => api.delete(`/assignments/class-teachers/?id=${id}`),
  getClassTeacherStudents: (ctId) => api.get(`/assignments/class-teachers/students/?ct_id=${ctId}`),

  getMyClassDashboard: (ayId, term) => api.get(`/assignments/my-class/?academic_year=${ayId}&term=${term}`),
  
  // MENTOR DASHBOARD CALLS (Used by standard faculty to view their mentees)
  getMyMenteesDashboard: (ayId) => api.get(`/assignments/my-mentees/?academic_year=${ayId}`),
  getMenteeSubjectAttendance: (studentId, ayId) => api.get(`/assignments/my-mentees/subjects/?student_id=${studentId}&academic_year=${ayId}`),
};

// --- DEDICATED COUNSELLING SERVICE ---
export const counsellingService = {
  getMentorSummary: () => api.get("/counselling/mentors/summary/"),
  getMentorStudents: () => api.get("/counselling/mentors/students/"),
  assignMentors: (data) => api.post("/counselling/mentors/students/", data),
  removeMentee: (studentId) => api.delete(`/counselling/mentors/students/?student_id=${studentId}`),
  getMyDetailedMentees: () => api.get("/counselling/my-detailed-mentees/"),
};

// --- INSTITUTE 360 ADMIN SERVICE ---
export const instituteService = {
  getDirectory: () => api.get("/institute/directory/"),
  getStudent360: (studentId, ayId, term) => api.get(`/institute/student-360/${studentId}/?academic_year_id=${ayId}&term=${term}`),
};

export default api;