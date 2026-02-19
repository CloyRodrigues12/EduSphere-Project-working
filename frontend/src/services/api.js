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
  // 1. Office Staff (Viewers)
  getStaff: () => api.get("/staff/"),
  inviteStaff: (data) => api.post("/staff/", data),

  // 2. Faculty (Teachers)
  getFaculty: () => api.get("/faculty/"),
  addFaculty: (formData) =>
    api.post("/faculty/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // 3. Departments (Helper for Dropdowns)
  // Note: We will need a simple endpoint for this,
  // for now we can rely on what we have or hardcode if the endpoint isn't ready.
  getDepartments: () => api.get("/setup/departments/"),
};

export default api;
