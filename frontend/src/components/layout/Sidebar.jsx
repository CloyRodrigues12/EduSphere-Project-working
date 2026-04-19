import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAcademic } from "../../context/AcademicContext"; 
import {
  LayoutDashboard, UploadCloud, Users, Banknote, ChevronLeft, ChevronRight,
  LogOut, X, AlertCircle, Shield, Library, Layers, Settings, FileSearch,
  ClipboardCheck, Info, UserStar, Presentation, HeartHandshake, CalendarDays,
  CalendarClock, ClipboardPen, Sun, Moon, UserCircle,
} from "lucide-react";
import "./Sidebar.css";

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- NEW: Contexts for Mobile Dropdowns ---
  const { activeAcademicYear, academicYears, setActiveAcademicYear, departments, activeDepartment, setActiveDepartment, activeTerm, setActiveTerm } = useAcademic();
  const [theme, setTheme] = useState(() => localStorage.getItem("edusphere_theme") || "light");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("edusphere_theme", newTheme);
  };

  const handleDeptChange = (e) => {
    const val = e.target.value;
    if (val === "ALL") setActiveDepartment({ id: "ALL", name: "All Departments" });
    else {
      const selected = departments.find((d) => d.id === parseInt(val));
      if (selected) setActiveDepartment(selected);
    }
    window.location.reload();
  };

  // --- DYNAMIC MENU LOGIC ---
  const isOrgAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(user?.role_code);
  const isHODOrAdmin = ["ORG_ADMIN", "SUPER_ADMIN", "HOD"].includes(user?.role_code);
  const isStudent = user?.role_code === "STUDENT";
  const isSportsStaff = user?.role_code === "SPORTS_STAFF";
  const isCounsellor = user?.role_code === "COUNSELLOR" || user?.role === "COUNSELLOR";

  let navItems = [];

  if (isStudent) {
    navItems = [
      { icon: LayoutDashboard, label: "My Dashboard", path: "/" },
      { icon: CalendarClock, label: "Duty Leaves (OD)", path: "/duty-leave" },
      { icon: UserCircle, label: "My Profile", path: "/student/profile" },
    ];
  } else if (isCounsellor) {
    navItems = [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Users, label: "Mentee Profiles", path: "/counselling/mentee-profiles" },
      { icon: HeartHandshake, label: "Mentor Allocation", path: "/counselling/mentor-allocation" },
    ];
  } else if (isSportsStaff) {
    navItems = [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: CalendarClock, label: "Duty Leaves (OD)", path: "/duty-leave" },
    ];
  } else {
    navItems = [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Presentation, label: "My Class", path: "/my-class" },
      { icon: HeartHandshake, label: "My Mentees", path: "/my-mentees" },
      { icon: ClipboardCheck, label: "Attendance", path: "/attendance" },
      { icon: ClipboardPen, label: "Int. Assessments ", path: "/internal-assessment" },
      { icon: CalendarClock, label: "Duty Leaves (OD)", path: "/duty-leave" },
      { icon: CalendarDays, label: "Timetables", path: "/timetable" },
      { icon: Library, label: "Subject Catalog", path: "/subjects" },
      { icon: Users, label: "Dir & Batches", path: "/students" },
    ];

    if (isOrgAdmin || user?.role_code === "HOD") navItems.push({ icon: HeartHandshake, label: "Counselling Dept", path: "/counselling/mentor-allocation" });
    if (isOrgAdmin) navItems.push({ icon: Settings, label: "Academic Settings", path: "/academic-settings" });

    if (isHODOrAdmin) {
      navItems.splice(5, 0, { icon: Shield, label: "Team & Perms", path: "/staff" });
      navItems.splice(7, 0, { icon: Layers, label: "Allocation Matrix", path: "/allocations" });
      navItems.splice(9, 0, { icon: UploadCloud, label: "Upload Data", path: "/upload" });
      navItems.splice(11, 0, { icon: UserStar, label: "Class Teachers", path: "/assignments" });
      navItems.splice(3, 0, { icon:  Users, label: "Students", path: "/institute/directory" });
      
    }
  }

  const handleLogoutClick = () => { setShowLogoutConfirm(true); setMobileOpen(false); };
  const confirmLogout = () => { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); navigate("/login"); };

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=6366f1&color=fff&bold=true`;

  return (
    <>
      <div className={`mobile-backdrop ${mobileOpen ? "open" : ""}`} onClick={() => setMobileOpen(false)} />

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        
        {/* Desktop Header */}
        <div className="sidebar-header desktop-only">
          <div className="logo-icon"><img src="/logo.png" alt="EduSphere Logo" className="brand-logo-img" /></div>
          {(!collapsed || mobileOpen) && (
            <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "space-between" }}>
              <span className="logo-text">EduSphere</span>
              {!isStudent && (
                <NavLink to="/welcome" className={({ isActive }) => `info-nav-icon ${isActive ? "active" : ""}`} style={({ isActive }) => ({ color: isActive ? "var(--primary-color)" : "var(--text-muted)", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px", transition: "all 0.2s ease" })} title="System Guide & Architecture">
                  <Info size={15} />
                </NavLink>
              )}
            </div>
          )}
        </div>

        {/* --- MOBILE ONLY: CONTEXT PANEL --- */}
        <div className="mobile-context-panel">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-10px" }}>
             <button className="icon-btn mobile-close-btn" onClick={() => setMobileOpen(false)}><X size={24} /></button>
          </div>

          <div className="mobile-profile-row">
            <img src={avatarUrl} alt="Profile" className="mobile-profile-avatar" />
            <div className="mobile-profile-info">
              <span className="mobile-profile-name">{user?.name || "User"}</span>
              <span className="mobile-profile-role">{user?.role_code || "Staff Member"}</span>
            </div>
          </div>

          <div className="mobile-controls-grid">
            {isOrgAdmin && departments && (
              <select className="mobile-select-box" value={activeDepartment?.id || "ALL"} onChange={handleDeptChange}>
                <option value="ALL">All Departments (Org View)</option>
                {departments.map((dept) => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
              </select>
            )}

            {activeAcademicYear && !isStudent && (
              <div style={{ display: "flex", gap: "10px" }}>
                <select className="mobile-select-box" value={activeAcademicYear.id} onChange={(e) => setActiveAcademicYear(academicYears.find(ay => ay.id === parseInt(e.target.value)))} style={{ flex: 1 }}>
                  {academicYears.map((ay) => (<option key={ay.id} value={ay.id}>{ay.name}</option>))}
                </select>
                <select className="mobile-select-box" value={activeTerm} onChange={(e) => setActiveTerm(e.target.value)} style={{ flex: 1 }}>
                  <option value="ODD">Odd Term</option><option value="EVEN">Even Term</option>
                </select>
              </div>
            )}
          </div>

          <div className="mobile-actions-row">
            <button className="mobile-icon-btn" onClick={toggleTheme}>
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </button>
          </div>
        </div>
        {/* --- END MOBILE CONTEXT PANEL --- */}

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink to={item.path} key={item.path} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title={collapsed && !mobileOpen ? item.label : ""} onClick={() => setMobileOpen(false)}>
              <item.icon size={20} />
              {(!collapsed || mobileOpen) && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogoutClick}>
            <LogOut size={20} />
            {(!collapsed || mobileOpen) && <span>Logout</span>}
          </button>
          <button className="collapse-btn desktop-only" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {showLogoutConfirm && (
        <div className="logout-overlay">
          <div className="logout-modal">
            <div className="logout-icon-container"><AlertCircle size={32} /></div>
            <h3>Log Out?</h3>
            <p>Are you sure you want to exit your session?</p>
            <div className="logout-actions">
              <button className="cancel-btn" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="confirm-logout-btn" onClick={confirmLogout}>Yes, Log Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;