import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { staffService, assignmentService } from "../services/api";
import { Users, GraduationCap, Plus, Trash2, Search, CheckSquare, Square, X, AlertTriangle, CheckCircle, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./ClassMentorAssignments.css";

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

const ClassMentorAssignments = () => {
  const { activeAcademicYear, activeDepartment } = useAcademic();
  const [activeTab, setActiveTab] = useState("class_teachers"); 
  const [loading, setLoading] = useState(true);

  const [faculties, setFaculties] = useState([]);
  
  // Class Teacher State & Search
  const [classTeachers, setClassTeachers] = useState([]);
  const [showCTModal, setShowCTModal] = useState(false);
  const [deleteCTTarget, setDeleteCTTarget] = useState(null);
  const [ctSearch, setCtSearch] = useState("");
  const [viewCTStudents, setViewCTStudents] = useState(null);

  // Mentor State & Search
  const [mentorSummary, setMentorSummary] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMentorCard, setSelectedMentorCard] = useState(null); 
  const [mentorSearch, setMentorSearch] = useState("");

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  useEffect(() => {
    if (activeAcademicYear) fetchInitialData();
  }, [activeAcademicYear, activeTab]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const facRes = await staffService.getFaculty();
      setFaculties(facRes.data);

      if (activeTab === "class_teachers") {
        const ctRes = await assignmentService.getClassTeachers(activeAcademicYear.id);
        setClassTeachers(ctRes.data);
      } else {
        const sumRes = await assignmentService.getMentorSummary();
        setMentorSummary(sumRes.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCT = async () => {
    if (!deleteCTTarget) return;
    try {
      await assignmentService.deleteClassTeacher(deleteCTTarget.id);
      showToast("Class teacher removed successfully.");
      fetchInitialData();
    } catch (err) {
      showToast("Failed to remove class teacher.", "error");
    } finally {
      setDeleteCTTarget(null);
    }
  };

  const filteredClassTeachers = classTeachers.filter(ct => 
    ct.faculty_name.toLowerCase().includes(ctSearch.toLowerCase()) ||
    ct.department_code.toLowerCase().includes(ctSearch.toLowerCase()) ||
    ct.year_level.toLowerCase().includes(ctSearch.toLowerCase())
  );

  const filteredMentors = mentorSummary.filter(m => 
    m.mentor_name.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  if (!activeAcademicYear) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  return (
    <div className="assignments-container fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Assignments</h1>
          <p className="page-subtitle">Manage Class Teachers and Student Mentors</p>
        </div>
      </div>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === "class_teachers" ? "active" : ""}`} onClick={() => {setActiveTab("class_teachers"); setCtSearch("");}}>
          <GraduationCap size={18} /> Class Teachers
        </button>
        <button className={`tab-btn ${activeTab === "mentors" ? "active" : ""}`} onClick={() => {setActiveTab("mentors"); setMentorSearch("");}}>
          <Users size={18} /> Mentor Allocation
        </button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: "3rem auto" }}></div>
      ) : activeTab === "class_teachers" ? (
        <div className="table-card" style={{ marginTop: "1rem" }}>
          <div className="toolbar" style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Active Class Teachers</h3>
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search teachers or classes..." 
                  value={ctSearch} 
                  onChange={(e) => setCtSearch(e.target.value)} 
                />
              </div>
            </div>
            
            {activeDepartment?.id === 'ALL' ? (
              <button className="btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }} title="Select a department first">
                <Plus size={18} /> Add Class Teacher
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setShowCTModal(true)}>
                <Plus size={18} /> Add Class Teacher
              </button>
            )}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Year Level</th>
                <th>Division</th>
                <th>Class Teacher</th>
                <th>Students</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {filteredClassTeachers.length > 0 ? filteredClassTeachers.map((ct) => (
                  <motion.tr key={ct.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <td className="font-medium">{ct.department_code}</td>
                    <td><span className="badge badge-role">{ct.year_level}</span></td>
                    <td>{ct.division ? `Div ${ct.division}` : "-"}</td>
                    <td>{ct.faculty_name}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="font-medium" style={{ background: "var(--bg-input)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.85rem" }}>
                          {ct.student_count}
                        </span>
                        <button 
                          className="btn-icon" 
                          style={{ color: "var(--primary-color)" }}
                          onClick={() => setViewCTStudents(ct)}
                          title="View Student List"
                        >
                          <Users size={16} />
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-icon action-delete" onClick={() => setDeleteCTTarget(ct)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </motion.tr>
                )) : <tr><td colSpan="6" className="text-center text-muted py-4">No class teachers found.</td></tr>}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>
          <div className="toolbar" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Faculty Mentorship Overview</h3>
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
            <button className="btn-primary" onClick={() => setShowAssignModal(true)}>
              <Plus size={18} /> Assign Mentees
            </button>
          </div>

          <div className="mentor-grid">
            {filteredMentors.length > 0 ? filteredMentors.map(mentor => {
              // --- FIX: Calculate ONLY active mentees ---
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
                    <p className="text-sm text-primary font-medium" style={{ margin: 0 }}>Click to manage mentees &rarr;</p>
                  </div>
                </motion.div>
              );
            }) : (
              <div className="empty-state glass-panel" style={{ gridColumn: "1 / -1" }}>
                <Users size={48} className="text-muted opacity-20 mb-2" />
                <p>No mentors found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      <AnimatePresence>
        {deleteCTTarget && (
          <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <motion.div className="modal-content premium-modal delete-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="delete-icon-wrapper"><Trash2 size={32} /></div>
              <h3 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Remove Class Teacher?</h3>
              <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2rem" }}>
                Are you sure you want to remove <strong>{deleteCTTarget.faculty_name}</strong> as the teacher for <strong>{deleteCTTarget.year_level} {deleteCTTarget.division}</strong>?
              </p>
              <div className="modal-actions" style={{ justifyContent: "center", borderTop: "none", paddingTop: 0 }}>
                <button className="btn-secondary" onClick={() => setDeleteCTTarget(null)}>Cancel</button>
                <button className="btn-danger" onClick={confirmDeleteCT}>Yes, Remove</button>
              </div>
            </motion.div>
          </div>
        )}

        {viewCTStudents && (
          <ViewClassStudentsModal 
            classTeacher={viewCTStudents} 
            onClose={() => setViewCTStudents(null)} 
          />
        )}

        {showCTModal && (
          <AddClassTeacherModal 
            faculties={faculties} ayId={activeAcademicYear.id} deptId={activeDepartment?.id}
            onClose={() => setShowCTModal(false)} onRefresh={fetchInitialData} showToast={showToast}
          />
        )}
        
        {showAssignModal && (
          <AssignMenteesModal 
            faculties={faculties} onClose={() => setShowAssignModal(false)} onRefresh={fetchInitialData} showToast={showToast}
          />
        )}

        {selectedMentorCard && (
          <ViewMenteesModal 
            mentor={selectedMentorCard} onClose={() => setSelectedMentorCard(null)} onRefresh={fetchInitialData} showToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB COMPONENTS ---

const AddClassTeacherModal = ({ faculties, ayId, deptId, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ year_level: "FE", division: "", faculty_id: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await assignmentService.assignClassTeacher({ ...formData, academic_year: ayId, department_id: deptId });
      showToast("Class Teacher assigned successfully.");
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to assign Class Teacher.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal small-modal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <h3>Add Class Teacher</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="sinput-group">
            <label>Year Level</label>
            <select value={formData.year_level} onChange={e => setFormData({...formData, year_level: e.target.value})}>
              <option value="FE">First Year (FE)</option>
              <option value="SE">Second Year (SE)</option>
              <option value="TE">Third Year (TE)</option>
              <option value="BE">Final Year (BE)</option>
            </select>
          </div>
          <div className="sinput-group">
            <label>Division (Optional)</label>
            <input type="text" value={formData.division} onChange={e => setFormData({...formData, division: e.target.value})} placeholder="e.g., A, B, C" />
          </div>
          <div className="sinput-group">
            <label>Select Teacher</label>
            <select required value={formData.faculty_id} onChange={e => setFormData({...formData, faculty_id: e.target.value})}>
              <option value="" disabled>-- Select Faculty --</option>
              {faculties.map(f => <option key={f.id} value={f.id}>{f.full_name || f.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Assign Teacher"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ViewClassStudentsModal = ({ classTeacher, onClose }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    assignmentService.getClassTeacherStudents(classTeacher.id)
      .then(res => { setStudents(res.data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [classTeacher]);

  const filtered = students.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" style={{ zIndex: 900 }}>
      <motion.div className="modal-content premium-modal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <div>
            <h3>{classTeacher.year_level} {classTeacher.division ? `Div ${classTeacher.division}` : ""} Students</h3>
            <p className="text-muted text-sm">Class Teacher: {classTeacher.faculty_name} • Total: {students.length}</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div className="search-bar" style={{ margin: "1rem 0", width: "100%", border: "1px solid var(--border-color)", padding: "0.5rem 1rem", borderRadius: "8px", display: "flex", alignItems: "center", background: "var(--bg-input)" }}>
          <Search size={18} className="text-muted" />
          <input 
            type="text" 
            placeholder="Search students by name or roll number..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", marginLeft: "0.5rem", color: "var(--text-primary)" }}
          />
        </div>
        
        <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "10px" }}>
          {loading ? (
             <div className="spinner" style={{ margin: "2rem auto" }}></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted py-4">No students found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map(s => (
                <li key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-input)", padding: "10px 15px", borderRadius: "6px" }}>
                  <div>
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{s.full_name}</div>
                    <div className="text-muted text-sm">Semester {s.semester}</div>
                  </div>
                  <div className="font-medium text-muted">{s.roll_number}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
};


const AssignMenteesModal = ({ faculties, onClose, onRefresh, showToast }) => {
  const [students, setStudents] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [studentSearch, setStudentSearch] = useState(""); 
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  useEffect(() => {
    assignmentService.getMentorStudents().then(res => setStudents(res.data));
  }, []);

  const filteredStudents = students.filter(s => {
    const matchesYear = yearFilter === "ALL" || getYearLevel(s.semester) === yearFilter;
    const matchesSearch = s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          s.roll_number.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesYear && matchesSearch;
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
      await assignmentService.assignMentors({ mentor_id: selectedFaculty, student_ids: Array.from(selectedStudents) });
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
              {faculties.map(f => <option key={f.id} value={f.id}>{f.full_name || f.name}</option>)}
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
              {filteredStudents.map(s => (
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

const ViewMenteesModal = ({ mentor, onClose, onRefresh, showToast }) => {
  const [localMentees, setLocalMentees] = useState(mentor.mentees);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [menteeSearch, setMenteeSearch] = useState("");

  const searchedMentees = localMentees.filter(m => 
    m.name.toLowerCase().includes(menteeSearch.toLowerCase()) || 
    m.roll_number.toLowerCase().includes(menteeSearch.toLowerCase())
  );

  // --- FIX: Grouping Logic (Option B: Alumni Vault) ---
  const groupedMentees = searchedMentees.reduce((acc, student) => {
    let year;
    // If inactive OR past 8th semester, put them in Alumni
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
      await assignmentService.removeMentee(removeTarget.id);
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
                        <button className="btn-icon action-delete" onClick={() => setRemoveTarget(s)} title="Remove Mentee">
                          <Trash2 size={16} />
                        </button>
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
          {removeTarget && (
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

export default ClassMentorAssignments;