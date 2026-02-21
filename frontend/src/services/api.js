import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add Token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const staffService = {
  getDepartments: () => api.get("/departments/"), // NEW

  getStaff: () => api.get("/staff/"),
  inviteStaff: (data) => api.post("/staff/", data),
  deleteStaff: (id) => api.delete(`/staff/?id=${id}`),

  getFaculty: () => api.get("/faculty/"),
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
  getStudents: (semester, search) =>
    api.get(
      `/students/directory/?semester=${semester || ""}&search=${search || ""}`,
    ),
  bulkUpdateSemester: (studentIds, newSemester) =>
    api.patch("/students/directory/", {
      student_ids: studentIds,
      new_semester: newSemester,
    }),

  // Batch Management
  getGroups: (academicYearId, semester) =>
    api.get(
      `/student-groups/?academic_year=${academicYearId}&semester=${semester || ""}`,
    ),
  createGroup: (data) => api.post("/student-groups/", data),
  updateGroup: (data) => api.put("/student-groups/", data),
  deleteGroup: (id) => api.delete(`/student-groups/?id=${id}`),

  // The "Bucket Filler" Action
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
    api.delete(`/attendance/sessions/?session_id=${sessionId}`), // NEW
};

export default api;
