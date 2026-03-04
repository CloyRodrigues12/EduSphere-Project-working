/* eslint-disable  */
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Sun,
  Moon,
  Bell,
  Search,
  Menu,
  LogOut,
  Settings,
  ChevronDown,
  Briefcase,
  Building2,
  BadgeCheck,
  AlertTriangle,
  Calendar,
  Info,
  GraduationCap,
} from "lucide-react";
import "./Topbar.css";
import { useAuth } from "../../context/AuthContext";
import { useAcademic } from "../../context/AcademicContext";

// --- SMART ABBREVIATION HELPER ---
const getSmartAbbreviation = (name) => {
  if (!name) return "";
  const cleanName = name.trim();

  // If it's already very short or entirely uppercase without spaces (e.g. "DBCE", "MIT")
  if (
    cleanName.length <= 5 ||
    (cleanName === cleanName.toUpperCase() && !cleanName.includes(" "))
  ) {
    return cleanName;
  }

  // Words to skip
  const stopWords = new Set(["of", "and", "the", "in", "on", "at", "for", "&"]);

  // Split by spaces or hyphens, filter out stop words, get first letters
  const initials = cleanName
    .split(/[\s-]+/)
    .filter((word) => word.length > 0 && !stopWords.has(word.toLowerCase()))
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  // Fallback to original name if the abbreviation is weirdly short (just 1 letter)
  return initials.length > 1 ? initials : cleanName;
};

