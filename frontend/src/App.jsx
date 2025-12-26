import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Components
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ProtectedRoute from "./components/layout/ProtectedRoute";

// Pages
import DashboardHome from "./pages/DashboardHome";
import Login from "./pages/Login";
import SetupWizard from "./pages/SetupWizard";
import StaffManagement from "./pages/StaffManagement";
import PasswordResetConfirm from "./pages/PasswordResetConfirm";

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

function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;
