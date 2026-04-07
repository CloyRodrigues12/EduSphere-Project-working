import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { staffService, assignmentService } from "../services/api";
import { Users, GraduationCap, Plus, Trash2, Search, X, AlertTriangle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import "./ClassTeacherAssignments.css";

const ClassTeacherAssignments = () => {
  const { activeAcademicYear, activeDepartment } = useAcademic();
  const [loading, setLoading] = useState(true);

  const [faculties, setFaculties] = useState([]);
  
  // Class Teacher State & Search
  const [classTeachers, setClassTeachers] = useState([]);
  const [showCTModal, setShowCTModal] = useState(false);
  const [deleteCTTarget, setDeleteCTTarget] = useState(null);
  const [ctSearch, setCtSearch] = useState("");
  const [viewCTStudents, setViewCTStudents] = useState(null);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  useEffect(() => {
    if (activeAcademicYear) fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const facRes = await staffService.getFaculty();
      setFaculties(facRes.data);

      const ctRes = await assignmentService.getClassTeachers(activeAcademicYear.id);
      setClassTeachers(ctRes.data);
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

  if (!activeAcademicYear) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  return (
    <div className="assignments-container fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Class Teachers</h1>
          <p className="page-subtitle">Manage Class Teachers and Student Divisions</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: "3rem auto" }}></div>
      ) : (
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

export default ClassTeacherAssignments;