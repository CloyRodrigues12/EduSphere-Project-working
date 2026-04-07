import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAcademic } from "../context/AcademicContext"; // <-- NEW: Added Academic Context
import { staffService, counsellingService } from "../services/api";
import { Users, Plus, Trash2, Search, CheckSquare, Square, X, AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./ClassTeacherAssignments.css";

const getYearLevel = (sem) => {
  if (!sem) return "Unknown";
  if (sem <= 2) return "FE";
  if (sem <= 4) return "SE";
  if (sem <= 6) return "TE";
  return "BE";
};

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path}`;
};

const CounsellorMentorManagement = () => {
  const { user } = useAuth();
  const { activeDepartment } = useAcademic(); // <-- NEW: Securely get HOD's department
  const [loading, setLoading] = useState(true);

  // Data State
  const [departments, setDepartments] = useState([]);
  const [activeDept, setActiveDept] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [mentorSummary, setMentorSummary] = useState([]);
  
  // Modals & Search
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMentorCard, setSelectedMentorCard] = useState(null); 
  const [mentorSearch, setMentorSearch] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const isCounsellor = user?.role === "COUNSELLOR" || user?.role_code === "COUNSELLOR";
  const isHOD = user?.role_code === "HOD";

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  useEffect(() => {
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDepartment]); // Re-run if department context loads

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [facRes, sumRes, deptRes] = await Promise.all([
        staffService.getOrganizationFaculties(), 
        counsellingService.getMentorSummary(),
        staffService.getDepartments()
      ]);
      
      setFaculties(facRes.data);
      setMentorSummary(sumRes.data);
      
      // --- FIXED: HOD SANDBOXING LOGIC ---
      let availableDepts = deptRes.data;
      if (isHOD && activeDepartment) {
          // Strictly filter departments down to just the HOD's active department
          availableDepts = availableDepts.filter(d => d.id === activeDepartment.id);
      }
      setDepartments(availableDepts);
      
      if (availableDepts.length > 0 && !activeDept) {
        setActiveDept(availableDepts[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMentors = mentorSummary.filter(m => 
    m.mentor_department_id === activeDept &&
    m.mentor_name.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  return (
    <div className="assignments-container fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Mentor Allocation</h1>
          <p className="page-subtitle">
            {isHOD ? "Department Mentorship Overview" : "Counselling Department Overview"}
          </p>
        </div>
        {!isCounsellor && (
            <div className="read-only-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                <Shield size={16} /> {isHOD ? "HOD Read-Only View" : "Admin Read-Only View"}
            </div>
        )}
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: "3rem auto" }}></div>
      ) : (
        <div style={{ marginTop: "1rem" }}>
          
          {/* --- FIXED: ALWAYS SHOW DEPARTMENT TABS --- */}
          <div className="tabs-container" style={{ overflowX: "auto", display: "flex", gap: "10px", paddingBottom: "5px", marginBottom: "1.5rem" }}>
            {departments.map((dept) => (
              <button
                key={dept.id}
                className={`tab-btn ${activeDept === dept.id ? "active" : ""}`}
                style={{ whiteSpace: "nowrap" }}
                onClick={() => setActiveDept(dept.id)}
              >
                {dept.name} ({dept.code})
                {activeDept === dept.id && (
                  <motion.div className="active-tab-indicator" layoutId="activeDeptTab" />
                )}
              </button>
            ))}
          </div>

          <div className="toolbar" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>
                  {departments.length === 1 ? `${departments[0].name} Mentors` : "Department Mentors"}
              </h3>
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search mentors..." 
                  value={mentorSearch} 
                  onChange={(e) => setMentorSearch(e.target.value)} 
                />
              </div>
            </div>
            {isCounsellor && (
              <button className="btn-primary" onClick={() => setShowAssignModal(true)}>
                <Plus size={18} /> Assign Mentees
              </button>
            )}
          </div>

          <div className="mentor-grid">
            {filteredMentors.length > 0 ? filteredMentors.map(mentor => {
              const activeMenteesCount = mentor.mentees.filter(m => m.is_active && m.semester <= 8).length;

              return (
                <motion.div 
                  key={mentor.mentor_id} 
                  className="mentor-card glass-panel"
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedMentorCard(mentor)}
                >
                  <div className="mentor-card-header">
                    {mentor.profile_picture ? (
                      <img src={getImageUrl(mentor.profile_picture)} alt="Profile" className="avatar-circle-sm" style={{ objectFit: "cover" }} />
                    ) : (
                      <div className="avatar-circle-sm" style={{ background: "var(--primary-color)" }}>
                        {mentor.mentor_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1.1rem" }}>{mentor.mentor_name}</h4>
                      <span className="text-sm text-muted">{activeMenteesCount} Active Mentees</span>
                    </div>
                  </div>
                  <div className="mentor-card-body">
                    <p className="text-sm text-primary font-medium" style={{ margin: 0 }}>
                      {isCounsellor ? "Click to manage mentees \u2192" : "Click to view mentees \u2192"}
                    </p>
                  </div>
                </motion.div>
              );
            }) : (
              <div className="empty-state glass-panel" style={{ gridColumn: "1 / -1" }}>
                <Users size={48} className="text-muted opacity-20 mb-2" />
                <p>No mentors found in this department.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showAssignModal && isCounsellor && (
          <AssignMenteesModal 
            faculties={faculties} 
            activeDept={activeDept} 
            onClose={() => setShowAssignModal(false)} 
            onRefresh={fetchInitialData} 
            showToast={showToast}
          />
        )}

        {selectedMentorCard && (
          <ViewMenteesModal 
            mentor={selectedMentorCard} 
            isCounsellor={isCounsellor} 
            onClose={() => setSelectedMentorCard(null)} 
            onRefresh={fetchInitialData} 
            showToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB COMPONENTS ---

const AssignMenteesModal = ({ faculties, activeDept, onClose, onRefresh, showToast }) => {
  const [students, setStudents] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [studentSearch, setStudentSearch] = useState(""); 
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  useEffect(() => {
    counsellingService.getMentorStudents().then(res => setStudents(res.data));
  }, []);

  const filteredFaculties = faculties.filter(f => f.department === activeDept);

  const filteredStudents = students.filter(s => {
    const matchesDept = s.department_id === activeDept;
    const matchesYear = yearFilter === "ALL" || getYearLevel(s.semester) === yearFilter;
    const matchesSearch = s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          s.roll_number.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesDept && matchesYear && matchesSearch;
  });

  const toggleStudent = (id) => {
    const newSet = new Set(selectedStudents);
    if(newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const handleAssignClick = () => {
    if(!selectedFaculty || selectedStudents.size === 0) return;
    
    const overriding = Array.from(selectedStudents).some(id => {
      const st = students.find(s => s.id === id);
      return st && st.mentor_name !== "Unassigned";
    });

    if (overriding) setShowOverrideConfirm(true);
    else executeAssign();
  };

  const executeAssign = async () => {
    setSaving(true);
    try {
      await counsellingService.assignMentors({ mentor_id: selectedFaculty, student_ids: Array.from(selectedStudents) });
      showToast("Mentors assigned successfully!");
      onRefresh();
      onClose();
    } catch(err) {
      showToast("Failed to assign mentors.", "error");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal large-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <h3>Assign Mentees</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }} className="premium-form">
          <div className="sinput-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Select Mentor</label>
            <select value={selectedFaculty} onChange={e => setSelectedFaculty(e.target.value)}>
              <option value="">-- Choose Faculty --</option>
              {filteredFaculties.map(f => <option key={f.id} value={f.id}>{f.full_name || f.name}</option>)}
            </select>
          </div>
          <div className="sinput-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Filter Students</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
              <option value="ALL">All Years</option>
              <option value="FE">First Year (FE)</option>
              <option value="SE">Second Year (SE)</option>
              <option value="TE">Third Year (TE)</option>
              <option value="BE">Final Year (BE)</option>
            </select>
          </div>
        </div>
        
        <div className="search-bar" style={{ marginBottom: "1rem", width: "100%" }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search students to assign..." 
            value={studentSearch} 
            onChange={(e) => setStudentSearch(e.target.value)} 
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", marginLeft: "0.5rem", color: "var(--text-primary)" }}
          />
        </div>

        <div className="scrollable-table-container" style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          <table className="data-table">
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-main)" }}>
              <tr>
                <th style={{ width: "50px", textAlign: "center" }}>Select</th>
                <th>Roll No</th>
                <th>Name</th>
                <th>Current Mentor</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan="4" className="text-center text-muted py-4">No students found in this department.</td></tr>
              ) : filteredStudents.map(s => (
                <tr key={s.id} onClick={() => toggleStudent(s.id)} style={{ cursor: "pointer", background: selectedStudents.has(s.id) ? "var(--bg-input)" : "transparent" }}>
                  <td style={{ textAlign: "center" }}>
                    {selectedStudents.has(s.id) ? <CheckSquare className="text-primary" size={18}/> : <Square className="text-muted" size={18}/>}
                  </td>
                  <td>{s.roll_number}</td>
                  <td>{s.full_name}</td>
                  <td><span className={`badge ${s.mentor_name === 'Unassigned' ? 'badge-role' : 'badge-designation'}`}>{s.mentor_name}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions" style={{ marginTop: "1rem" }}>
          <span className="text-primary font-medium">{selectedStudents.size} Selected</span>
          <div>
            <button onClick={onClose} className="btn-secondary" style={{ marginRight: "10px" }}>Cancel</button>
            <button onClick={handleAssignClick} className="btn-primary" disabled={saving || selectedStudents.size===0 || !selectedFaculty}>
              {saving ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showOverrideConfirm && (
            <div className="modal-overlay" style={{ zIndex: 1000 }}>
              <motion.div className="modal-content premium-modal delete-modal" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <div className="delete-icon-wrapper" style={{ color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)" }}><AlertTriangle size={32} /></div>
                <h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Overwrite Existing Mentors?</h3>
                <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2rem" }}>
                  Some selected students already have mentors assigned. Do you want to reassign them to this new mentor?
                </p>
                <div className="modal-actions" style={{ justifyContent: "center", borderTop: "none", paddingTop: 0 }}>
                  <button className="btn-secondary" onClick={() => setShowOverrideConfirm(false)}>Cancel</button>
                  <button className="btn-primary" onClick={executeAssign}>Yes, Reassign</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const ViewMenteesModal = ({ mentor, isCounsellor, onClose, onRefresh, showToast }) => {
  const [localMentees, setLocalMentees] = useState(mentor.mentees);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [menteeSearch, setMenteeSearch] = useState("");

  const searchedMentees = localMentees.filter(m => 
    m.name.toLowerCase().includes(menteeSearch.toLowerCase()) || 
    m.roll_number.toLowerCase().includes(menteeSearch.toLowerCase())
  );

  const groupedMentees = searchedMentees.reduce((acc, student) => {
    let year;
    if (!student.is_active || student.semester > 8) {
        year = "Alumni";
    } else {
        year = getYearLevel(student.semester);
    }

    if (!acc[year]) acc[year] = [];
    acc[year].push(student);
    return acc;
  }, {});

  const confirmRemove = async () => {
    if(!removeTarget) return;
    try {
      await counsellingService.removeMentee(removeTarget.id);
      showToast(`${removeTarget.name} removed from mentorship.`);
      setLocalMentees(localMentees.filter(m => m.id !== removeTarget.id));
      onRefresh(); 
    } catch(err) {
      showToast("Failed to remove mentee", "error");
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <div>
            <h3>{mentor.mentor_name}'s Mentees</h3>
            <p className="text-muted text-sm">Total Record: {localMentees.length}</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div className="search-bar" style={{ margin: "1rem 0", width: "100%", border: "1px solid var(--border-color)", padding: "0.5rem 1rem", borderRadius: "8px", display: "flex", alignItems: "center", background: "var(--bg-input)" }}>
          <Search size={18} className="text-muted" />
          <input 
            type="text" 
            placeholder="Search mentees by name or roll number..." 
            value={menteeSearch} 
            onChange={(e) => setMenteeSearch(e.target.value)} 
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", marginLeft: "0.5rem", color: "var(--text-primary)" }}
          />
        </div>
        
        <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "10px" }}>
          {searchedMentees.length === 0 ? (
            <p className="text-center text-muted py-4">No mentees found matching your search.</p>
          ) : ["FE", "SE", "TE", "BE", "Alumni"].map(year => {
            if (!groupedMentees[year] || groupedMentees[year].length === 0) return null;
            return (
              <div key={year} style={{ marginBottom: "1.5rem" }}>
                <h4 style={{ 
                  color: year === "Alumni" ? "var(--text-secondary)" : "var(--primary-color)", 
                  borderBottom: "2px solid var(--border-color)", 
                  paddingBottom: "5px", 
                  marginBottom: "10px" 
                }}>
                  {year === "Alumni" ? "Alumni / Graduated" : `${year} Students`} ({groupedMentees[year].length})
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <AnimatePresence>
                    {groupedMentees[year].map(s => (
                      <motion.li key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} 
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-input)", padding: "10px 15px", borderRadius: "6px", opacity: year === "Alumni" ? 0.7 : 1 }}>
                        <div>
                          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                              {s.name} {year === "Alumni" && <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '5px' }}>Inactive</span>}
                          </div>
                          <div className="text-muted text-sm">{s.roll_number}</div>
                        </div>
                        {isCounsellor && (
                          <button className="btn-icon action-delete" onClick={() => setRemoveTarget(s)} title="Remove Mentee">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            );
          })}
        </div>

        {/* REMOVE WARNING MODAL */}
        <AnimatePresence>
          {removeTarget && isCounsellor && (
            <div className="modal-overlay" style={{ zIndex: 1000 }}>
              <motion.div className="modal-content premium-modal delete-modal" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <div className="delete-icon-wrapper"><Trash2 size={32} /></div>
                <h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Remove Mentee?</h3>
                <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2rem" }}>
                  Are you sure you want to remove <strong>{removeTarget.name}</strong> from this mentor's list?
                </p>
                <div className="modal-actions" style={{ justifyContent: "center", borderTop: "none", paddingTop: 0 }}>
                  <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>Cancel</button>
                  <button className="btn-danger" onClick={confirmRemove}>Yes, Remove</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default CounsellorMentorManagement;