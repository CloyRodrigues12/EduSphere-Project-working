import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { staffService, assignmentService } from "../services/api";
import { Users, Plus, Trash2, Search, X, AlertTriangle, CheckCircle } from "lucide-react";
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
    <div className="class-teacher-scope fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="cta-header-stack">
        <h1>Class Teachers</h1>
        <p>Manage Class Teachers and Student Divisions</p>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: "3rem auto" }}></div>
      ) : (
        <div className="table-card">
          <div className="cta-toolbar">
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>Active Class Teachers</h3>
            <div className="cta-search-bar">
              <Search size={18} className="text-muted" />
              <input 
                type="text" 
                placeholder="Search teachers or classes..." 
                value={ctSearch} 
                onChange={(e) => setCtSearch(e.target.value)} 
              />
            </div>
            
            {/* 🚨 UPDATED: Button now triggers a toast notification instead of sitting silently */}
            {activeDepartment?.id === 'ALL' ? (
              <button 
                className="btn-primary" 
                style={{ opacity: 0.7 }} 
                onClick={() => showToast("Please select a specific department to add a Class Teacher.", "error")}
              >
                <Plus size={18} /> Add Class Teacher
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setShowCTModal(true)}>
                <Plus size={18} /> Add Class Teacher
              </button>
            )}
          </div>
          
          <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
          
          <div className="cta-table-wrapper premium-scroll">
            <table className="cta-strict-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Year Level</th>
                  <th>Division</th>
                  <th>Class Teacher</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredClassTeachers.length > 0 ? filteredClassTeachers.map((ct) => (
                    <motion.tr key={ct.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <td className="font-medium">{ct.department_code}</td>
                      <td><span className="badge badge-role">{ct.year_level}</span></td>
                      <td>{ct.division ? `Div ${ct.division}` : "-"}</td>
                      <td>{ct.faculty_name}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="font-medium" style={{ background: "var(--bg-input)", padding: "4px 10px", borderRadius: "10px", fontSize: "0.85rem", color: "var(--text-primary)" }}>
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
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button className="btn-icon action-delete" onClick={() => setDeleteCTTarget(ct)} title="Remove Teacher">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )) : <tr><td colSpan="6" className="text-center text-muted py-8">No class teachers found.</td></tr>}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      <AnimatePresence>
        {deleteCTTarget && (
          <div className="modal-overlay">
            <motion.div className="modal-content premium-modal delete-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="delete-icon-wrapper"><Trash2 size={32} /></div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Remove Class Teacher?</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: "1.5" }}>
                Are you sure you want to remove <strong>{deleteCTTarget.faculty_name}</strong> as the teacher for <strong>{deleteCTTarget.year_level} {deleteCTTarget.division}</strong>?
              </p>
              <div className="modal-actions" style={{ justifyContent: "center", borderTop: "none", padding: 0 }}>
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
      <motion.div className="modal-content premium-modal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <div>
            <h3>Add Class Teacher</h3>
            <p className="modal-subtitle" style={{ margin: 0 }}>Assign faculty to a specific year and division.</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form">
            <div className="cta-input-group">
              <label>Year Level</label>
              <select className="cta-select" value={formData.year_level} onChange={e => setFormData({...formData, year_level: e.target.value})}>
                <option value="FE">First Year (FE)</option>
                <option value="SE">Second Year (SE)</option>
                <option value="TE">Third Year (TE)</option>
                <option value="BE">Final Year (BE)</option>
              </select>
            </div>
            <div className="cta-input-group">
              <label>Division (Optional)</label>
              <input className="cta-input" type="text" value={formData.division} onChange={e => setFormData({...formData, division: e.target.value})} placeholder="e.g., A, B, C" />
            </div>
            <div className="cta-input-group">
              <label>Select Teacher</label>
              <select className="cta-select" required value={formData.faculty_id} onChange={e => setFormData({...formData, faculty_id: e.target.value})}>
                <option value="" disabled>-- Select Faculty --</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.full_name || f.name}</option>)}
              </select>
            </div>
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
            <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>Class Teacher: {classTeacher.faculty_name} • Total: {students.length}</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)", background: "var(--bg-main)" }}>
          <div className="cta-search-bar" style={{ width: "100%", maxWidth: "100%" }}>
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search students by name or roll number..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
        </div>
        
        <div className="premium-form" style={{ padding: "0 1.5rem 1.5rem 1.5rem", paddingTop: "1rem" }}>
          {loading ? (
             <div className="spinner" style={{ margin: "2rem auto" }}></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted py-4">No students found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {filtered.map(s => (
                <li key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-input)", padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <div className="font-medium" style={{ color: "var(--text-primary)", marginBottom: "4px" }}>{s.full_name}</div>
                    <div className="text-muted text-sm">Semester {s.semester}</div>
                  </div>
                  <div className="font-medium" style={{ color: "var(--text-secondary)" }}>{s.roll_number}</div>
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