import React, { useState, useEffect } from "react";
import {
  Users, Search, Filter, CheckSquare, Square, Trash2, ArrowRight,
  BookOpen, Layers, CheckCircle, AlertTriangle, X, Edit2, UserX, UserCheck, Zap, SplitSquareHorizontal, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { studentService, academicService } from "../services/api"; 
import "./StudentDirectory.css";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";

const StudentDirectory = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const { user } = useAuth();
  
  const canEdit = ["ORG_ADMIN", "SUPER_ADMIN", "HOD"].includes(user?.role_code);

  const [activeTab, setActiveTab] = useState("directory"); 
  const [activeGroupTab, setActiveGroupTab] = useState("master"); 
  
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]); 
  const [loading, setLoading] = useState(true);

  const defaultSem = activeTerm === "EVEN" ? 2 : 1;
  const [activeSem, setActiveSem] = useState(defaultSem);
  
  useEffect(() => {
    setActiveSem(activeTerm === "EVEN" ? 2 : 1);
  }, [activeTerm]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudents, setSelectedStudents] = useState(new Set());

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showAutoClassModal, setShowAutoClassModal] = useState(false);
  const [showAutoSplitModal, setShowAutoSplitModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  useEffect(() => {
    if (activeAcademicYear) {
      if (activeTab === "directory") fetchStudents();
      else fetchGroups();
      fetchSubjects(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeSem, activeTab]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await studentService.getStudents(activeAcademicYear.id, activeSem, searchTerm);
      setStudents(res.data);
    } catch (error) {
      showToast("Failed to load students.", "error");
    } finally { setLoading(false); }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await studentService.getGroups(activeAcademicYear.id, activeSem);
      setGroups(res.data);
    } catch (error) {
      showToast("Failed to load groups.", "error");
    } finally { setLoading(false); }
  };

  const fetchSubjects = async () => {
    try {
      const res = await academicService.getSubjects(activeSem); 
      setSubjects(res.data);
    } catch(e) { console.error("Failed fetching subjects for sem", activeSem); }
  };

  useEffect(() => {
    if (activeTab === "directory") {
      const delay = setTimeout(() => {
        if (activeAcademicYear) fetchStudents();
      }, 500);
      return () => clearTimeout(delay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const toggleStudent = (id) => {
    if (!canEdit) return;
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const toggleAll = () => {
    if (!canEdit) return;
    if (selectedStudents.size === students.length && students.length > 0) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
    }
  };

  const handleBulkPromote = async (targetSem) => {
    try {
      await studentService.bulkUpdateSemester(Array.from(selectedStudents), targetSem, activeAcademicYear.id);
      showToast(`Successfully updated ${selectedStudents.size} students!`);
      setSelectedStudents(new Set());
      setShowPromotionModal(false);
      fetchStudents();
    } catch (err) {
      showToast("Failed to update students.", "error");
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!canEdit) return;
    if (!window.confirm("Are you sure you want to delete this group?")) return;
    try {
      await studentService.deleteGroup(id);
      showToast("Group deleted successfully.");
      fetchGroups();
    } catch (err) { showToast("Failed to delete group.", "error"); }
  };

  const handleToggleStatus = async (id) => {
    if (!canEdit) return;
    try {
      const res = await studentService.toggleStatus(id);
      showToast(res.data.message);
      fetchStudents();
    } catch (err) { showToast("Failed to change status.", "error"); }
  };

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const masterClasses = filteredGroups.filter(g => g.type === 'CLASS');
  const labBatches = filteredGroups.filter(g => g.type === 'BATCH');
  const electives = filteredGroups.filter(g => g.type === 'ELECTIVE');

  return (
    <div className="student-directory-scope fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="sd-header-stack">
        <h1>Directory & Batches</h1>
        <p>Manage student enrollments, promotions, and subject batches.</p>
      </div>

      {/* COMPACT MOBILE SELECTORS */}
      <div className="mobile-controls-row">
        <select className="sd-select" value={activeTab} onChange={(e) => { setActiveTab(e.target.value); setSearchTerm(""); setSelectedStudents(new Set()); }}>
          <option value="directory">👥 Master Directory</option>
          <option value="groups">📚 Batches & Electives</option>
        </select>
        <select className="sd-select" value={activeSem} onChange={(e) => setActiveSem(parseInt(e.target.value))}>
          {(activeTerm === "ODD" ? [1, 3, 5, 7] : [2, 4, 6, 8]).map(sem => (
            <option key={sem} value={sem}>Sem {sem}</option>
          ))}
        </select>
      </div>

      {/* TABS WRAPPER (Desktop Only) */}
      <div className="tabs-wrapper">
        <div className="desktop-tabs">
          <button className={`tab-btn ${activeTab === "directory" ? "active" : ""}`} onClick={() => { setActiveTab("directory"); setSearchTerm(""); setSelectedStudents(new Set()); }}>
            <Users size={18} /> Master Directory
            {activeTab === "directory" && <motion.div className="active-tab-indicator" layoutId="sd-activeTab" />}
          </button>
          <button className={`tab-btn ${activeTab === "groups" ? "active" : ""}`} onClick={() => { setActiveTab("groups"); setSearchTerm(""); }}>
            <Layers size={18} /> Batches & Electives
            {activeTab === "groups" && <motion.div className="active-tab-indicator" layoutId="sd-activeTab" />}
          </button>
        </div>
      </div>

      <div className="directory-toolbar">
        <select className="sd-select" style={{ maxWidth: "200px" }} value={activeSem} onChange={(e) => setActiveSem(parseInt(e.target.value))}>
          {(activeTerm === "ODD" ? [1, 3, 5, 7] : [2, 4, 6, 8]).map(sem => (
            <option key={sem} value={sem}>Semester {sem}</option>
          ))}
        </select>

        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input type="text" placeholder={activeTab === "directory" ? "Search by name or roll no..." : "Search classes, batches, electives..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {activeTab === "directory" && canEdit && (
          <button 
            className="btn-warning" 
            onClick={() => setShowPromotionModal(true)}
            disabled={selectedStudents.size === 0}
          >
            <ArrowRight size={18} /> Move/Promote {selectedStudents.size > 0 ? `(${selectedStudents.size})` : ""}
          </button>
        )}
      </div>

      {activeTab === "directory" && (
        <div className="table-card">
          {loading ? (
            <div className="spinner" style={{ margin: "3rem auto" }}></div>
          ) : (
            <>
              <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
              <div className="sd-table-wrapper premium-scroll">
                <table className="sd-strict-table master-table">
                  <thead>
                    <tr>
                      {canEdit && (
                        <th>
                          <div className={`touch-target ${canEdit ? 'active-target' : 'disabled-target'}`} onClick={canEdit ? toggleAll : undefined}>
                            {students.length > 0 && selectedStudents.size === students.length ? <CheckSquare className={canEdit ? "text-primary" : "text-muted"} size={22} /> : <Square className="text-muted" size={22} />}
                          </div>
                        </th>
                      )}
                      <th>Roll No</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Semester</th>
                      <th>Status</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {students.length > 0 ? (
                        students.map((student) => (
                          <motion.tr 
                            key={student.id} 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            className={`${!student.is_active ? "inactive-row" : ""} ${selectedStudents.has(student.id) ? "selected-row" : ""}`}
                            onClick={() => { if(canEdit) toggleStudent(student.id) }}
                            style={{ cursor: canEdit ? "pointer" : "default" }}
                          >
                            {canEdit && (
                              <td>
                                <div className={`touch-target ${canEdit ? 'active-target' : 'disabled-target'}`} onClick={(e) => { e.stopPropagation(); if(canEdit) toggleStudent(student.id); }}>
                                  {selectedStudents.has(student.id) ? <CheckSquare className={canEdit ? "text-primary" : "text-muted"} size={22} /> : <Square className="text-muted" size={22} />}
                                </div>
                              </td>
                            )}
                            <td className="font-medium text-primary">{student.roll_number}</td>
                            <td className="font-medium">{student.full_name}</td>
                            <td className="text-muted">{student.email || "Pending Setup"}</td>
                            <td><span className="badge badge-role">Sem {student.current_semester}</span></td>
                            <td>
                              <span className={`badge ${student.is_active ? "badge-open" : "badge-designation"}`} style={{ opacity: student.is_active ? 1 : 0.6 }}>
                                {student.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canEdit && (
                              <td>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleToggleStatus(student.id); }} title={student.is_active ? "Deactivate Student" : "Reactivate Student"}>
                                    {student.is_active ? <UserX size={18} className="text-danger" /> : <UserCheck size={18} className="text-success" />}
                                  </button>
                                </div>
                              </td>
                            )}
                          </motion.tr>
                        ))
                      ) : (
                        <motion.tr>
                          <td colSpan={canEdit ? "7" : "6"} className="empty-state" style={{ padding: "4rem", textAlign: "center" }}>
                            <Users size={48} className="text-muted opacity-20 mb-2" style={{ margin: "0 auto" }}/>
                            <p>No students found for Semester {activeSem}.</p>
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
      )}

      {activeTab === "groups" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1, minHeight: 0 }}>
          
          <div className="group-sub-tabs">
            <button className="group-sub-btn" style={{ borderBottomColor: activeGroupTab === 'master' ? "var(--primary-color)" : "transparent", color: activeGroupTab === 'master' ? "var(--primary-color)" : "var(--text-secondary)" }} onClick={() => setActiveGroupTab('master')}>
              <BookOpen size={18} /> Theory Classes
            </button>
            <button className="group-sub-btn" style={{ borderBottomColor: activeGroupTab === 'labs' ? "#f59e0b" : "transparent", color: activeGroupTab === 'labs' ? "#f59e0b" : "var(--text-secondary)" }} onClick={() => setActiveGroupTab('labs')}>
              <Layers size={18} /> Lab Batches
            </button>
            <button className="group-sub-btn" style={{ borderBottomColor: activeGroupTab === 'electives' ? "#10b981" : "transparent", color: activeGroupTab === 'electives' ? "#10b981" : "var(--text-secondary)" }} onClick={() => setActiveGroupTab('electives')}>
              <Users size={18} /> Electives
            </button>
          </div>

          {loading ? ( <div className="spinner" style={{ margin: "3rem auto" }}></div> ) : (
            <AnimatePresence mode="wait">
              
              {activeGroupTab === "master" && (
                <motion.div key="master" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "var(--primary-color)", fontSize: "1.2rem" }}>Theory Master Classes</h3>
                    </div>
                    {canEdit && (
                      <button className="btn-secondary" style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }} onClick={() => setShowAutoClassModal(true)}>
                        <Zap size={16} fill="currentColor" /> Generate Class
                      </button>
                    )}
                  </div>
                  <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
                  <div className="sd-table-wrapper premium-scroll">
                    <table className="sd-strict-table group-table">
                      <thead>
                        <tr>
                          <th>Class Name</th>
                          <th>Semester</th>
                          <th>Enrolled</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masterClasses.length > 0 ? masterClasses.map(g => (
                          <tr key={g.id}>
                            <td className="font-medium">{g.name}</td>
                            <td>Semester {g.semester}</td>
                            <td><span className="badge badge-role">{g.student_count} Students</span></td>
                            <td>
                              {canEdit ? (
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                  <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Class"><Edit2 size={16} /></button>
                                  <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Class"><Trash2 size={16} /></button>
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                                  <Lock size={12}/> Locked
                                </span>
                              )}
                            </td>
                          </tr>
                        )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Master Classes match your search.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeGroupTab === "labs" && (
                <motion.div key="labs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#f59e0b", fontSize: "1.2rem" }}>Subject Lab Batches</h3>
                    </div>
                    {canEdit && (
                      <button className="btn-secondary" style={{ color: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => setShowAutoSplitModal(true)}>
                        <SplitSquareHorizontal size={16} /> Auto-Generate Batches
                      </button>
                    )}
                  </div>
                  <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
                  <div className="sd-table-wrapper premium-scroll">
                    <table className="sd-strict-table group-table">
                      <thead>
                        <tr>
                          <th>Batch Name</th>
                          <th>Semester</th>
                          <th>Enrolled</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labBatches.length > 0 ? labBatches.map(g => (
                          <tr key={g.id}>
                            <td className="font-medium">{g.name}</td>
                            <td className="text-muted">Semester {g.semester}</td>
                            <td><span className="badge badge-designation">{g.student_count} Students</span></td>
                            <td>
                              {canEdit ? (
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                  <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Batch"><Edit2 size={16} /></button>
                                  <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Batch"><Trash2 size={16} /></button>
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                                  <Lock size={12}/> Locked
                                </span>
                              )}
                            </td>
                          </tr>
                        )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Lab Batches match your search.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeGroupTab === "electives" && (
                <motion.div key="electives" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#10b981", fontSize: "1.2rem" }}>Electives & Custom Groups</h3>
                    </div>
                    {canEdit && (
                      <button className="btn-secondary" style={{ color: '#10b981', borderColor: '#10b981' }} onClick={() => { setEditGroupTarget(null); setShowGroupModal(true); }}>
                        <Users size={16} /> Create Elective Group
                      </button>
                    )}
                  </div>
                  <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
                  <div className="sd-table-wrapper premium-scroll">
                    <table className="sd-strict-table group-table">
                      <thead>
                        <tr>
                          <th>Group Name</th>
                          <th>Semester</th>
                          <th>Enrolled</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {electives.length > 0 ? electives.map(g => (
                          <tr key={g.id}>
                            <td className="font-medium">{g.name}</td>
                            <td className="text-muted">Semester {g.semester}</td>
                            <td><span className="badge badge-open">{g.student_count} Students</span></td>
                            <td>
                              {canEdit ? (
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                  <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Elective"><Edit2 size={16} /></button>
                                  <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Elective"><Trash2 size={16} /></button>
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                                  <Lock size={12}/> Locked
                                </span>
                              )}
                            </td>
                          </tr>
                        )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Electives match your search.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* --- MODALS (Using Strict Bottom Sheet Patterns) --- */}
      <AnimatePresence>
        {showPromotionModal && (
          <PromotionModal count={selectedStudents.size} currentSem={activeSem} onClose={() => setShowPromotionModal(false)} onConfirm={handleBulkPromote} />
        )}

        {(showGroupModal || editGroupTarget) && (
          <GroupFormModal group={editGroupTarget} ayId={activeAcademicYear.id} sem={activeSem} subjects={subjects} onClose={() => { setShowGroupModal(false); setEditGroupTarget(null); }} onRefresh={fetchGroups} showToast={showToast} />
        )}

        {showAutoClassModal && (
          <AutoGenerateClassModal ayId={activeAcademicYear.id} sem={activeSem} subjects={subjects} onClose={() => setShowAutoClassModal(false)} onRefresh={fetchGroups} showToast={showToast} />
        )}

        {showAutoSplitModal && (
          <AutoSplitLabModal ayId={activeAcademicYear.id} sem={activeSem} subjects={subjects} onClose={() => setShowAutoSplitModal(false)} onRefresh={fetchGroups} showToast={showToast} />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS (Isolated Inputs & Bottom Sheet Safe) ---

const AutoGenerateClassModal = ({ ayId, sem, subjects, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [targetSem, setTargetSem] = useState(sem);
  const [selectedSubject, setSelectedSubject] = useState("");

  const theorySubjects = subjects.filter(s => s.subject_type === 'THEORY');

  const handleGenerate = async () => {
    if (!selectedSubject) return showToast("Please select a subject.", "error");
    setLoading(true);
    try {
      const res = await studentService.autoGenerateClassGroup({ 
        academic_year_id: ayId, 
        semester: targetSem,
        subject_id: selectedSubject
      });
      showToast(res.data.message, "success");
      onRefresh();
      onClose();
    } catch (err) { showToast(err.response?.data?.error || "Failed to generate class.", "error"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal auto-height-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <div>
            <h3>Generate Subject Class</h3>
            <p className="modal-subtitle">Auto-link a master class to a theory subject.</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <div className="modal-form">
          <div className="premium-form" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="sd-input-group">
              <label>Target Semester</label>
              <select className="sd-select" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div className="sd-input-group">
              <label>Compulsory Theory Subject</label>
              <select className="sd-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                <option value="" disabled>-- Select Subject --</option>
                {theorySubjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: "1rem", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              The system will link this class explicitly to the selected subject and automatically name it using standard conventions (e.g., "BE ECS: Subject Name").
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleGenerate} disabled={loading || !selectedSubject}>
              {loading ? "Generating..." : <><Zap size={16} /> Generate Class</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AutoSplitLabModal = ({ ayId, sem, subjects, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [numBatches, setNumBatches] = useState(3);
  const [targetSem, setTargetSem] = useState(sem);
  const [selectedSubject, setSelectedSubject] = useState("");

  const labSubjects = subjects.filter(s => s.subject_type === 'LAB' || s.subject_type === 'PRO_ELECTIVE_LAB');

  const handleSplit = async () => {
    if (!selectedSubject) return showToast("Please select a Lab Subject.", "error");
    setLoading(true);
    try {
      const res = await studentService.autoSplitBatches({ 
        academic_year_id: ayId,
        semester: targetSem,
        num_batches: numBatches,
        subject_id: selectedSubject
      });
      showToast(res.data.message, "success");
      onRefresh();
      onClose();
    } catch (err) { showToast(err.response?.data?.error || "Failed to split batches.", "error"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal auto-height-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <div>
            <h3>Generate Lab Batches</h3>
            <p className="modal-subtitle">Auto-split students alphabetically.</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <div className="modal-form">
          <div className="premium-form" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="sd-input-group">
              <label>Target Semester</label>
              <select className="sd-select" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div className="sd-input-group">
              <label>Select Lab Subject</label>
              <select className="sd-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                <option value="" disabled>-- Select Lab --</option>
                {labSubjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            <div className="sd-input-group">
              <label>Number of Batches</label>
              <input type="number" className="sd-input" min="2" max="10" value={numBatches} onChange={(e) => setNumBatches(parseInt(e.target.value))} />
            </div>
            <p className="text-muted" style={{ fontSize: "0.85rem", lineHeight: "1.5", margin: 0 }}>
              The system will alphabetically divide all semester students into equal lab batches automatically named after the Subject (e.g., "[Subject] - Batch A").
            </p>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSplit} disabled={loading || !selectedSubject}>
              {loading ? "Generating..." : <><SplitSquareHorizontal size={16} /> Generate Batches</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PromotionModal = ({ count, currentSem, onClose, onConfirm }) => {
  const [targetSem, setTargetSem] = useState(currentSem + 1);
  const isDemotion = targetSem < currentSem;

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal auto-height-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <div>
            <h3>Update Semester</h3>
            <p className="modal-subtitle">Promote or move students.</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <div className="modal-form">
          <div className="premium-form" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              You are updating the semester for <strong>{count}</strong> selected students.
            </p>
            <div className="sd-input-group">
              <label>Target Semester</label>
              <select className="sd-select" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            {isDemotion && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", gap: "12px", padding: "16px", background: "rgba(239,68,68,0.1)", color: "#ef4444", borderRadius: "8px" }}>
                <AlertTriangle size={24} />
                <div style={{ fontSize: "0.9rem", lineHeight: "1.4" }}>
                  <strong>Warning!</strong> You are moving students backwards to a lower semester.
                </div>
              </motion.div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className={isDemotion ? "btn-danger" : "btn-warning"} onClick={() => onConfirm(targetSem)}>
              {isDemotion ? "Confirm Demotion" : "Promote Students"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const GroupFormModal = ({ group, ayId, sem, subjects, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: group?.name || "",
    type: group?.type || "ELECTIVE",
    semester: group?.semester || sem,
    subject_id: group?.subject || "" 
  });

  const electiveSubjects = subjects.filter(s => ['PRO_ELECTIVE', 'OPEN_ELECTIVE', 'PRO_ELECTIVE_LAB'].includes(s.subject_type));
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set(group?.students_list?.map(s => s.id) || []));
  const [search, setSearch] = useState("");

  useEffect(() => {
    studentService.getStudents(ayId, formData.semester, "").then(res => setAvailableStudents(res.data));
  }, [ayId, formData.semester]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject_id) return showToast("Please select the target Subject first.", "error");

    setLoading(true);
    try {
      let savedGroup;
      if (group) {
        const res = await studentService.updateGroup({ id: group.id, subject_id: formData.subject_id, ...formData });
        savedGroup = res.data;
      } else {
        const res = await studentService.createGroup({ academic_year: ayId, subject_id: formData.subject_id, ...formData });
        savedGroup = res.data;
      }

      if (selectedStudents.size > 0 || group) {
        await studentService.updateGroupStudents(savedGroup.id, Array.from(selectedStudents), 'set');
      }

      showToast(group ? "Elective updated!" : "Elective created!");
      onRefresh();
      onClose();
    } catch (err) { showToast(err.response?.data?.error || "Error saving elective", "error"); } 
    finally { setLoading(false); }
  };

  const filteredStudents = availableStudents.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <div>
            <h3>{group ? "Edit Elective" : "Create Elective Section"}</h3>
            <p className="modal-subtitle">Create custom sections tied to elective subjects.</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div className="sd-input-group" style={{ flex: "2 1 250px" }}>
                <label>Target Elective Subject</label>
                <select className="sd-select" value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})}>
                  <option value="" disabled>-- Select Subject --</option>
                  {electiveSubjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
              </div>
              <div className="sd-input-group" style={{ flex: "1 1 150px" }}>
                <label>Section Name</label>
                <input className="sd-input" type="text" required placeholder="e.g. Section A" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="sd-input-group" style={{ flex: "1 1 100px" }}>
                <label>Semester</label>
                <select className="sd-select" value={formData.semester} onChange={e => setFormData({...formData, semester: parseInt(e.target.value)})}>
                   {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  Enroll Students <span className="badge badge-role">{selectedStudents.size} Selected</span>
                </h4>
                <div className="search-bar" style={{ minWidth: "200px", flex: 1, maxWidth: "350px", padding: "0.5rem 1rem" }}>
                  <Search size={16} className="text-muted" />
                  <input type="text" placeholder="Search by name or roll number..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>

              <div className="sd-table-wrapper premium-scroll" style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "12px" }}>
                <table className="sd-strict-table modal-enroll-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-main)", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <tr>
                      <th style={{ width: "60px", textAlign: "center", padding: "12px" }}>Select</th>
                      <th style={{ padding: "12px" }}>Roll No</th>
                      <th style={{ padding: "12px" }}>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length > 0 ? filteredStudents.map(s => (
                      <tr key={s.id} onClick={() => {
                        const newSet = new Set(selectedStudents);
                        if (newSet.has(s.id)) newSet.delete(s.id); else newSet.add(s.id);
                        setSelectedStudents(newSet);
                      }} style={{ cursor: "pointer", background: selectedStudents.has(s.id) ? "var(--bg-input)" : "transparent", transition: "background 0.2s" }}>
                        <td style={{ textAlign: "center", padding: "12px" }}>
                          {selectedStudents.has(s.id) ? <CheckSquare className="text-primary" size={24}/> : <Square className="text-muted" size={24}/>}
                        </td>
                        <td className="text-muted font-medium" style={{ padding: "12px" }}>{s.roll_number}</td>
                        <td className="font-medium" style={{ padding: "12px", color: "var(--text-primary)" }}>{s.full_name}</td>
                      </tr>
                    )) : <tr><td colSpan="3" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>No students match your search.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Elective"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default StudentDirectory;