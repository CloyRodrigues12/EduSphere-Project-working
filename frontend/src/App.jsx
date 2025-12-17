import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import DashboardHome from "./pages/DashboardHome";
import Login from "./pages/Login";
import SetupWizard from "./pages/SetupWizard";
import StaffManagement from "./pages/StaffManagement";

// --- Simple Placeholder for empty pages ---
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

// --- The Layout Wrapper (Sidebar + Topbar + Content) ---
const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Dynamic Title Helper
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
      {/* 1. Navigation Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* 2. Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Topbar (Passes the toggle function for mobile menu) */}
        <Topbar
          title={getTitle(location.pathname)}
          onMenuClick={() => setMobileOpen(true)}
        />

        {/* Scrollable Page Content */}
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

// --- Main Entry Point ---
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<SetupWizard />} />
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  );
}

export default App;
