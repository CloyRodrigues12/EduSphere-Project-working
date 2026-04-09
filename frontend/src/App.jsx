import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AcademicProvider } from "./context/AcademicContext";

// Components
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ProtectedRoute from "./components/layout/ProtectedRoute";

// Pages
import WelcomeGuide from "./pages/WelcomeGuide";
import DashboardHome from "./pages/DashboardHome";
import StudentDashboard from "./pages/StudentPortal/StudentDashboard";
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
import ClassTeacherAssignments from "./pages/ClassTeacherAssignments";
import CounsellorMentorManagement from "./pages/CounsellorMentorManagement";
import MyClassDashboard from "./pages/MyClassDashboard";
import MyMenteesDashboard from "./pages/MyMenteesDashboard";
import TimetableManager from "./pages/TimetableManager";
import DutyLeaveDashboard from "./pages/DutyLeaveDashboard";
import InternalAssessment from './pages/InternalAssessment';

// Placeholder Component
const Placeholder = ({ title }) => (
  <div style={{ padding: "2rem" }}>
    <div className="glass-panel" style={{ padding: "3rem", borderRadius: "20px" }}>
      <h2 style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p style={{ color: "var(--text-secondary)" }}>Module under development.</p>
    </div>
  </div>
);

// Layout Wrapper (Sidebar + Topbar)
const AppLayout = () => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user } = useAuth();
  const location = useLocation();

  // Hide Sidebar and Topbar if the user is on the setup page
  const isSetupPage = location.pathname === "/setup";

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        background: "var(--bg-main)",
      }}
    >
      {!isSetupPage && (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}
      
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!isSetupPage && (
          <Topbar title="EduSphere" onMenuClick={() => setMobileOpen(true)} />
        )}
        
        <div style={{ flex: 1, paddingBottom: "2rem" }}>
          <Routes>
            {/* Conditional Home Route */}
            <Route 
              path="/" 
              element={user?.role === "STUDENT" ? <StudentDashboard /> : <DashboardHome />} 
            />
            
            {/* The Setup Page is now part of the main routing system */}
            <Route 
              path="/setup" 
              element={<ProtectedRoute><SetupWizard /></ProtectedRoute>} 
            />
            
            <Route path="/welcome" element={<WelcomeGuide />} />
            <Route path="/fees" element={<Placeholder title="Fees Collection" />} />

            {/* Admin & Faculty Only Routes */}
            <Route 
              path="/upload" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD"]}><ECSUploadWizard /></ProtectedRoute>} 
            />
            <Route 
              path="/docusense" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY", "STAFF"]}><DocuSense /></ProtectedRoute>} 
            />
            <Route 
              path="/staff" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD"]}><StaffManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/subjects" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY"]}><SubjectCatalog /></ProtectedRoute>} 
            />
            <Route 
              path="/students" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY"]}><StudentDirectory /></ProtectedRoute>} 
            />
            <Route 
              path="/allocations" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD"]}><AllocationMatrix /></ProtectedRoute>} 
            />
            <Route 
              path="/academic-settings" 
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN"]}><AcademicSettings /></ProtectedRoute>} 
            />

            {/* Attendance & Faculty Hub */}
            <Route
              path="/attendance"
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY"]}><Attendance /></ProtectedRoute>}
            />
            <Route
              path="/attendance/:allocationId"
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY"]}><Attendance /></ProtectedRoute>}
            />
            <Route path="/internal-assessment" element={
  <ProtectedRoute>
    <InternalAssessment />
  </ProtectedRoute>
} />
            <Route
  path="/duty-leave"
  element={
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY", "TEACHER", "STUDENT", "COUNSELLOR", "SPORTS_STAFF"]}>
      <DutyLeaveDashboard />
    </ProtectedRoute>
  }
/>
            {/* Replace the old Faculty Assignments route with this: */}
<Route


  path="/assignments"
  element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD"]}><ClassTeacherAssignments /></ProtectedRoute>}
/>

{/* Add the NEW Counselling Route: */}
<Route
  path="/counselling/mentor-allocation"
  element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "COUNSELLOR"]}><CounsellorMentorManagement /></ProtectedRoute>}
/>
            <Route
              path="/my-class"
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY"]}><MyClassDashboard /></ProtectedRoute>}
            />
            <Route
              path="/my-mentees"
              element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ORG_ADMIN", "HOD", "FACULTY"]}><MyMenteesDashboard /></ProtectedRoute>}
            />
            <Route path="/timetable" element={<ProtectedRoute><TimetableManager /></ProtectedRoute>} />
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