import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  UploadCloud,
  Users,
  Banknote,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  AlertCircle,
  Shield,
  Library,
  Layers,
  Settings,
  FileSearch,
  ClipboardCheck,
  Info,
} from "lucide-react";
import "./Sidebar.css";

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 3. Dynamic Menu Logic
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    // 2. ADD THE ATTENDANCE NAV ITEM HERE
    { icon: ClipboardCheck, label: "Attendance", path: "/attendance" },
    { icon: Library, label: "Subject Catalog", path: "/subjects" },
    { icon: Users, label: "Dir & Batches", path: "/students" },
    { icon: Banknote, label: "Fees", path: "/fees" },
    { icon: FileSearch, label: "DocuSense AI", path: "/docusense" },
  ];

  

  // Add these boolean checks for cleaner logic
const isOrgAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(user?.role_code);
const isHODOrAdmin = ["ORG_ADMIN", "SUPER_ADMIN", "HOD"].includes(user?.role_code);

// 1. Only ORG_ADMIN gets Admin Actions
if (isOrgAdmin) {
  navItems.push({
    icon: Settings, label: "Admin Actions", path: "/academic-settings",
  });
}

// 2. Both ORG_ADMIN and HOD get Team & Allocations
if (isHODOrAdmin) {
  navItems.splice(2, 0, {
    icon: Shield, label: "Team & Perms", path: "/staff",
  });
  navItems.splice(4, 0, {
    icon: Layers, label: "Allocation Matrix", path: "/allocations",
  });
  navItems.splice(6, 0, {
    icon: UploadCloud, label: "Upload Data", path: "/upload",
  });
}

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
    setMobileOpen(false);
  };

  const confirmLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`mobile-backdrop ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-header">
          <div className="logo-icon">
            <img
              src="/logo.png"
              alt="EduSphere Logo"
              className="brand-logo-img"
            />
          </div>
          {(!collapsed || mobileOpen) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                justifyContent: "space-between",
              }}
            >
              <span className="logo-text">EduSphere</span>
              {/* NEW: The Information / Welcome Guide Icon */}
              <NavLink
                to="/welcome"
                className={({ isActive }) =>
                  `info-nav-icon ${isActive ? "active" : ""}`
                }
                style={({ isActive }) => ({
                  color: isActive
                    ? "var(--primary-color)"
                    : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                  borderRadius: "6px",
                  transition: "all 0.2s ease",
                })}
                title="System Guide & Architecture"
              >
                <Info size={15} />
              </NavLink>
            </div>
          )}
          <button
            className="icon-btn mobile-close-btn"
            onClick={() => setMobileOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              to={item.path}
              key={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              title={collapsed && !mobileOpen ? item.label : ""}
              onClick={() => setMobileOpen(false)}
            >
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

          <button
            className="collapse-btn desktop-only"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Logout Popup */}
      {showLogoutConfirm && (
        <div className="logout-overlay">
          <div className="logout-modal">
            <div className="logout-icon-container">
              <AlertCircle size={32} />
            </div>
            <h3>Log Out?</h3>
            <p>Are you sure you want to exit your session?</p>
            <div className="logout-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button className="confirm-logout-btn" onClick={confirmLogout}>
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