const Topbar = ({ title, onMenuClick }) => {
  const { logout } = useAuth();

  // Bring in the global academic AND department state!
  const {
    activeAcademicYear,
    academicYears,
    setActiveAcademicYear,
    departments,
    activeDepartment,
    setActiveDepartment,
  } = useAcademic();

  // Check local storage first. If nothing is saved, default to "light"
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("edusphere_theme") || "light";
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // State to hold the year the user *wants* to switch to before confirming
  const [pendingYear, setPendingYear] = useState(null);

  const menuRef = useRef(null);

  const [user, setUser] = useState({
    name: "Loading...",
    email: "",
    role: "",
    role_code: "",
    is_teaching_faculty: false,
    organization: "",
    location: "",
    designation: "",
    orgType: "",
    avatarUrl: "",
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Save the new theme to local storage every time it changes
    localStorage.setItem("edusphere_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/user/me/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const userData = response.data;
        setUser({
          name: userData.name,
          email: userData.email,
          role: userData.role,
          role_code: userData.role_code, // FIXED: Extract accurate internal code
          is_teaching_faculty: !!userData.is_teaching_faculty, // FIXED: Grab toggle state
          organization: userData.organization,
          location: userData.location,
          designation: userData.designation,
          orgType: userData.org_type,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            userData.name,
          )}&background=6366f1&color=fff&bold=true`,
        });
      } catch (error) {
        console.error("Failed to fetch user profile", error);
        setUser({ name: "Guest", role: "Visitor", avatarUrl: "" });
      }
    };
    fetchUserData();
  }, []);

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  const handleToggleTeaching = async (e) => {
    // Prevent default label click behavior
    e.preventDefault();

    // Optimistic Update
    const newState = !user.is_teaching_faculty;
    setUser({ ...user, is_teaching_faculty: newState });

    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/user/toggle-teaching/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // FORCE REFRESH: Reload the entire application so Sidebar & Contexts update!
      window.location.reload();
    } catch (error) {
      console.error("Failed to toggle teaching role", error);
      setUser((prev) => ({ ...prev, is_teaching_faculty: !newState }));
      alert("Failed to update status. Ensure you added the URL to urls.py!");
    }
  };

  // --- Handle Year Dropdown Change ---
  const handleYearSelect = (e) => {
    const selectedId = parseInt(e.target.value);
    const selected = academicYears.find((ay) => ay.id === selectedId);
    if (selected && selected.id !== activeAcademicYear.id) {
      setPendingYear(selected); // Trigger Modal instead of changing instantly
    }
  };

  const confirmYearSwitch = () => {
    setActiveAcademicYear(pendingYear);
    setPendingYear(null);
  };

  // --- Handle Department Dropdown Change ---
  const handleDeptChange = (e) => {
    const val = e.target.value;
    if (val === "ALL") {
      setActiveDepartment({ id: "ALL", name: "All Departments" });
    } else {
      const selected = departments.find((d) => d.id === parseInt(val));
      if (selected) setActiveDepartment(selected);
    }
    window.location.reload();
  };

  const isOrgAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(user?.role_code);

  return (
    <header className="topbar glass-panel">
      {/* Left */}
      <div className="topbar-left">
        <button className="icon-btn menu-trigger" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        {/* --- Global Department Selector/Badge --- */}
        <div
          className="academic-year-badge"
          style={{
            background: "rgba(79, 70, 229, 0.05)",
            borderColor: "rgba(79, 70, 229, 0.2)",
          }}
        >
          <Building2 size={16} className="text-primary" />

          {isOrgAdmin ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--primary-color)",
                  marginRight: "6px",
                  whiteSpace: "nowrap",
                }}
                title={user.organization} // Hover to see full name
              >
                {getSmartAbbreviation(user.organization) || "Loading..."}
              </span>
              <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>
                /
              </span>
              <select
                className="year-selector"
                style={{ fontWeight: 600, paddingLeft: "4px" }}
                value={activeDepartment?.id || "ALL"}
                onChange={handleDeptChange}
                disabled={!activeDepartment}
                title="Change Active Department"
              >
                {/* NEW: Organization-Wide Option */}
                <option value="ALL">All Departments (Org View)</option>

                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
                {departments.length === 0 && <option value="">No Depts</option>}
              </select>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--primary-color)",
                  marginRight: "6px",
                  whiteSpace: "nowrap",
                }}
                title={user.organization} // Hover to see full name
              >
                {getSmartAbbreviation(user.organization) || "Organization"}
              </span>
              <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>
                /
              </span>
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {activeDepartment?.name || "No Department"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div
        className="topbar-right"
        style={{ display: "flex", alignItems: "center", gap: "15px" }}
      >
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>

        {/* --- Global Academic Year Selector/Badge --- */}
        {activeAcademicYear && (
          <div className="academic-year-badge">
            <Calendar size={16} className="text-primary" />
            <select
              className="year-selector"
              value={activeAcademicYear.id}
              onChange={handleYearSelect}
              title="Change Viewing Context"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.is_active ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <button className="icon-btn" onClick={toggleTheme}>
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button className="icon-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        {/* PROFILE DROPDOWN */}
        <div className="profile-container" ref={menuRef}>
          <div
            className={`profile-chip ${showProfileMenu ? "active" : ""}`}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <img
              src={
                user.avatarUrl ||
                "https://ui-avatars.com/api/?name=User&background=random"
              }
              alt="Profile"
            />
            <div className="profile-info">
              <span className="name">{user.name}</span>
              <span className="role">{user.designation || user.role}</span> 
            </div>
            <ChevronDown
              size={16}
              className={`dropdown-arrow ${showProfileMenu ? "rotate" : ""}`}
            />
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown slide-down-fade">
              <div className="dropdown-header">
                <img src={user.avatarUrl} alt="User" className="large-avatar" />
                <div className="header-info">
                  <h4>{user.name}</h4>
                  <p>{user.email}</p>
                  <div className="org-info">
                    <span className="org-badge">
                      {getSmartAbbreviation(user.organization)}{" "}
                      <BadgeCheck size={12} style={{ marginLeft: 4 }} />
                    </span>
                    {user.location && (
                      <span className="org-location">📍 {user.location}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <ul className="dropdown-menu">
                {/* --- NEW: ADMIN TEACHING TOGGLE --- */}
                {isOrgAdmin && (
                  <li
                    className="info-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <GraduationCap size={18} className="text-primary" />
                      <span
                        className="label"
                        style={{ margin: 0, fontWeight: 500 }}
                      >
                        Join Faculty Registry
                      </span>
                    </div>

                    {/* Proper Clickable Label Wrapper */}
                    <label
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={user.is_teaching_faculty}
                        onChange={handleToggleTeaching}
                        style={{ display: "none" }}
                      />
                      {/* iOS Style Toggle Switch */}
                      <div
                        style={{
                          width: "36px",
                          height: "20px",
                          borderRadius: "10px",
                          background: user.is_teaching_faculty
                            ? "var(--primary-color)"
                            : "var(--border-color)",
                          position: "relative",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            background: "white",
                            borderRadius: "50%",
                            position: "absolute",
                            top: "2px",
                            left: user.is_teaching_faculty ? "18px" : "2px",
                            transition: "all 0.3s ease",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                        />
                      </div>
                    </label>
                  </li>
                )}

                <li className="info-item">
                  <Briefcase size={18} className="text-primary" />
                  <div className="item-text">
                    <span className="label">Designation</span>
                    <span className="value">{user.designation || "N/A"}</span>
                  </div>
                </li>
                <li className="info-item">
                  <Building2 size={18} className="text-primary" />
                  <div className="item-text">
                    <span className="label">Institute Type</span>
                    <span className="value">{user.orgType || "N/A"}</span>
                  </div>
                </li>
                <div className="dropdown-divider"></div>
                <li>
                  <Settings size={18} />
                  <span>Account Settings</span>
                </li>
              </ul>

              <div className="dropdown-divider"></div>

              <div className="dropdown-footer">
                <button
                  className="logout-btn"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS RENDERED IN PORTAL (Outside Topbar) --- */}

      {/* 1. Logout Modal */}
      {showLogoutConfirm &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
              <div className="warning-icon">
                <AlertTriangle size={32} />
              </div>
              <h3>Sign Out?</h3>
              <p>Are you sure you want to end your session?</p>
              <div className="confirm-actions">
                <button
                  className="text-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button className="danger-btn" onClick={handleLogout}>
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 2. Switch Year Context Modal */}
      {pendingYear &&
        createPortal(
          <div className="modal-overlay" onClick={() => setPendingYear(null)}>
            <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
              <div
                className="warning-icon"
                style={{
                  color: "#3b82f6",
                  background: "rgba(59, 130, 246, 0.1)",
                }}
              >
                <Info size={32} />
              </div>
              <h3>Change Dashboard Context?</h3>
              <p>
                You are switching your view to the{" "}
                <strong>{pendingYear.name}</strong> academic year. This will
                reload directories, matrices, and dashboards to show past or
                future data.
              </p>
              <div className="confirm-actions" style={{ marginTop: "1.5rem" }}>
                <button
                  className="text-btn"
                  onClick={() => setPendingYear(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={confirmYearSwitch}
                  style={{ padding: "0.6rem 1.2rem", borderRadius: "8px" }}
                >
                  Switch View
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
};

export default Topbar;
