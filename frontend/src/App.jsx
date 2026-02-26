import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AcademicProvider } from "./context/AcademicContext";

// Components
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ProtectedRoute from "./components/layout/ProtectedRoute";

// Pages
import WelcomeGuide from "./pages/WelcomeGuide";
import DashboardHome from "./pages/DashboardHome";
import Login from "./pages/Login";
import SetupWizard from "./pages/SetupWizard";
import StaffManagement from "./pages/StaffManagement";
import PasswordResetConfirm from "./pages/PasswordResetConfirm";
import DocuSense from "./pages/DocuSense";
import ECSUploadWizard from "./pages/Upload/ECSView/ECSUploadWizard";
import SubjectCatalog from "./pages/SubjectCatalog";
import StudentDirectory from "./pages/StudentDirectory";
import AllocationMatrix from "./pages/AllocationMatrix";

import AcademicSettings from "./pages/AcademicSettings";

import Attendance from "./pages/Attendance";

// Placeholder Component
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

// Layout Wrapper (Sidebar + Topbar)
const AppLayout = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

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
        <Topbar title="EduSphere" onMenuClick={() => setMobileOpen(true)} />
        <div style={{ flex: 1, paddingBottom: "2rem" }}>
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/welcome" element={<WelcomeGuide />} />{" "}
            {/* <--- ADD THIS */}
            <Route
              path="/fees"
              element={<Placeholder title="Fees Collection" />}
            />
            <Route path="/upload" element={<ECSUploadWizard />} />
            <Route path="/docusense" element={<DocuSense />} />
            <Route path="/staff" element={<StaffManagement />} />
            <Route path="/subjects" element={<SubjectCatalog />} />
            <Route path="/students" element={<StudentDirectory />} />
            <Route path="/allocations" element={<AllocationMatrix />} />
            <Route path="/academic-settings" element={<AcademicSettings />} />
            {/* Base Attendance Route (Class Selector) */}
            <Route
              path="/attendance"
              element={
                <ProtectedRoute>
                  <Attendance />
                </ProtectedRoute>
              }
            />
            {/* Specific Class Attendance Route */}
            <Route
              path="/attendance/:allocationId"
              element={
                <ProtectedRoute>
                  <Attendance />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AcademicProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route
            path="/password-reset/confirm/:uid/:token"
            element={<PasswordResetConfirm />}
          />

          {/* Protected Routes (Requires Login) */}
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupWizard />
              </ProtectedRoute>
            }
          />

          {/* The Catch-All for Dashboard (Protected) */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AcademicProvider>
    </AuthProvider>
  );
}

export default App;
