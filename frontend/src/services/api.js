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

  // NEW: Automatically attach the target department to the request
  const savedDeptId = localStorage.getItem("edusphere_saved_dept");
  if (savedDeptId) {
    config.headers["X-Department-ID"] = savedDeptId;
  }

  return config;
});

export const staffService = {
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
      // NEW
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteFaculty: (id) => api.delete(`/faculty/?id=${id}`),


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

  // --- NEW: Academic Years ---
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
};
export const attendanceService = {
  // If no ID is passed, it fetches ALL sessions for the global calendar
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
    if (mergeShared) url += `&merge_shared=true`; // NEW
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
};

export const assignmentService = {
  // Class Teachers
  getClassTeachers: (ayId) => api.get(`/assignments/class-teachers/?academic_year=${ayId}`),
  assignClassTeacher: (data) => api.post("/assignments/class-teachers/", data),
  deleteClassTeacher: (id) => api.delete(`/assignments/class-teachers/?id=${id}`),
  getClassTeacherStudents: (ctId) => api.get(`/assignments/class-teachers/students/?ct_id=${ctId}`),

  getMyClassDashboard: (ayId) => api.get(`/assignments/my-class/?academic_year=${ayId}`),
  
  // Mentors
  getMentorSummary: () => api.get("/assignments/mentors/summary/"),
  getMentorStudents: () => api.get("/assignments/mentors/students/"),
  assignMentors: (data) => api.post("/assignments/mentors/students/", data),
  removeMentee: (studentId) => api.delete(`/assignments/mentors/students/?student_id=${studentId}`),

  // MENTOR DASHBOARD CALLS <---
  getMyMenteesDashboard: (ayId) => api.get(`/assignments/my-mentees/?academic_year=${ayId}`),
  getMenteeSubjectAttendance: (studentId, ayId) => api.get(`/assignments/my-mentees/subjects/?student_id=${studentId}&academic_year=${ayId}`),
};

export default api;
