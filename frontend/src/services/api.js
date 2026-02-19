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
};

export default api;
