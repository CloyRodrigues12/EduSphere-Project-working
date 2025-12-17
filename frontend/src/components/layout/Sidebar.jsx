import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UploadCloud,
  Users,
  Banknote,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  AlertCircle, // <--- New icon for the popup
} from "lucide-react";
import "./Sidebar.css";

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // <--- Controls the popup

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Students", path: "/students" },
    { icon: Banknote, label: "Fees", path: "/fees" },
    { icon: UploadCloud, label: "Upload Data", path: "/upload" },
    { icon: BookOpenCheck, label: "Research AI", path: "/research" },
  ];

  // 1. This just opens the popup
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
    setMobileOpen(false);
  };

  // 2. This actually logs you out
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
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo-icon">E</div>
          {(!collapsed || mobileOpen) && (
            <span className="logo-text">EduSphere</span>
          )}
          <button
            className="icon-btn mobile-close-btn"
            onClick={() => setMobileOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation Links */}
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

        {/* Footer */}
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

      {/* --- CONFIRMATION POPUP --- */}
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
