// frontend/src/App.jsx
import React, { useState } from "react";
import {
  Routes, // <--- REMOVED 'BrowserRouter as Router'
  Route,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import DashboardHome from "./pages/DashboardHome";
import Login from "./pages/Login";
import SetupWizard from "./pages/SetupWizard";
import StaffManagement from "./pages/StaffManagement";
import PasswordResetConfirm from "./pages/PasswordResetConfirm";

// --- Simple Placeholder ---
const Placeholder = ({ title }) => (
  <div style={{ padding: "2rem" }}>
    <div
      className="glass-panel"
      style={{ padding: "3rem", borderRadius: "20px" }}
    >
      <h2 style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p style={{ color: "var(--text-secondary)" }}>
        Module under development.
      </p>
    </div>
  </div>
);

// --- Layout Wrapper ---
const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const getTitle = (path) => {
    switch (path) {
      case "/":
        return "Dashboard Overview";
      case "/upload":
        return "Data Ingestion";
      case "/students":
        return "Student Management";
      case "/fees":
        return "Fees Collection";
      case "/research":
        return "AI Research Assistant";
      case "/staff":
        return "Staff Management";
      default:
        return "EduSphere";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        background: "var(--bg-main)",
      }}
    >
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar
          title={getTitle(location.pathname)}
          onMenuClick={() => setMobileOpen(true)}
        />
        <div style={{ flex: 1, paddingBottom: "2rem" }}>
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route
              path="/students"
              element={<Placeholder title="Student Management" />}
            />
            <Route
              path="/fees"
              element={<Placeholder title="Fees Collection" />}
            />
            <Route
              path="/upload"
              element={<Placeholder title="Data Upload" />}
            />
            <Route
              path="/research"
              element={<Placeholder title="AI Research" />}
            />
            <Route path="/staff" element={<StaffManagement />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
function App() {
  return (
    // <Router>  <--- REMOVED THIS WRAPPER
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupWizard />} />
        <Route
          path="/password-reset/confirm/:uid/:token"
          element={<PasswordResetConfirm />}
        />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </AuthProvider>
    // </Router> <--- REMOVED THIS WRAPPER
  );
}

export default App;
