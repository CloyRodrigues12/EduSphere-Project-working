/* eslint-disable  */
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Sun, Moon, Bell, Search, Menu, LogOut, Settings, ChevronDown,
  Briefcase, Building2, BadgeCheck, AlertTriangle, Calendar, Info,
  GraduationCap, Layers, CheckCircle
} from "lucide-react";
import "./Topbar.css";
import { useAuth } from "../../context/AuthContext";
import { useAcademic } from "../../context/AcademicContext";

const getSmartAbbreviation = (name) => {
  if (!name) return "";
  const cleanName = name.trim();
  if (cleanName.length <= 5 || (cleanName === cleanName.toUpperCase() && !cleanName.includes(" "))) return cleanName;
  const stopWords = new Set(["of", "and", "the", "in", "on", "at", "for", "&"]);
  const initials = cleanName.split(/[\s-]+/).filter(w => w.length > 0 && !stopWords.has(w.toLowerCase())).map(w => w.charAt(0).toUpperCase()).join("");
  return initials.length > 1 ? initials : cleanName;
};

const getFirstAndLastName = (fullName) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

const Topbar = ({ title, onMenuClick }) => {
  const { logout, user: authUser } = useAuth();
  const navigate = useNavigate();
  const { activeAcademicYear, academicYears, setActiveAcademicYear, departments, activeDepartment, setActiveDepartment, activeTerm, setActiveTerm } = useAcademic();

  const [theme, setTheme] = useState(() => localStorage.getItem("edusphere_theme") || "light");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  const [pendingYear, setPendingYear] = useState(null);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const [user, setUser] = useState({ name: "Loading...", email: "", role: "", role_code: "", is_teaching_faculty: false, organization: "", location: "", designation: "", orgType: "", avatarUrl: "" });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("edusphere_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setShowProfileMenu(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/me/`, { headers: { Authorization: `Bearer ${token}` } });
        const userData = response.data;
        setUser({
          name: userData.name, email: userData.email, role: userData.role, role_code: userData.role_code, is_teaching_faculty: !!userData.is_teaching_faculty,
          organization: userData.organization, location: userData.location, designation: userData.designation, orgType: userData.org_type,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=6366f1&color=fff&bold=true`,
        });
        fetchNotifications(token);
      } catch (error) { console.error("Failed to fetch user profile", error); }
    };
    fetchUserData();
  }, []);

  const fetchNotifications = async (token) => {
      try {
          const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/notifications/`, { headers: { Authorization: `Bearer ${token}` } });
          setNotifications(res.data);
      } catch (e) { console.error("Could not load notifications"); }
  };

  const handleNotifClick = async (notif) => {
      setShowNotifMenu(false);
      if (!notif.is_read) {
          try {
              const token = localStorage.getItem("access_token");
              await axios.post(`${import.meta.env.VITE_API_URL}/api/user/notifications/${notif.id}/read/`, {}, { headers: { Authorization: `Bearer ${token}` } });
              setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
          } catch(e) {}
      }
      if (notif.action_url) {
          if (window.location.pathname === notif.action_url) window.location.reload(); 
          else navigate(notif.action_url);
      }
  };

  const handleLogout = () => { logout(); setShowLogoutConfirm(false); };
  const handleToggleTeaching = async (e) => {
    e.preventDefault();
    const newState = !user.is_teaching_faculty;
    setUser({ ...user, is_teaching_faculty: newState });
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(`${import.meta.env.VITE_API_URL}/api/user/toggle-teaching/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      window.location.reload();
    } catch (error) {
      setUser((prev) => ({ ...prev, is_teaching_faculty: !newState }));
      alert("Failed to update status.");
    }
  };

  const handleYearSelect = (e) => {
    const selectedId = parseInt(e.target.value);
    const selected = academicYears.find((ay) => ay.id === selectedId);
    if (selected && selected.id !== activeAcademicYear.id) setPendingYear(selected);
  };

  const confirmYearSwitch = () => { setActiveAcademicYear(pendingYear); setPendingYear(null); };

  const handleDeptChange = (e) => {
    const val = e.target.value;
    if (val === "ALL") setActiveDepartment({ id: "ALL", name: "All Departments" });
    else { const selected = departments.find((d) => d.id === parseInt(val)); if (selected) setActiveDepartment(selected); }
    window.location.reload();
  };

  let displayRole = user.designation;
  if (user?.role_code === "STUDENT") displayRole = "Student";
  else if (user?.role_code === "COUNSELLOR") displayRole = "Counsellor";
  else if (user?.role_code === "SPORTS_STAFF") displayRole = "Sports Dept";
  else if (displayRole === "Staff Member" && user.role) displayRole = user.role;
  else if (!displayRole) displayRole = "Staff Member";

  let displayDepartment = activeDepartment?.name;
  if (user?.role_code === "COUNSELLOR") displayDepartment = "Counselling Dept";
  else if (user?.role_code === "SPORTS_STAFF") displayDepartment = "Sports Dept";
  else if (!displayDepartment) displayDepartment = departments && departments.length > 0 ? departments[0].name : "No Department";

  const isOrgAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(user?.role_code);
  const isStudent = user?.role_code === "STUDENT";
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="topbar glass-panel">
      <div className="topbar-left">
        <button className="icon-btn menu-trigger" onClick={onMenuClick}><Menu size={24} /></button>
        
        {/* --- MOBILE SPECIFIC LOGO --- */}
        <div className="mobile-only mobile-logo-container">
            <img src="/logo.png" alt="Logo" className="mobile-logo" />
            <span className="logo-text" style={{ fontSize: '1.25rem' }}>EduSphere</span>
        </div>

        {/* --- DESKTOP BADGE --- */}
        <div className="academic-year-badge desktop-only" style={{ background: "rgba(79, 70, 229, 0.05)", borderColor: "rgba(79, 70, 229, 0.2)" }}>
          <Building2 size={16} className="text-primary" />
          {isOrgAdmin ? (
            <div style={{ display: "flex", alignItems: "center", marginLeft: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-color)", marginRight: "6px", whiteSpace: "nowrap" }} title={user.organization}>{getSmartAbbreviation(user.organization) || "Loading..."}</span>
              <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>/</span>
              <select className="year-selector" style={{ fontWeight: 600, paddingLeft: "4px" }} value={activeDepartment?.id || "ALL"} onChange={handleDeptChange} disabled={!activeDepartment} title="Change Active Department">
                <option value="ALL">All Departments (Org View)</option>
                {departments.map((dept) => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                {departments.length === 0 && <option value="">No Depts</option>}
              </select>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", marginLeft: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary-color)", marginRight: "6px", whiteSpace: "nowrap" }} title={user.organization}>{getSmartAbbreviation(user.organization) || "Organization"}</span>
              <span style={{ color: "var(--text-muted)", marginRight: "6px" }}>/</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{displayDepartment}</span>
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
        
        {/* Everything here is Desktop Only EXCEPT the notification bell */}
        <div className="search-container desktop-only"><Search size={18} className="search-icon" /><input type="text" placeholder="Search..." /></div>

        {activeAcademicYear && !isStudent && (
          <div className="academic-year-badge desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={16} className="text-primary" />
              <select className="year-selector" value={activeAcademicYear.id} onChange={handleYearSelect} title="Change Academic Year">
                {academicYears.map((ay) => (<option key={ay.id} value={ay.id}>{ay.name} {ay.is_active ? "(Current)" : ""}</option>))}
              </select>
            </div>
            <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-color)', opacity: 0.8 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={15} className="text-primary" />
              <select className="year-selector" value={activeTerm} onChange={(e) => setActiveTerm(e.target.value)} title="Change Term" style={{ width: 'auto', paddingRight: '12px' }}>
                <option value="ODD">Odd Term</option><option value="EVEN">Even Term</option>
              </select>
            </div>
          </div>
        )}
        
        {activeAcademicYear && isStudent && (
           <div className="academic-year-badge desktop-only" style={{ cursor: "default", opacity: 0.9, display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <Calendar size={16} className="text-primary" />
               <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)" }}>{activeAcademicYear.name}</span>
             </div>
             <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-color)', opacity: 0.8 }}></div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <Layers size={15} className="text-primary" />
               <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-primary)", textTransform: 'capitalize' }}>{activeTerm.toLowerCase()} Term</span>
             </div>
           </div>
        )}

        <button className="icon-btn desktop-only" onClick={toggleTheme}>
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* NOTIFICATION BELL: Stays visible on both Desktop and Mobile */}
        <div className="profile-container" ref={notifRef}>
          <button className="icon-btn" onClick={() => setShowNotifMenu(!showNotifMenu)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="notification-dot" style={{ position: 'absolute', top: '6px', right: '6px', height: '8px', width: '8px', background: '#ef4444', borderRadius: '50%' }}></span>}
          </button>
          
          {showNotifMenu && (
            <div className="profile-dropdown slide-down-fade" style={{ width: '320px', right: '-80px', padding: '0' }}>
              <div style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>Notifications</h4>
                {unreadCount > 0 && <span className="badge badge-role" style={{ fontSize: '0.75rem' }}>{unreadCount} New</span>}
              </div>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>You're all caught up!</p>
                ) : notifications.map(n => (
                    <div key={n.id} onClick={() => handleNotifClick(n)} style={{ padding: '12px 15px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: n.is_read ? 'transparent' : 'var(--bg-input)', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'var(--bg-input)'}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.is_read ? 'transparent' : '#ef4444', marginTop: '6px', flexShrink: 0 }}></div>
                        <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: n.is_read ? 500 : 600, color: 'var(--text-primary)' }}>{n.title}</p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</p>
                            <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.created_at}</p>
                        </div>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DESKTOP PROFILE MENU (Hidden on mobile) */}
        <div className="profile-container desktop-only" ref={menuRef}>
          <div className={`profile-chip ${showProfileMenu ? "active" : ""}`} onClick={() => setShowProfileMenu(!showProfileMenu)}>
            <img src={user.avatarUrl || "https://ui-avatars.com/api/?name=User&background=random"} alt="Profile" />
            <div className="profile-info"><span className="name" title={user.name}>{getFirstAndLastName(user.name)}</span><span className="role">{displayRole}</span></div>
            <ChevronDown size={16} className={`dropdown-arrow ${showProfileMenu ? "rotate" : ""}`} />
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown slide-down-fade">
              <div className="dropdown-header">
                <img src={user.avatarUrl} alt="User" className="large-avatar" />
                <div className="header-info">
                  <h4>{user.name}</h4><p>{user.email}</p>
                  <div className="org-info"><span className="org-badge">{getSmartAbbreviation(user.organization)} <BadgeCheck size={12} style={{ marginLeft: 4 }} /></span></div>
                </div>
              </div>
              <div className="dropdown-divider"></div>
              <ul className="dropdown-menu">
                {isOrgAdmin && (
                  <li className="info-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><GraduationCap size={18} className="text-primary" /><span className="label" style={{ margin: 0, fontWeight: 500 }}>Join Faculty Registry</span></div>
                    <label style={{ cursor: "pointer", display: "flex", alignItems: "center", margin: 0 }}>
                      <input type="checkbox" checked={user.is_teaching_faculty} onChange={handleToggleTeaching} style={{ display: "none" }} />
                      <div style={{ width: "36px", height: "20px", borderRadius: "10px", background: user.is_teaching_faculty ? "var(--primary-color)" : "var(--border-color)", position: "relative", transition: "all 0.3s ease" }}>
                        <div style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", position: "absolute", top: "2px", left: user.is_teaching_faculty ? "18px" : "2px", transition: "all 0.3s ease", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
                      </div>
                    </label>
                  </li>
                )}
                <li className="info-item"><Briefcase size={18} className="text-primary" /><div className="item-text"><span className="label">Designation</span><span className="value">{displayRole || "N/A"}</span></div></li>
                <li className="info-item"><Building2 size={18} className="text-primary" /><div className="item-text"><span className="label">Institute Type</span><span className="value">{user.orgType || "N/A"}</span></div></li>
                <div className="dropdown-divider"></div>
                <li><Settings size={18} /><span>Account Settings</span></li>
              </ul>
              <div className="dropdown-divider"></div>
              <div className="dropdown-footer">
                <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}><LogOut size={18} /><span>Sign Out</span></button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showLogoutConfirm && createPortal(
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="warning-icon"><AlertTriangle size={32} /></div>
            <h3>Sign Out?</h3>
            <p>Are you sure you want to end your session?</p>
            <div className="confirm-actions">
              <button className="text-btn" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="danger-btn" onClick={handleLogout}>Yes, Sign Out</button>
            </div>
          </div>
        </div>, document.body
      )}

      {pendingYear && createPortal(
        <div className="modal-overlay" onClick={() => setPendingYear(null)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="warning-icon" style={{ color: "#3b82f6", background: "rgba(59, 130, 246, 0.1)" }}><Info size={32} /></div>
            <h3>Change Dashboard Context?</h3>
            <p>You are switching your view to the <strong>{pendingYear.name}</strong> academic year. This will reload directories, matrices, and dashboards to show past or future data.</p>
            <div className="confirm-actions" style={{ marginTop: "1.5rem" }}>
              <button className="text-btn" onClick={() => setPendingYear(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmYearSwitch} style={{ padding: "0.6rem 1.2rem", borderRadius: "8px" }}>Switch View</button>
            </div>
          </div>
        </div>, document.body
      )}
    </header>
  );
};
export default Topbar;