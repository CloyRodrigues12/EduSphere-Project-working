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
  const [activeGroupTab, setActiveGroupTab] = useState("master"); 
  
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

  // --- HIERARCHY CATEGORIES (With Search Filter) ---
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const masterClasses = filteredGroups.filter(g => g.type === 'CLASS');
  const labBatches = filteredGroups.filter(g => g.type === 'BATCH');
  const electives = filteredGroups.filter(g => g.type === 'ELECTIVE');

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

        {/* SEARCH BAR NOW VISIBLE FOR BOTH TABS */}
        <div className="search-bar" style={{ flex: 1, minWidth: "250px" }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={activeTab === "directory" ? "Search by name or roll number..." : "Search classes, batches, or electives..."} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
          {activeTab === "directory" && canEdit && selectedStudents.size > 0 && (
            <button className="btn-warning" onClick={() => setShowPromotionModal(true)}>
              <ArrowRight size={18} /> Move/Promote ({selectedStudents.size})
            </button>
          )}
        </div>
      </div>

      {/* --- DIRECTORY TAB (WITH SCROLLABLE TABLE) --- */}
      {activeTab === "directory" && (
        <div className="table-card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div className="spinner" style={{ margin: "3rem auto" }}></div>
          ) : (
            <div className="table-responsive premium-scroll" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--bg-card)", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                  <tr>
                    {canEdit && (
                      <th style={{ width: "50px", textAlign: "center", padding: "1rem" }}>
                        <div style={{ cursor: "pointer" }} onClick={toggleAll}>
                          {students.length > 0 && selectedStudents.size === students.length ? <CheckSquare className="text-primary" size={18} /> : <Square className="text-muted" size={18} />}
                        </div>
                      </th>
                    )}
                    <th style={{ padding: "1rem" }}>Roll No</th>
                    <th style={{ padding: "1rem" }}>Name</th>
                    <th style={{ padding: "1rem" }}>Email</th>
                    <th style={{ padding: "1rem" }}>Semester</th>
                    <th style={{ padding: "1rem" }}>Status</th>
                    {canEdit && <th style={{ textAlign: "right", padding: "1rem" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="wait">
                    {students.length > 0 ? (
                      students.map((student) => (
                        <motion.tr key={student.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={!student.is_active ? "inactive-row" : ""}>
                          {canEdit && (
                            <td style={{ textAlign: "center", padding: "1rem" }}>
                              <div style={{ cursor: "pointer" }} onClick={() => toggleStudent(student.id)}>
                                {selectedStudents.has(student.id) ? <CheckSquare className="text-primary" size={18} /> : <Square className="text-muted" size={18} />}
                              </div>
                            </td>
                          )}
                          <td className="font-medium text-primary" style={{ padding: "1rem" }}>{student.roll_number}</td>
                          <td className="font-medium" style={{ padding: "1rem" }}>{student.full_name}</td>
                          <td className="text-muted" style={{ padding: "1rem" }}>{student.email || "Pending Setup"}</td>
                          <td style={{ padding: "1rem" }}><span className="badge badge-role">Sem {student.current_semester}</span></td>
                          <td style={{ padding: "1rem" }}>
                            <span className={`badge ${student.is_active ? "badge-open" : "badge-designation"}`} style={{ opacity: student.is_active ? 1 : 0.6 }}>
                              {student.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canEdit && (
                            <td style={{ textAlign: "right", padding: "1rem" }}>
                              <button className="btn-icon" onClick={() => handleToggleStatus(student.id)} title={student.is_active ? "Deactivate Student" : "Reactivate Student"}>
                                {student.is_active ? <UserX size={18} className="text-danger" /> : <UserCheck size={18} className="text-success" />}
                              </button>
                            </td>
                          )}
                        </motion.tr>
                      ))
                    ) : (
                      <motion.tr>
                        <td colSpan={canEdit ? "7" : "6"} className="empty-state" style={{ padding: "4rem" }}>
                          <Users size={48} className="text-muted opacity-20 mb-2" />
                          <p>No students found for Semester {activeSem}.</p>
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

      {/* --- GROUPS / BATCHES TAB --- */}
      {activeTab === "groups" && (
        <div className="groups-layout" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
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
              {activeGroupTab === "master" && (
                <motion.div key="master" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="group-section glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
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
                          <td className="font-medium" style={{ padding: "1rem" }}>{g.name}</td>
                          <td style={{ padding: "1rem" }}>Semester {g.semester}</td>
                          <td style={{ padding: "1rem" }}><span className="badge badge-role">{g.student_count} Students</span></td>
                          {canEdit && (
                            <td style={{ textAlign: "right", padding: "1rem" }}>
                              <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Class"><Edit2 size={16} /></button>
                              <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Class"><Trash2 size={16} /></button>
                            </td>
                          )}
                        </tr>
                      )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Master Classes match your search.</td></tr>}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {activeGroupTab === "labs" && (
                <motion.div key="labs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="group-section glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
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
                        const parent = groups.find(m => m.id === g.parent_group);
                        return (
                          <tr key={g.id}>
                            <td className="font-medium" style={{ padding: "1rem" }}>{g.name}</td>
                            <td className="text-muted" style={{ padding: "1rem" }}>{parent ? parent.name : "Unknown"}</td>
                            <td style={{ padding: "1rem" }}><span className="badge badge-designation">{g.student_count} Students</span></td>
                            {canEdit && (
                              <td style={{ textAlign: "right", padding: "1rem" }}>
                                <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Batch"><Edit2 size={16} /></button>
                                <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Batch"><Trash2 size={16} /></button>
                              </td>
                            )}
                          </tr>
                        );
                      }) : <tr><td colSpan="4" className="text-center text-muted py-8">No Lab Batches match your search.</td></tr>}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {activeGroupTab === "electives" && (
                <motion.div key="electives" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="group-section glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
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
                          <td className="font-medium" style={{ padding: "1rem" }}>{g.name}</td>
                          <td style={{ padding: "1rem" }}>Semester {g.semester}</td>
                          <td style={{ padding: "1rem" }}><span className="badge badge-open">{g.student_count} Students</span></td>
                          {canEdit && (
                            <td style={{ textAlign: "right", padding: "1rem" }}>
                              <button className="btn-icon action-edit" onClick={() => setEditGroupTarget(g)} title="Edit Elective"><Edit2 size={16} /></button>
                              <button className="btn-icon action-delete" onClick={() => handleDeleteGroup(g.id)} title="Delete Elective"><Trash2 size={16} /></button>
                            </td>
                          )}
                        </tr>
                      )) : <tr><td colSpan="4" className="text-center text-muted py-8">No Electives match your search.</td></tr>}
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
        {showPromotionModal && (
          <PromotionModal count={selectedStudents.size} currentSem={activeSem} onClose={() => setShowPromotionModal(false)} onConfirm={handleBulkPromote} />
        )}

        {(showGroupModal || editGroupTarget) && (
          <GroupFormModal group={editGroupTarget} ayId={activeAcademicYear.id} sem={activeSem} onClose={() => { setShowGroupModal(false); setEditGroupTarget(null); }} onRefresh={fetchGroups} showToast={showToast} />
        )}

        {showAutoClassModal && (
          <AutoGenerateClassModal ayId={activeAcademicYear.id} sem={activeSem} onClose={() => setShowAutoClassModal(false)} onRefresh={fetchGroups} showToast={showToast} />
        )}

        {showAutoSplitModal && (
          <AutoSplitLabModal masterClasses={groups.filter(g => g.type === 'CLASS')} onClose={() => setShowAutoSplitModal(false)} onRefresh={fetchGroups} showToast={showToast} />
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
      <motion.div className="modal-content premium-modal" style={{ maxWidth: "500px", padding: "2rem" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.3rem" }}>Auto-Generate Master Class</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="sinput-group">
            <label>Target Semester</label>
            <select className="standard-input" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: "1rem", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.5" }}>
            This will fetch all active students in the selected semester and automatically group them into a new <strong>Master Class</strong>. If it already exists, it will update it with new students.
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
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
      <motion.div className="modal-content premium-modal" style={{ maxWidth: "500px", padding: "2rem" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.3rem" }}>Auto-Split Lab Batches</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          <p className="text-muted" style={{ fontSize: "0.85rem", lineHeight: "1.5" }}>
            The system will alphabetically sort the students in the Master Class by roll number and divide them evenly into {numBatches} lab batches.
          </p>
        </div>
        <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
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
      <motion.div className="modal-content premium-modal" style={{ maxWidth: "500px", padding: "2rem" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.3rem" }}>Update Semester</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            You are updating the semester for <strong>{count}</strong> selected students.
          </p>
          <div className="sinput-group">
            <label>Target Semester</label>
            <select className="standard-input" value={targetSem} onChange={(e) => setTargetSem(parseInt(e.target.value))}>
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
        <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
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
      <motion.div className="modal-content premium-modal" style={{ maxWidth: "800px", padding: "2rem" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.3rem" }}>{group ? "Edit Group" : "Create Custom Group"}</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <div className="sinput-group" style={{ flex: "2 1 300px" }}>
              <label>Group Name</label>
              <input className="standard-input" type="text" required placeholder="e.g. PE-Blockchain" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="sinput-group" style={{ flex: "1 1 150px" }}>
              <label>Type</label>
              <select className="standard-input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} disabled={group && group.type === 'CLASS'}>
                <option value="CLASS">Master Class</option>
                <option value="BATCH">Lab Batch</option>
                <option value="ELECTIVE">Elective Section</option>
              </select>
            </div>
            <div className="sinput-group" style={{ flex: "1 1 150px" }}>
              <label>Semester</label>
              <select className="standard-input" value={formData.semester} onChange={e => setFormData({...formData, semester: parseInt(e.target.value)})}>
                 {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                Enroll Students <span className="badge badge-role">{selectedStudents.size} Selected</span>
              </h4>
              <div className="search-bar" style={{ minWidth: "250px", flex: 1, maxWidth: "400px" }}>
                <Search size={16} className="text-muted" />
                <input type="text" placeholder="Search by name or roll number..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
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
                        {selectedStudents.has(s.id) ? <CheckSquare className="text-primary" size={20}/> : <Square className="text-muted" size={20}/>}
                      </td>
                      <td className="text-muted font-medium" style={{ padding: "12px" }}>{s.roll_number}</td>
                      <td className="font-medium" style={{ padding: "12px" }}>{s.full_name}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>No students match your search.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Group"}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default StudentDirectory;
