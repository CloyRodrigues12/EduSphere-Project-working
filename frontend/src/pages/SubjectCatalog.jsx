import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  AlertTriangle,
  Layers,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { academicService } from "../services/api";
import "./SubjectCatalog.css";
import { useAuth } from "../context/AuthContext";

const SubjectCatalog = () => {

const { user } = useAuth();

  // Filters
  const [term, setTerm] = useState("odd"); // 'odd' or 'even'
  const [activeSem, setActiveSem] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Data
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Actions
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const oddSems = [1, 3, 5, 7];
  const evenSems = [2, 4, 6, 8];
  const currentSems = term === "odd" ? oddSems : evenSems;

  // Handle Term Switch
  useEffect(() => {
    setActiveSem(term === "odd" ? 1 : 2);
  }, [term]);

  useEffect(() => {
    fetchSubjects();
  }, [activeSem]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  // Role verification check
  const isAuthorizedToEdit = ["ORG_ADMIN", "SUPER_ADMIN", "HOD"].includes(user?.role_code);
  
  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await academicService.getSubjects(activeSem);
      setSubjects(res.data);
    } catch (error) {
      showToast("Failed to fetch subjects", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await academicService.deleteSubject(deleteTarget.id);
      showToast("Subject deleted safely", "success");
      fetchSubjects();
    } catch (err) {
      showToast(err.response?.data?.error || "Delete failed", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="catalog-container fade-in">
      <div
        className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}
      >
        {toast.type === "success" ? (
          <CheckCircle size={18} />
        ) : (
          <AlertTriangle size={18} />
        )}
        <span>{toast.message}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Subject Catalog</h1>
          <p className="page-subtitle">
            Define the curriculum and electives for the department.
          </p>
        </div>
        {/* Wrap the Add Subject button */}
           {isAuthorizedToEdit && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={18} /> Add Subject
              </button>
           )}
      </div>

      {/* Term & Semester Controls */}
      <div className="curriculum-controls glass-panel">
        <div className="term-toggle">
          <button
            className={`term-btn ${term === "odd" ? "active" : ""}`}
            onClick={() => setTerm("odd")}
          >
            Odd Term (Jul-Dec)
          </button>
          <button
            className={`term-btn ${term === "even" ? "active" : ""}`}
            onClick={() => setTerm("even")}
          >
            Even Term (Jan-Jun)
          </button>
        </div>

        <div className="semester-pills">
          {currentSems.map((sem) => (
            <button
              key={sem}
              className={`sem-pill ${activeSem === sem ? "active" : ""}`}
              onClick={() => setActiveSem(sem)}
            >
              Semester {sem}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search subjects by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading Syllabus...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject Name</th>
                <th>Type</th>
                <th>Credits</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {filteredSubjects.length > 0 ? (
                  filteredSubjects.map((sub) => (
                    <motion.tr
                      key={sub.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td className="font-medium text-primary">{sub.code}</td>
                      <td className="font-medium">
                        {sub.name}
                        {sub.is_open_elective && (
                          <span className="badge badge-open">
                            Open Elective
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge type-${sub.subject_type.toLowerCase()}`}
                        >
                          {sub.subject_type.replace("_", " ")}
                        </span>
                      </td>
                      {/* Wrap the Edit/Delete actions */}
         
                      <td>
                        <div className="credit-bubble">{sub.credits}</div>
                        
                      </td>{isAuthorizedToEdit && (
           <>
                      <td style={{ textAlign: "right" }}>
                        
                        <button
                          className="btn-icon action-edit"
                          onClick={() => setEditTarget(sub)}
                          title="Edit Subject"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon action-delete"
                          onClick={() => setDeleteTarget(sub)}
                          title="Delete Subject"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                      </>
         )}
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr>
                    <td colSpan="5" className="empty-state">
                      <BookOpen
                        size={48}
                        className="text-muted opacity-20 mb-2"
                      />
                      <p>No subjects defined for Semester {activeSem}.</p>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {(showModal || editTarget) && (
          <SubjectFormModal
            subjectData={editTarget}
            activeSem={activeSem}
            onClose={() => {
              setShowModal(false);
              setEditTarget(null);
            }}
            onRefresh={fetchSubjects}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Delete Lock/Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content premium-modal delete-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="delete-icon-wrapper">
                <AlertTriangle size={32} />
              </div>
              <h3>Delete Subject?</h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "1.5rem",
                }}
              >
                Are you sure you want to delete{" "}
                <strong>
                  {deleteTarget.code} - {deleteTarget.name}
                </strong>
                ?
                <br />
                <br />
                <span className="text-error" style={{ fontSize: "0.85rem" }}>
                  * If this subject is already allocated to a teacher, the
                  system will block this deletion.
                </span>
              </p>
              <div
                className="modal-actions"
                style={{ justifyContent: "center", borderTop: "none" }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button className="btn-danger" onClick={confirmDelete}>
                  Attempt Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUBJECT FORM MODAL ---
const SubjectFormModal = ({
  onClose,
  onRefresh,
  showToast,
  activeSem,
  subjectData = null,
}) => {
  const isEdit = !!subjectData;
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    code: subjectData?.code || "",
    name: subjectData?.name || "",
    subject_type: subjectData?.subject_type || "THEORY",
    credits: subjectData?.credits || 3,
    semester: subjectData?.semester || activeSem,
    is_open_elective: subjectData?.is_open_elective || false,
  });

  // SMART LOGIC: Auto-assign credits and Elective status based on Type
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    let newCredits = formData.credits;
    let isOpenElective = formData.is_open_elective;

    if (newType === "LAB") newCredits = 1;
    else if (newType === "THEORY") newCredits = 3;

    if (newType === "OPEN_ELECTIVE") isOpenElective = true;
    else if (newType !== "PRO_ELECTIVE") isOpenElective = false;

    setFormData({
      ...formData,
      subject_type: newType,
      credits: newCredits,
      is_open_elective: isOpenElective,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await academicService.updateSubject({
          id: subjectData.id,
          ...formData,
        });
        showToast("Subject updated successfully!");
      } else {
        await academicService.addSubject(formData);
        showToast("Subject added to catalog!");
      }
      onRefresh();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || "Error saving subject", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="modal-header">
          <div>
            <h3>{isEdit ? "Edit Subject" : "Add New Subject"}</h3>
            <p className="modal-subtitle">
              Semester {formData.semester} Curriculum
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="premium-form">
          <div className="input-row">
            <div className="sinput-group">
              <label>Subject Code</label>
              <div className="input-wrapper">
                <Zap size={18} className="input-icon" />
                <input
                  required
                  type="text"
                  placeholder="e.g. CS501"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>
            <div className="sinput-group">
              <label>Credits</label>
              <div className="input-wrapper">
                <Layers size={18} className="input-icon" />
                <input
                  required
                  type="number"
                  min="1"
                  max="6"
                  value={formData.credits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      credits: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="sinput-group">
            <label>Subject Name</label>
            <div className="input-wrapper">
              <BookOpen size={18} className="input-icon" />
              <input
                required
                type="text"
                placeholder="e.g. Database Management Systems"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
          </div>

          <div className="sinput-group">
            <label>Subject Type</label>
            <div className="input-wrapper">
              <Layers size={18} className="input-icon" />
              <select value={formData.subject_type} onChange={handleTypeChange}>
                <option value="THEORY">Theory (Compulsory)</option>
                <option value="LAB">Practical / Lab</option>
                <option value="PRO_ELECTIVE">Professional Elective</option>
                <option value="OPEN_ELECTIVE">
                  Open Elective (Cross-Dept)
                </option>
              </select>
            </div>
          </div>

          {(formData.subject_type === "PRO_ELECTIVE" ||
            formData.subject_type === "OPEN_ELECTIVE") && (
            <div className="custom-checkbox mt-4">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_open_elective}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_open_elective: e.target.checked,
                    })
                  }
                  disabled={formData.subject_type === "OPEN_ELECTIVE"}
                />
                <span>
                  Allow students from other departments to enroll in this
                  subject.
                </span>
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Subject"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SubjectCatalog;
