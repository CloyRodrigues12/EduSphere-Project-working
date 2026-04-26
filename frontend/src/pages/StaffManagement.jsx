import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  GraduationCap,
  CheckCircle,
  Clock,
  Upload,
  X,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  User as UserIcon,
  AlertTriangle,
  Check,
  Edit2,
  Send,
  Info,
  Globe,
  Lock,
  Zap,
  HeartHandshake,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import "./StaffManagement.css";
import { staffService, academicService } from "../services/api";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext"; 

const getInitials = (name) => {
  if (!name) return "F";
  const cleanName = name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, "");
  const parts = cleanName.trim().split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return cleanName[0].toUpperCase();
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4f46e5, #3730a3)",
  "linear-gradient(135deg, #059669, #047857)",
  "linear-gradient(135deg, #e11d48, #be123c)",
  "linear-gradient(135deg, #d97706, #b45309)",
  "linear-gradient(135deg, #475569, #334155)",
  "linear-gradient(135deg, #0284c7, #0369a1)",
  "linear-gradient(135deg, #9333ea, #7e22ce)",
];

const getColorForName = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const StaffManagement = () => {
  const { user } = useAuth(); 
  const isHOD = user?.role_code === "HOD"; 

  const [activeTab, setActiveTab] = useState("faculty");
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Student Accounts State ---
  const [studentAccounts, setStudentAccounts] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [studentDomain, setStudentDomain] = useState("");
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [generatingAccounts, setGeneratingAccounts] = useState(false);

  // --- Filters ---
  const [yearFilter, setYearFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");

  const { activeAcademicYear, activeDepartment } = useAcademic();
  const [showWorkloadModal, setShowWorkloadModal] = useState(false);
  const [selectedWorkload, setSelectedWorkload] = useState([]);
  const [workloadFacultyName, setWorkloadFacultyName] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    fetchMembers();
    fetchDepartments();
  }, [activeTab]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const fetchDepartments = async () => {
    try {
      const res = await staffService.getDepartments();
      setDepartments(res.data);
    } catch (e) {
      console.error("Could not load departments");
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      if (activeTab === "student_accounts") {
        const res = await staffService.getStudentAccounts();
        setStudentAccounts(res.data.students);
        setStudentStats(res.data.stats);
        setStudentDomain(res.data.domain);
      } else if (["staff", "counsellor", "sports_staff"].includes(activeTab)) {
        const response = await staffService.getStaff();
        setMembers(response.data);
      } else {
        const response = await staffService.getFaculty();
        setMembers(response.data);
      }
    } catch (error) {
      showToast("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleViewWorkload = async (faculty) => {
    if (!activeAcademicYear)
      return showToast("Select an Academic Year first.", "error");
    try {
      const res = await academicService.getAllocations(
        activeAcademicYear.id,
        faculty.id,
      );
      setSelectedWorkload(res.data);
      setWorkloadFacultyName(faculty.full_name || faculty.name);
      setShowWorkloadModal(true);
    } catch (err) {
      showToast("Failed to load workload data.", "error");
    }
  };

  const handleResendInvite = async (email, role) => {
    try {
      await staffService.inviteStaff({ email, role, action: "resend" });
      showToast(`Invite resent to ${email}`, "success");
    } catch (err) {
      showToast("Failed to resend invite", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (activeTab === "faculty")
        await staffService.deleteFaculty(deleteTarget.id);
      else 
        await staffService.deleteStaff(deleteTarget.id);
      
      showToast("User removed successfully", "success");
      fetchMembers();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleGenerateAccounts = async () => {
    if (!studentDomain) return showToast("Please configure the domain first.", "error");
    setGeneratingAccounts(true);
    try {
      const res = await staffService.manageStudentAccounts({ action: "generate_accounts" });
      showToast(res.data.message, "success");
      fetchMembers();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to generate accounts.", "error");
    } finally {
      setGeneratingAccounts(false);
    }
  };

  const displayedData = activeTab === "student_accounts" 
    ? studentAccounts.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.roll_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchYear = yearFilter === "ALL" || s.year_level === yearFilter;
        const matchDept = deptFilter === "ALL" || s.department === deptFilter;
        return matchSearch && matchYear && matchDept;
      })
    : members.filter((m) => {
        const displayName = m.full_name || m.name || "";
        const matchSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) || m.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchTab = true;
        if (activeTab === "staff") {
          matchTab = ["STAFF", "ORG_ADMIN", "SUPER_ADMIN"].includes(m.role_code);
        } else if (activeTab === "counsellor") {
          matchTab = m.role_code === "COUNSELLOR";
        } else if (activeTab === "sports_staff") {
          matchTab = m.role_code === "SPORTS_STAFF";
        }
        
        return matchSearch && matchTab;
      });

  return (
    <div className="staff-container fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <Check size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Team Management</h1>
        </div>
        {activeTab !== "student_accounts" && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <UserPlus size={18} />{" "}
            {activeTab === "faculty" ? "Add Faculty" : "Invite Team Member"}
          </motion.button>
        )}
      </div>

      <div className="tabs-wrapper">
        <div className="desktop-tabs">
          {["faculty", "staff", "counsellor", "sports_staff", "student_accounts"].map((tab) => {
            if (isHOD && tab !== "faculty" && tab !== "student_accounts") return null;

            let Icon = Users;
            let label = "";
            if (tab === "faculty") { Icon = GraduationCap; label = "Faculty Registry"; }
            else if (tab === "staff") { Icon = Users; label = "Office Staff"; }
            else if (tab === "counsellor") { Icon = HeartHandshake; label = "Counselling Dept"; }
            else if (tab === "sports_staff") { Icon = Trophy; label = "Sports Dept"; }
            else if (tab === "student_accounts") { Icon = UserIcon; label = "Student Accounts"; }

            return (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={18} />
                {label}
                {activeTab === tab && <motion.div className="active-tab-indicator" layoutId="sm-activeTab" />}
              </button>
            );
          })}
        </div>

        <div className="mobile-tabs" >
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value)}
            style={{padding:"14px"}}
          >
            <option value="faculty">🎓 View: Faculty Registry</option>
            {!isHOD && <option value="staff">👥 View: Office Staff</option>}
            {!isHOD && <option value="counsellor">🤝 View: Counselling Dept</option>}
            {!isHOD && <option value="sports_staff">🏆 View: Sports Dept</option>}
            <option value="student_accounts">💻 View: Student Accounts</option>
          </select>
        </div>
      </div>

      {activeTab === "student_accounts" && studentStats && (
        <div className="student-accounts-dashboard">
          <div className="glass-panel domain-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <Globe size={24} color="var(--primary-color)"/>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Institution Domain</h3>
            </div>
            <p style={{ margin: '0 0 1rem 0', fontWeight: '600', fontSize: '1.1rem' }}>
              {studentDomain ? `@${studentDomain}` : "No domain configured yet."}
            </p>
            {!isHOD && (
              <button className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setShowDomainModal(true)}>
                <Lock size={14} style={{ display: 'inline', marginRight: '6px' }} /> Edit Secure Domain
              </button>
            )}
            {isHOD && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}><Lock size={12} style={{ display: 'inline' }}/> Domain managed by Org Admin</p>
            )}
          </div>

          <div className="glass-panel sync-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Account Generation Status</h3>
                <div className="stats-row">
                  <div className="stat-pill neutral">Total Active: <strong>{studentStats.total}</strong></div>
                  <div className="stat-pill success">Created: <strong>{studentStats.created}</strong></div>
                  <div className="stat-pill danger">Pending: <strong>{studentStats.pending}</strong></div>
                </div>
              </div>
              <button 
                className="btn-primary" 
                onClick={handleGenerateAccounts} 
                disabled={studentStats.pending === 0 || generatingAccounts || !studentDomain}
              >
                <Zap size={18} /> 
                {generatingAccounts ? "Generating..." : "Generate Pending Accounts"}
              </button>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Dept Overview:</span>
              {Object.entries(studentStats.departments).map(([dept, data]) => (
                <span key={dept} className="badge badge-designation">
                  <strong>{dept}</strong>: {data.created}/{data.total}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="search-bar">
          <Search size={18} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder={`Search ${activeTab.replace('_', ' ')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {activeTab === "student_accounts" && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
            {!isHOD && (
              <select className="filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="ALL">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.code}>{d.code}</option>)}
              </select>
            )}
            <select className="filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="ALL">All Years</option>
              <option value="FE">First Year (FE)</option>
              <option value="SE">Second Year (SE)</option>
              <option value="TE">Third Year (TE)</option>
              <option value="BE">Final Year (BE)</option>
            </select>
          </div>
        )}
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading records...</p>
          </div>
        ) : (
          <>
            <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  {activeTab === "student_accounts" ? (
                    <tr>
                      <th>Student Info</th>
                      <th>Portal Email</th>
                      <th>Department</th>
                      <th>Default Password Form</th>
                      <th>Status</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Name</th>
                      <th>Role / Designation</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  <AnimatePresence mode="wait">
                    {displayedData.length > 0 ? (
                      displayedData.map((member) => {
                        if (activeTab === "student_accounts") {
                          return (
                            <motion.tr key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                              <td>
                                <div style={{ fontWeight: '600' }}>{member.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{member.roll_number} • {member.year_level}</div>
                              </td>
                              <td>
                                <span style={{ color: member.status !== "Pending" ? "var(--primary-color)" : "var(--text-secondary)", fontWeight: member.status !== "Pending" ? "600" : "normal" }}>
                                  {member.email}
                                </span>
                              </td>
                              <td>{member.department}</td>
                              <td>
                                {member.has_dob 
                                  ? <span style={{ color: "#10b981", fontSize: "0.85rem", fontWeight: "700" }}>DDMMYYYY</span> 
                                  : <span style={{ color: "#f59e0b", fontSize: "0.85rem", fontWeight: "700" }}>RollNo@123</span>
                                }
                              </td>
                              <td>
                                {member.status === "Active" ? (
                                  <span className="status-badge active"><CheckCircle size={14} /> Logged In</span>
                                ) : member.status === "Never Logged In" ? (
                                  <span className="status-badge" style={{ color: "#3b82f6", background: "rgba(59,130,246,0.1)" }}>
                                    <UserIcon size={14} /> Created
                                  </span>
                                ) : (
                                  <span className="status-badge pending"><Clock size={14} /> Pending</span>
                                )}
                              </td>
                            </motion.tr>
                          );
                        }

                        const displayName = member.full_name || member.name || "Unknown";
                        const isSelf = member.email === user?.email; 
                        const deptName = member.department_name || member.department || "";
                        const isExternal = isHOD && deptName !== activeDepartment?.name;

                        return (
                          <motion.tr key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <td>
                              <div className="user-cell">
                                {member.profile_picture ? (
                                  <img src={`http://127.0.0.1:8000${member.profile_picture}`} alt="Profile" className="avatar-img" />
                                ) : (
                                  <div className="avatar-circle" style={{ background: getColorForName(displayName) }}>
                                    {getInitials(displayName)}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: '600' }}>{displayName}</div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {member.role_code === "HOD" ? (
                                <span className="badge" style={{ background: "#f59e0b", color: "#fff" }}>Head of Department</span>
                              ) : activeTab === "faculty" ? (
                                <span className="badge badge-designation">{member.designation || "Faculty"}</span>
                              ) : (
                                <span className="badge badge-role" style={{ textTransform: 'capitalize' }}>
                                  {member.role_code === "ORG_ADMIN" || member.role_code === "SUPER_ADMIN" ? "Admin" : member.role_code.replace('_', ' ').toLowerCase()}
                                </span>
                              )}
                            </td>
                            <td>
                              {deptName || "-"}
                              {isExternal && <span className="badge" style={{ background: "rgba(245,158,11,0.1)", color: "#d97706", marginLeft: "8px" }}>External</span>}
                            </td>
                            <td>
                              {member.is_setup_complete || member.status === "Active" ? (
                                <span className="status-badge active"><CheckCircle size={14} /> Active</span>
                              ) : (
                                <span className="status-badge pending"><Clock size={14} /> Invited</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                                {activeTab === "faculty" && (
                                  <button className="btn-icon" onClick={() => handleViewWorkload(member)} title="View Workload" style={{ color: "#3b82f6" }}>
                                    <Info size={18} />
                                  </button>
                                )}
                                {activeTab === "faculty" && !(isHOD && isSelf) && !isExternal && (
                                  <button className="btn-icon" onClick={() => setEditTarget(member)} title="Edit Faculty">
                                    <Edit2 size={18} />
                                  </button>
                                )}
                                {["staff", "counsellor", "sports_staff"].includes(activeTab) && member.status === "Invited" && (
                                  <button className="btn-icon" onClick={() => handleResendInvite(member.email, member.role_code)} title="Resend Email">
                                    <Send size={18} />
                                  </button>
                                )}
                                {member.role_code !== "ORG_ADMIN" && member.role_code !== "SUPER_ADMIN" && !(isHOD && isSelf) && !isExternal && (
                                  <button className="btn-icon danger" onClick={() => setDeleteTarget(member)} title="Remove User">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    ) : (
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                          <Users size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3, margin: '0 auto 1rem' }} />
                          <p style={{ color: 'var(--text-secondary)' }}>No records found matching filters.</p>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showDomainModal && (
          <DomainEditModal currentDomain={studentDomain} onClose={() => setShowDomainModal(false)} onRefresh={fetchMembers} showToast={showToast} />
        )}
        {showAddModal && (activeTab === "faculty" ? (
            <FacultyFormModal onClose={() => setShowAddModal(false)} onRefresh={fetchMembers} showToast={showToast} departments={departments} isHOD={isHOD} activeDepartment={activeDepartment} />
          ) : (
            <InviteStaffModal onClose={() => setShowAddModal(false)} onRefresh={fetchMembers} showToast={showToast} defaultRole={activeTab === 'counsellor' ? 'COUNSELLOR' : activeTab === 'sports_staff' ? 'SPORTS_STAFF' : 'STAFF'} />
        ))}
        {editTarget && (
          <FacultyFormModal facultyData={editTarget} onClose={() => setEditTarget(null)} onRefresh={fetchMembers} showToast={showToast} departments={departments} isHOD={isHOD} activeDepartment={activeDepartment} />
        )}

        {deleteTarget && (
          <div className="modal-overlay">
            <motion.div className="premium-modal delete-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ padding: '2.5rem 2rem 2rem', textAlign: 'center', maxWidth: '400px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Trash2 size={32} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>Remove User?</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem 0' }}>Are you sure you want to remove <strong>{deleteTarget.full_name || deleteTarget.name}</strong>?</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn-danger" onClick={confirmDelete}>Yes, Remove</button>
              </div>
            </motion.div>
          </div>
        )}
        
        {showWorkloadModal && (
          <div className="modal-overlay">
            <motion.div className="premium-modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="modal-header">
                <div><h3>Faculty Workload</h3><p className="modal-subtitle">Assignments for Prof. {workloadFacultyName}</p></div>
                <button onClick={() => setShowWorkloadModal(false)} className="close-btn"><X size={20} /></button>
              </div>
              <div className="premium-form">
                {selectedWorkload.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No subjects assigned for this academic year.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedWorkload.map((alloc) => (
                      <div key={alloc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: 'center', padding: "1rem", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
                        <div>
                          <strong style={{ display: "block", fontSize: '1.05rem', marginBottom: '4px' }}>{alloc.subject_name} ({alloc.subject_code})</strong>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Semester {alloc.semester} • {alloc.subject_type.replace("_", " ")}</span>
                        </div>
                        <span className="badge" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>Batch: {alloc.group_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Secure Domain Modal ---
const DomainEditModal = ({ currentDomain, onClose, onRefresh, showToast }) => {
  const [domain, setDomain] = useState(currentDomain || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await staffService.manageStudentAccounts({ action: 'update_domain', domain, password });
      showToast("Domain updated successfully", "success");
      onRefresh(); onClose();
    } catch(err) {
      showToast(err.response?.data?.error || "Error updating domain", "error");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="premium-modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <div><h3>Configure Domain</h3><p className="modal-subtitle">Set the suffix for auto-generated student emails.</p></div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form sm-form-grid single-col">
            <div className="sm-input-group">
              <label>Student Email Domain</label>
              <div className="sm-input-wrapper">
                <Globe size={18} className="sm-input-icon" />
                <input className="sm-input" type="text" required placeholder="e.g. dbcegoa.ac.in" value={domain} onChange={(e) => setDomain(e.target.value)} />
              </div>
              <small style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Emails will look like: <em>rollnumber@{domain || 'domain.com'}</em></small>
            </div>
            <div className="sm-input-group">
              <label>Your Admin Password (Required)</label>
              <div className="sm-input-wrapper">
                <Lock size={18} className="sm-input-icon" />
                <input className="sm-input" type="password" required placeholder="Confirm your password..." value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? "Verifying..." : "Save Domain"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- OPTIMIZED FACULTY FORM ---
const FacultyFormModal = ({ onClose, onRefresh, showToast, departments, facultyData = null, isHOD, activeDepartment }) => {
  const isEdit = !!facultyData;
  const resolvedName = facultyData?.full_name || facultyData?.name || "";

  let initialDeptId = "";
  if (facultyData) {
    if (facultyData.department_id) initialDeptId = facultyData.department_id;
    else if (typeof facultyData.department === "number") initialDeptId = facultyData.department;
    else {
      const found = departments.find(d => d.name === facultyData.department);
      if (found) initialDeptId = found.id;
    }
  }
  if (!initialDeptId) initialDeptId = (isHOD && activeDepartment) ? activeDepartment.id : (departments.length > 0 ? departments[0].id : "");

  const [formData, setFormData] = useState({
    full_name: resolvedName, email: facultyData?.email || "", role: facultyData ? facultyData.role_code : (isHOD ? "FACULTY" : "FACULTY"),
    designation: facultyData?.designation || "Assistant Professor", phone_number: facultyData?.phone_number || "", department_id: initialDeptId,
    profile_picture: null, remove_picture: false,
  });

  const [preview, setPreview] = useState(facultyData?.profile_picture ? `http://127.0.0.1:8000${facultyData.profile_picture}` : null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setFormData({ ...formData, profile_picture: file, remove_picture: false }); setPreview(URL.createObjectURL(file)); }
  };
  const removeImage = () => { setFormData({ ...formData, profile_picture: null, remove_picture: true }); setPreview(null); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const payload = new FormData();
    Object.keys(formData).forEach((key) => {
      if (key === "designation" && formData.role === "HOD") payload.append("designation", "Head of Department");
      else if (formData[key] !== null) payload.append(key, formData[key]);
    });

    try {
      if (isEdit) await staffService.editFaculty(facultyData.id, payload);
      else await staffService.addFaculty(payload);
      showToast(isEdit ? "Faculty member updated!" : "Faculty member added successfully!");
      onRefresh(); onClose();
    } catch (err) { showToast(err.response?.data?.error || "Error saving faculty", "error"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="premium-modal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <div><h3>{isEdit ? "Edit Faculty Profile" : "Add New Faculty"}</h3><p className="modal-subtitle">{isEdit ? "Update their academic details." : "Create their academic profile."}</p></div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form">
            <div className="avatar-selection-area">
              <div className="avatar-preview-large">
                {preview ? <img src={preview} alt="Preview" /> : <div className="monogram-avatar" style={{ background: getColorForName(formData.full_name || "F") }}>{getInitials(formData.full_name)}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {preview ? (
                  <>
                    <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '0.9rem' }}><CheckCircle size={16} /> Photo Applied</span>
                    <button type="button" onClick={removeImage} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', padding: 0, cursor: 'pointer', fontWeight: '600', textAlign: 'left', fontSize: '0.9rem' }}>Remove photo</button>
                  </>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' }}>
                    <Upload size={18} /> Upload Custom Photo
                    <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
            
            {/* 🚨 Applied isolated SM input classes */}
            <div className="sm-form-grid">
              <div className="sm-input-group">
                <label>Full Name</label>
                <div className="sm-input-wrapper"><UserIcon size={18} className="sm-input-icon" /><input type="text" required className="sm-input" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} /></div>
              </div>
              <div className="sm-input-group">
                <label>College Email</label>
                <div className="sm-input-wrapper">
                  <Mail size={18} className="sm-input-icon" />
                  <input type="email" required disabled={isEdit} className="sm-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={isEdit ? { opacity: 0.6 } : {}} />
                </div>
              </div>
              <div className="sm-input-group">
                <label>System Role</label>
                <div className="sm-input-wrapper">
                  <Briefcase size={18} className="sm-input-icon" />
                  <select className="sm-select" value={formData.role} disabled={isHOD || ["SUPER_ADMIN", "ORG_ADMIN"].includes(facultyData?.role_code)} onChange={(e) => setFormData({ ...formData, role: e.target.value })} style={(isHOD || ["SUPER_ADMIN", "ORG_ADMIN"].includes(facultyData?.role_code)) ? { opacity: 0.6 } : {}}>
                    <option value="FACULTY">Teaching Faculty</option>
                    {!isHOD && <option value="HOD">Head of Department (HOD)</option>}
                    {["SUPER_ADMIN", "ORG_ADMIN"].includes(facultyData?.role_code) && <option value={facultyData.role_code}>Organization Admin</option>}
                  </select>
                </div>
              </div>
              <div className="sm-input-group">
                <label>Assigned Department</label>
                <div className="sm-input-wrapper">
                  <GraduationCap size={18} className="sm-input-icon" />
                  <select required className="sm-select" value={formData.department_id} disabled={isHOD} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })} style={isHOD ? { opacity: 0.6 } : {}}>
                    <option value="" disabled>Select Department...</option>
                    {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>)}
                  </select>
                </div>
              </div>
              {formData.role !== "HOD" && (
                <div className="sm-input-group">
                  <label>Designation</label>
                  <div className="sm-input-wrapper">
                    <Briefcase size={18} className="sm-input-icon" />
                    <select className="sm-select" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })}>
                      <option>Assistant Professor</option><option>Associate Professor</option><option>Professor</option><option>Visiting Faculty</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="sm-input-group">
                <label>Phone Number</label>
                <div className="sm-input-wrapper"><Phone size={18} className="sm-input-icon" /><input type="text" className="sm-input" value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} /></div>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? "Saving..." : isEdit ? "Save Changes" : "Create Profile"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Invite Staff Modal ---
const InviteStaffModal = ({ onClose, onRefresh, showToast, defaultRole }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(defaultRole || "STAFF");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await staffService.inviteStaff({ email, full_name: fullName, role });
      showToast(`Invite sent to ${email}`);
      onRefresh(); onClose();
    } catch (err) { showToast(err.response?.data?.error || "Error inviting staff", "error"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="premium-modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <div><h3>Invite Staff / Member</h3><p className="modal-subtitle">Send an invitation to join the platform.</p></div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form sm-form-grid single-col">
            <div className="sm-input-group">
              <label>Full Name</label>
              <div className="sm-input-wrapper"><UserIcon size={18} className="sm-input-icon" /><input type="text" required className="sm-input" placeholder="Enter member's full name" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            </div>
            <div className="sm-input-group">
              <label>Email Address</label>
              <div className="sm-input-wrapper"><Mail size={18} className="sm-input-icon" /><input type="email" required className="sm-input" placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="sm-input-group">
              <label>Access Level / Department</label>
              <div className="sm-input-wrapper">
                <Briefcase size={18} className="sm-input-icon" />
                <select className="sm-select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="STAFF">Office Staff / Viewer</option>
                  <option value="ORG_ADMIN">Organization Admin</option>
                  <option value="COUNSELLOR">Counselling Dept</option>
                  <option value="SPORTS_STAFF">Sports Dept</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? "Sending..." : "Send Invitation"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default StaffManagement;