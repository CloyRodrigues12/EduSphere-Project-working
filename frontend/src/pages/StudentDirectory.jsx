import React, { useState, useEffect } from "react";
import {
  Users, Search, Filter, CheckSquare, Square, Trash2, ArrowRight,
  BookOpen, Layers, CheckCircle, AlertTriangle, X, Edit2, UserX, UserCheck, Zap, SplitSquareHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { studentService } from "../services/api";
import "./StudentDirectory.css";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";

const StudentDirectory = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const { user } = useAuth();
  const canEdit = ["ORG_ADMIN", "SUPER_ADMIN", "HOD"].includes(user?.role_code);

  const [activeTab, setActiveTab] = useState("directory"); 
  // --- NEW: Sub-Tab State for Groups ---
  const [activeGroupTab, setActiveGroupTab] = useState("master"); // 'master', 'labs', 'electives'
  
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeSem, activeTab]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await studentService.getStudents(activeAcademicYear.id, activeSem, searchTerm);
      setStudents(res.data);
    } catch (error) {
      console.error(error);
      showToast("Failed to load students.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await studentService.getGroups(activeAcademicYear.id, activeSem);
      setGroups(res.data);
    } catch (error) {
      console.error(error);
      showToast("Failed to load groups.", "error");
    } finally {
      setLoading(false);
    }
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
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const toggleAll = () => {
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
    if (!window.confirm("Are you sure you want to delete this group? All nested batches will also be deleted.")) return;
    try {
      await studentService.deleteGroup(id);
      showToast("Group deleted successfully.");
      fetchGroups();
    } catch (err) {
      showToast("Failed to delete group.", "error");
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const res = await studentService.toggleStatus(id);
      showToast(res.data.message);
      fetchStudents();
    } catch (err) {
      showToast("Failed to change status.", "error");
    }
  };

  // --- HIERARCHY CATEGORIES ---
  const masterClasses = groups.filter(g => g.type === 'CLASS');
  const labBatches = groups.filter(g => g.type === 'BATCH');
  const electives = groups.filter(g => g.type === 'ELECTIVE');

  return (
    <div className="directory-container fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Directory & Batches</h1>
          <p className="page-subtitle">Manage student enrollments, promotions, and lab batches.</p>
        </div>
      </div>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === "directory" ? "active" : ""}`} onClick={() => { setActiveTab("directory"); setSearchTerm(""); setSelectedStudents(new Set()); }}>
          <Users size={18} /> Master Directory
        </button>
        <button className={`tab-btn ${activeTab === "groups" ? "active" : ""}`} onClick={() => { setActiveTab("groups"); setSearchTerm(""); }}>
          <Layers size={18} /> Batches & Electives
        </button>
      </div>

      <div className="toolbar glass-panel" style={{ padding: "1rem", marginBottom: "1.5rem", borderRadius: "12px", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        
        <select className="standard-input" style={{ width: "200px" }} value={activeSem} onChange={(e) => setActiveSem(parseInt(e.target.value))}>
          {(activeTerm === "ODD" ? [1, 3, 5, 7] : [2, 4, 6, 8]).map(sem => (
            <option key={sem} value={sem}>Semester {sem}</option>
          ))}
        </select>

        {activeTab === "directory" && (
          <div className="search-bar" style={{ flex: 1, minWidth: "250px" }}>
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search by name or roll number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
          {activeTab === "directory" && canEdit && selectedStudents.size > 0 && (
            <button className="btn-warning" onClick={() => setShowPromotionModal(true)}>
              <ArrowRight size={18} /> Move/Promote ({selectedStudents.size})
            </button>
          )}
        </div>
      </div>

      {/* --- DIRECTORY TAB --- */}
      {activeTab === "directory" && (
        <div className="table-card">
          {loading ? (
            <div className="spinner" style={{ margin: "3rem auto" }}></div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    {canEdit && (
                      <th style={{ width: "50px", textAlign: "center" }}>
                        <div style={{ cursor: "pointer" }} onClick={toggleAll}>
                          {students.length > 0 && selectedStudents.size === students.length ? <CheckSquare className="text-primary" size={18} /> : <Square className="text-muted" size={18} />}
                        </div>
                      </th>
                    )}
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Semester</th>
                    <th>Status</th>
                    {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="wait">
                    {students.length > 0 ? (
                      students.map((student) => (
                        <motion.tr key={student.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={!student.is_active ? "inactive-row" : ""}>
                          {canEdit && (
                            <td style={{ textAlign: "center" }}>
                              <div style={{ cursor: "pointer" }} onClick={() => toggleStudent(student.id)}>
                                {selectedStudents.has(student.id) ? <CheckSquare className="text-primary" size={18} /> : <Square className="text-muted" size={18} />}
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
                            <td style={{ textAlign: "right" }}>
                              <button className="btn-icon" onClick={() => handleToggleStatus(student.id)} title={student.is_active ? "Deactivate Student" : "Reactivate Student"}>
                                {student.is_active ? <UserX size={18} className="text-danger" /> : <UserCheck size={18} className="text-success" />}
                              </button>
                            </td>
                          )}
                        </motion.tr>
                      ))
                    ) : (
                      <motion.tr>
                        <td colSpan={canEdit ? "7" : "6"} className="empty-state">
                          <Users size={48} className="text-muted opacity-20 mb-2" />
                          <p>No students found for Semester {activeSem}. (Check the semester filter above!)</p>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- GROUPS / BATCHES TAB (NEW TABBED UI) --- */}
      {activeTab === "groups" && (
        <div className="groups-layout" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* SUB-TABS NAVIGATION */}
          <div style={{ display: "flex", gap: "1.5rem", borderBottom: "2px solid var(--bg-input)", marginBottom: "1rem" }}>
            <button 
              style={{ padding: "0.75rem 1rem", background: "transparent", border: "none", borderBottom: activeGroupTab === 'master' ? "2px solid var(--primary-color)" : "2px solid transparent", color: activeGroupTab === 'master' ? "var(--primary-color)" : "var(--text-secondary)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", marginBottom: "-2px", transition: "all 0.2s" }}
              onClick={() => setActiveGroupTab('master')}
            >
              <BookOpen size={18} /> Master Classes
            </button>
            <button 
              style={{ padding: "0.75rem 1rem", background: "transparent", border: "none", borderBottom: activeGroupTab === 'labs' ? "2px solid #f59e0b" : "2px solid transparent", color: activeGroupTab === 'labs' ? "#f59e0b" : "var(--text-secondary)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", marginBottom: "-2px", transition: "all 0.2s" }}
              onClick={() => setActiveGroupTab('labs')}
            >
              <Layers size={18} /> Lab Batches
            </button>
            <button 
              style={{ padding: "0.75rem 1rem", background: "transparent", border: "none", borderBottom: activeGroupTab === 'electives' ? "2px solid #10b981" : "2px solid transparent", color: activeGroupTab === 'electives' ? "#10b981" : "var(--text-secondary)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", marginBottom: "-2px", transition: "all 0.2s" }}
              onClick={() => setActiveGroupTab('electives')}
            >
              <Users size={18} /> Electives & Custom
            </button>
          </div>

          {loading ? (
             <div className="spinner" style={{ margin: "3rem auto" }}></div>
          ) : (
            <AnimatePresence mode="wait">
              {/* SECTION 1: MASTER CLASSES (THEORY) */}
              {activeGroupTab === "master" && (
                <motion.div key="master" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="group-section glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "var(--primary-color)" }}>Master Classes (Theory)</h3>
                      <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>Auto-generated core classes for the entire semester.</p>
                    </div>
                    {canEdit && (
                      <button className="btn-secondary" style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }} onClick={() => setShowAutoClassModal(true)}>
                        <Zap size={16} fill="currentColor" /> Auto-Generate Class
                      </button>
                    )}
                  </div>
                  
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Semester</th>
                        <th>Total Enrolled</th>
                        {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {masterClasses.length > 0 ? masterClasses.map(g => (
                        <tr key={g.id}>
                          <td className="font-medium">{g.name}</td>
                          <td>Semester {g.semester}</td>
                          <td><span className="badge badge-role">{g.student_count} Students</span></td>
                          {canEdit && (
                            <td style={{ textAlign: "right" }}>
                              <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Class"><Edit2 size={16} /></button>
                              <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Class"><Trash2 size={16} /></button>
                            </td>
                          )}
                        </tr>
                      )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Master Classes found. Click "Auto-Generate" to create one.</td></tr>}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {/* SECTION 2: LAB BATCHES */}
              {activeGroupTab === "labs" && (
                <motion.div key="labs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="group-section glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#f59e0b" }}>Compulsory Lab Batches</h3>
                      <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>Split your master classes automatically into smaller lab groups.</p>
                    </div>
                    {canEdit && (
                      <button className="btn-secondary" style={{ color: '#f59e0b', borderColor: '#f59e0b' }} onClick={() => setShowAutoSplitModal(true)}>
                        <SplitSquareHorizontal size={16} /> Auto-Split Lab Batches
                      </button>
                    )}
                  </div>
                  
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch Name</th>
                        <th>Parent Class</th>
                        <th>Total Enrolled</th>
                        {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {labBatches.length > 0 ? labBatches.map(g => {
                        const parent = masterClasses.find(m => m.id === g.parent_group);
                        return (
                          <tr key={g.id}>
                            <td className="font-medium">{g.name}</td>
                            <td className="text-muted">{parent ? parent.name : "Unknown"}</td>
                            <td><span className="badge badge-designation">{g.student_count} Students</span></td>
                            {canEdit && (
                              <td style={{ textAlign: "right" }}>
                                <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Batch"><Edit2 size={16} /></button>
                                <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Batch"><Trash2 size={16} /></button>
                              </td>
                            )}
                          </tr>
                        );
                      }) : <tr><td colSpan="4" className="text-center text-muted py-8">No Lab Batches configured. Click "Auto-Split" to divide your Master Class.</td></tr>}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {/* SECTION 3: ELECTIVES */}
              {activeGroupTab === "electives" && (
                <motion.div key="electives" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="group-section glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#10b981" }}>Electives & Custom Groups</h3>
                      <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>Create specialized groups for PE, OE, or custom projects.</p>
                    </div>
                    {canEdit && (
                      <button className="btn-secondary" style={{ color: '#10b981', borderColor: '#10b981' }} onClick={() => { setEditGroupTarget(null); setShowGroupModal(true); }}>
                        <Users size={16} /> Create Elective Group
                      </button>
                    )}
                  </div>
                  
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Group Name</th>
                        <th>Semester</th>
                        <th>Total Enrolled</th>
                        {canEdit && <th style={{ textAlign: "right" }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {electives.length > 0 ? electives.map(g => (
                        <tr key={g.id}>
                          <td className="font-medium">{g.name}</td>
                          <td>Semester {g.semester}</td>
                          <td><span className="badge badge-open">{g.student_count} Students</span></td>
                          {canEdit && (
                            <td style={{ textAlign: "right" }}>
                              <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Elective"><Edit2 size={16} /></button>
                              <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Elective"><Trash2 size={16} /></button>
                            </td>
                          )}
                        </tr>
                      )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Electives configured.</td></tr>}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* --- MODALS --- */}
      <AnimatePresence>
        {/* Promotion Modal */}
        {showPromotionModal && (
          <PromotionModal count={selectedStudents.size} currentSem={activeSem} onClose={() => setShowPromotionModal(false)} onConfirm={handleBulkPromote} />
        )}

        {/* Custom Edit / Create Group Modal */}
        {(showGroupModal || editGroupTarget) && (
          <GroupFormModal group={editGroupTarget} ayId={activeAcademicYear.id} sem={activeSem} onClose={() => { setShowGroupModal(false); setEditGroupTarget(null); }} onRefresh={fetchGroups} showToast={showToast} />
        )}

        {/* Auto-Generate Master Class Modal */}
        {showAutoClassModal && (
          <AutoGenerateClassModal ayId={activeAcademicYear.id} sem={activeSem} onClose={() => setShowAutoClassModal(false)} onRefresh={fetchGroups} showToast={showToast} />
        )}

        {/* Auto-Split Lab Batches Modal */}
        {showAutoSplitModal && (
          <AutoSplitLabModal masterClasses={masterClasses} onClose={() => setShowAutoSplitModal(false)} onRefresh={fetchGroups} showToast={showToast} />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const AutoGenerateClassModal = ({ ayId, sem, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [targetSem, setTargetSem] = useState(sem);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await studentService.autoGenerateClassGroup({ academic_year_id: ayId, semester: targetSem });
      showToast(res.data.message, "success");
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to generate class.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <h3>Auto-Generate Master Class</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ padding: "1rem 0" }}>
          <div className="sinput-group">
            <label>Target Semester</label>
            <select className="standard-input" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <p className="text-muted" style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
            This will fetch all active students in the selected semester and automatically group them into a new <strong>Master Class</strong>.
          </p>
        </div>
        <div className="modal-actions" style={{ marginTop: "1rem" }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : <><Zap size={16} /> Generate Now</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AutoSplitLabModal = ({ masterClasses, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [numBatches, setNumBatches] = useState(3);
  const [selectedMaster, setSelectedMaster] = useState(masterClasses.length > 0 ? masterClasses[0].id : "");

  const handleSplit = async () => {
    if (!selectedMaster) return showToast("Please select a Master Class to split.", "error");
    setLoading(true);
    try {
      const res = await studentService.autoSplitBatches({ parent_group_id: selectedMaster, num_batches: numBatches });
      showToast(res.data.message, "success");
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to split batches.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <h3>Auto-Split Lab Batches</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ padding: "1rem 0" }}>
          <div className="sinput-group">
            <label>Select Source Master Class</label>
            <select className="standard-input" value={selectedMaster} onChange={(e) => setSelectedMaster(e.target.value)}>
              <option value="" disabled>-- Select Class --</option>
              {masterClasses.map(m => <option key={m.id} value={m.id}>{m.name} ({m.student_count} Students)</option>)}
            </select>
          </div>
          <div className="sinput-group">
            <label>Number of Batches</label>
            <input type="number" className="standard-input" min="2" max="10" value={numBatches} onChange={(e) => setNumBatches(parseInt(e.target.value))} />
          </div>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "1rem", lineHeight: "1.4" }}>
            The system will alphabetically sort the students in the Master Class by roll number and divide them evenly into {numBatches} lab batches.
          </p>
        </div>
        <div className="modal-actions" style={{ marginTop: "1rem" }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSplit} disabled={loading || !selectedMaster}>
            {loading ? "Splitting..." : <><SplitSquareHorizontal size={16} /> Split Batches</>}
          </button>
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
      <motion.div className="modal-content premium-modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <h3>Update Semester</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ padding: "1rem 0" }}>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
            You are updating the semester for <strong>{count}</strong> selected students.
          </p>
          <div className="sinput-group">
            <label>Target Semester</label>
            <select className="standard-input" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          {isDemotion && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert-danger" style={{ display: "flex", gap: "10px", marginTop: "1rem", padding: "10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", borderRadius: "8px" }}>
              <AlertTriangle size={20} />
              <div style={{ fontSize: "0.85rem" }}>
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
      </motion.div>
    </div>
  );
};

const GroupFormModal = ({ group, ayId, sem, onClose, onRefresh, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: group?.name || "",
    type: group?.type || "ELECTIVE",
    semester: group?.semester || sem,
  });

  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set(group?.students_list?.map(s => s.id) || []));
  const [search, setSearch] = useState("");

  useEffect(() => {
    studentService.getStudents(ayId, formData.semester, "").then(res => setAvailableStudents(res.data));
  }, [ayId, formData.semester]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let savedGroup;
      if (group) {
        const res = await studentService.updateGroup({ id: group.id, ...formData });
        savedGroup = res.data;
      } else {
        const res = await studentService.createGroup({ academic_year: ayId, ...formData });
        savedGroup = res.data;
      }

      if (selectedStudents.size > 0 || group) {
        await studentService.updateGroupStudents(savedGroup.id, Array.from(selectedStudents), 'set');
      }

      showToast(group ? "Group updated!" : "Group created!");
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Error saving group", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = availableStudents.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <motion.div className="modal-content premium-modal large-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header">
          <h3>{group ? "Edit Group" : "Create Custom Group"}</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
            <div className="sinput-group" style={{ flex: 2 }}>
              <label>Group Name</label>
              <input type="text" required placeholder="e.g. PE-Blockchain" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="sinput-group" style={{ flex: 1 }}>
              <label>Type</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} disabled={group && group.type === 'CLASS'}>
                <option value="CLASS">Master Class</option>
                <option value="BATCH">Lab Batch</option>
                <option value="ELECTIVE">Elective Section</option>
              </select>
            </div>
            <div className="sinput-group" style={{ flex: 1 }}>
              <label>Semester</label>
              <select value={formData.semester} onChange={e => setFormData({...formData, semester: parseInt(e.target.value)})}>
                 {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h4 style={{ margin: 0 }}>Enroll Students <span className="badge badge-role ml-2">{selectedStudents.size} Selected</span></h4>
              <div className="search-bar" style={{ minWidth: "250px" }}>
                <Search size={16} className="text-muted" />
                <input type="text" placeholder="Search to add or remove..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              <table className="data-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-main)" }}>
                  <tr>
                    <th style={{ width: "50px", textAlign: "center" }}>Select</th>
                    <th>Roll No</th>
                    <th>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id} onClick={() => {
                      const newSet = new Set(selectedStudents);
                      if (newSet.has(s.id)) newSet.delete(s.id); else newSet.add(s.id);
                      setSelectedStudents(newSet);
                    }} style={{ cursor: "pointer", background: selectedStudents.has(s.id) ? "var(--bg-input)" : "transparent" }}>
                      <td style={{ textAlign: "center" }}>
                        {selectedStudents.has(s.id) ? <CheckSquare className="text-primary" size={18}/> : <Square className="text-muted" size={18}/>}
                      </td>
                      <td className="text-muted">{s.roll_number}</td>
                      <td className="font-medium">{s.full_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Group"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default StudentDirectory;