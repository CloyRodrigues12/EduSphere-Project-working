// src/components/layout/Topbar.jsx

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom"; // <--- 1. IMPORT PORTAL
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
} from "lucide-react";
import "./Topbar.css";
import { useAuth } from "../../context/AuthContext";

const Topbar = ({ title, onMenuClick }) => {
  const { logout } = useAuth();
  const [theme, setTheme] = useState("light");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuRef = useRef(null);

  const [user, setUser] = useState({
    name: "Loading...",
    email: "",
    role: "",
    organization: "",
    location: "",
    designation: "",
    orgType: "",
    avatarUrl: "",
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
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
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const userData = response.data;
        setUser({
          name: userData.name,
          email: userData.email,
          role: userData.role,
          organization: userData.organization,
          location: userData.location,
          designation: userData.designation,
          orgType: userData.org_type,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            userData.name
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

  return (
    <header className="topbar glass-panel">
      {/* Left */}
      <div className="topbar-left">
        <button className="icon-btn menu-trigger" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <h1 className="page-title">{title}</h1>
      </div>

      {/* Right */}
      <div className="topbar-right">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>

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
              <span className="role">{user.role}</span>
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
                      {user.organization}{" "}
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

      {/* --- 2. RENDER MODAL IN PORTAL (Outside Topbar) --- */}
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
          document.body // <--- Target Node
        )}
    </header>
  );
};

export default Topbar;
