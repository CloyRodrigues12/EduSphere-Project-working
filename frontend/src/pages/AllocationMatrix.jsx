import React, { useState, useEffect } from "react";
import {
  Briefcase,
  BookOpen,
  Layers,
  Plus,
  Trash2,
  Search,
  CheckSquare,
  Square,
  CheckCircle,
  AlertTriangle,
  X,
  User,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { staffService, academicService, studentService } from "../services/api";
import "./AllocationMatrix.css";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";

const AllocationMatrix = () => {
  const { activeAcademicYear, activeDepartment, activeTerm } = useAcademic();
  const { user } = useAuth();

  const [facultyList, setFacultyList] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); 
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const isOrgAdmin = ["ORG_ADMIN", "SUPER_ADMIN"].includes(user?.role_code);

  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const BACKEND_URL = "http://localhost:8000";
    return `${BACKEND_URL}${path}`;
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  useEffect(() => {
    if (selectedFaculty) fetchAllocations(selectedFaculty.id);
  }, [selectedFaculty, activeTerm, activeAcademicYear, activeDepartment]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const fetchFaculty = async () => {
    try {
      const res = await staffService.getOrganizationFaculties()
      setFacultyList(res.data);
    } catch (err) {
      showToast("Failed to load faculty", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocations = async (facultyId) => {
    try {
      const res = await academicService.getAllocations(
        activeAcademicYear.id,
        facultyId,
      );
      setAllocations(res.data);
    } catch (err) {
      showToast("Failed to load allocations", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await academicService.deleteAllocation(deleteTarget.id);
      showToast("Class removed from workload", "success");
      fetchAllocations(selectedFaculty.id);
    } catch (err) {
      showToast("Failed to remove class", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredFaculty = facultyList.filter((f) => {
    const displayName = f.full_name || f.name || "";
    return displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const internalFaculties = filteredFaculty.filter((f) => (f.department_name || f.department) === activeDepartment?.name);
  const externalFaculties = filteredFaculty.filter((f) => (f.department_name || f.department) !== activeDepartment?.name);

  if (!activeAcademicYear) {
    return <div className="spinner" style={{ margin: "5rem auto" }}></div>;
  }

  const renderFacultyRow = (faculty, isExternal = false) => {
    const displayName = faculty.full_name || faculty.name || "Unknown";
    return (
      <div
        key={faculty.id}
        className={`faculty-list-item ${selectedFaculty?.id === faculty.id ? "active" : ""}`}
        onClick={() => setSelectedFaculty(faculty)}
      >
        {faculty.profile_picture ? (
          <img
            src={getImageUrl(faculty.profile_picture)}
            alt={displayName}
            className="avatar-circle-sm"
            style={{ objectFit: "cover" }}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}

        <div
          className="avatar-circle-sm fallback-avatar"
          style={{
            background: "var(--primary-color)",
            display: faculty.profile_picture ? "none" : "flex",
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div>
          <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{displayName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
            {faculty.designation || "Faculty"} 
            {isExternal && <span style={{ color: "#d97706", fontWeight: "bold", marginLeft: "4px" }}>• {faculty.department_name || faculty.department}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="allocation-container fade-in">
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

      {/* 🚨 ISOLATED AM-HEADER */}
      <div className="am-page-header">
        {selectedFaculty && (
          <button className="am-header-back-btn" onClick={() => setSelectedFaculty(null)}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="am-header-content">
          <h1 className="am-page-title">Teaching Allocation Matrix</h1>
          <p className="am-page-subtitle">
            Assign subjects and batches to faculty for {activeAcademicYear.name} ({activeTerm} Term)
          </p>
        </div>
      </div>

      <div className="split-layout">
        
        {/* 🚨 LEFT PANE: Hidden on mobile if a faculty is selected */}
        <div className={`left-pane ${selectedFaculty ? 'hide-on-mobile' : ''}`}>
          <div className="pane-header">
            <h3>Faculty Members</h3>
          </div>

          <div className="pane-search-wrapper">
            <div className="search-bar">
              <Search size={18} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search faculty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="faculty-scroll-list">
            {loading ? (
              <div className="spinner" style={{ margin: "2rem auto" }}></div>
            ) : (
              isOrgAdmin ? (
                filteredFaculty.map((faculty) => renderFacultyRow(faculty, true))
              ) : (
                <>
                  {internalFaculties.length > 0 && (
                    <div className="department-divider">
                      📍 My Department
                    </div>
                  )}
                  {internalFaculties.map((faculty) => renderFacultyRow(faculty, false))}

                  {externalFaculties.length > 0 && (
                    <div className="department-divider" style={{ marginTop: "1rem" }}>
                      🌐 Other Departments
                    </div>
                  )}
                  {externalFaculties.map((faculty) => renderFacultyRow(faculty, true))}
                </>
              )
            )}
          </div>
        </div>

        {/* 🚨 RIGHT PANE: Hidden on mobile if NO faculty is selected */}
        <div className={`right-pane ${!selectedFaculty ? 'hide-on-mobile' : ''}`}>
          {selectedFaculty ? (
            <>
              <div className="workload-header">
                <div>
                  <h2 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>
                    {selectedFaculty.full_name || selectedFaculty.name}'s Workload
                  </h2>
                  <p className="text-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                    {allocations.length} Classes Assigned in {activeTerm} Term
                  </p>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => setShowModal(true)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <Plus size={18} /> Assign Class
                </button>
              </div>

              <div className="allocations-grid">
                {allocations.length > 0 ? (
                  allocations.map((alloc) => (
                    <motion.div
                      key={alloc.id}
                      className="class-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="class-card-header">
                        <span
                          className={`badge type-${alloc.subject_type.toLowerCase()}`}
                          style={{ background: "rgba(79, 70, 229, 0.1)", color: "var(--primary-color)", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "bold" }}
                        >
                          {alloc.subject_type.replace("_", " ")}
                        </span>
                        <button
                          className="btn-icon hover-red"
                          style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
                          onClick={() => setDeleteTarget(alloc)} 
                          title="Remove Class"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <h3 className="class-title">{alloc.subject_name}</h3>
                      <p className="class-code">{alloc.subject_code}</p>

                      <div className="class-footer">
                        <div className="audience-tag">
                          <Layers size={14} /> {alloc.group_name}
                        </div>
                        <div className="student-count-tag">
                          <User size={14} /> {alloc.student_count}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div
                    className="right-pane-empty fade-in"
                    style={{ gridColumn: "1 / -1", height: "auto", minHeight: "300px" }}
                  >
                    <div className="empty-icon-wrapper" style={{ background: "transparent" }}>
                      <BookOpen size={48} className="text-muted opacity-20" />
                    </div>
                    <p style={{ color: "var(--text-secondary)", margin: 0 }}>No {activeTerm} Term classes assigned to this teacher yet.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="right-pane-empty fade-in">
              <div className="empty-icon-wrapper">
                <Briefcase size={36} />
              </div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontSize: "1.3rem" }}>
                Select a Faculty Member
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>Choose a teacher from the list to view or edit their assignments.</p>

              <div className="instruction-box">
                <h4><Layers size={16} /> Allocation Guide:</h4>
                <ol>
                  <li style={{ marginBottom: "6px" }}>Click on a <strong>teacher's name</strong>.</li>
                  <li style={{ marginBottom: "6px" }}>Click the <strong>+ Assign Class</strong> button.</li>
                  <li style={{ marginBottom: "6px" }}>Select the <strong>Subject</strong> they will teach.</li>
                  <li style={{ marginBottom: "6px" }}>Check the boxes for one or multiple <strong>Batches</strong>.</li>
                  <li>Click Save to assign the workload instantly.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showModal && selectedFaculty && (
          <AllocationModal
            faculty={selectedFaculty}
            ayId={activeAcademicYear.id}
            activeTerm={activeTerm} 
            onClose={() => setShowModal(false)}
            onRefresh={() => fetchAllocations(selectedFaculty.id)}
            showToast={showToast}
          />
        )}

        {deleteTarget && (
          <div className="modal-overlay">
            <motion.div
              className="modal-content premium-modal delete-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ maxWidth: "400px", padding: "2.5rem 2rem 2rem", textAlign: "center" }}
            >
              <div
                className="delete-icon-wrapper"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: "1rem",
                  color: "#ef4444",
                  background: "rgba(239, 68, 68, 0.1)",
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  margin: "0 auto 1.5rem auto"
                }}
              >
                <AlertTriangle size={32} />
              </div>
              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.4rem" }}>Remove Allocation?</h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "2rem",
                }}
              >
                Are you sure you want to remove{" "}
                <strong>
                  {deleteTarget.subject_name} ({deleteTarget.group_name})
                </strong>{" "}
                from{" "}
                <strong>
                  {selectedFaculty.full_name || selectedFaculty.name}
                </strong>
                's workload?
              </p>
              <div
                className="modal-actions"
                style={{ justifyContent: "center", borderTop: "none", padding: 0, background: "transparent" }}
              >
                <button
                  className="btn-secondary"
                  style={{ padding: "0.8rem 1.8rem", borderRadius: "12px", border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontWeight: "600", cursor: "pointer" }}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-danger" 
                  style={{ padding: "0.8rem 1.8rem", borderRadius: "12px", border: "none", background: "#ef4444", color: "white", fontWeight: "600", cursor: "pointer" }}
                  onClick={confirmDelete}
                >
                  Remove Class
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- MODAL WITH BOTTOM-SHEET SCROLLING ---
const AllocationModal = ({ faculty, ayId, activeTerm, onClose, onRefresh, showToast }) => {
  const availableSemesters = activeTerm === "ODD" ? [1, 3, 5, 7] : [2, 4, 6, 8];
  
  const [filterSem, setFilterSem] = useState(availableSemesters[0]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);

  const [allAllocations, setAllAllocations] = useState([]);
  const [conflictWarning, setConflictWarning] = useState(false);
  const [conflictingClasses, setConflictingClasses] = useState([]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [subRes, grpRes, allocRes] = await Promise.all([
          academicService.getSubjects(filterSem),
          studentService.getGroups(ayId, filterSem),
          academicService.getAllocations(ayId), 
        ]);
        setSubjects(subRes.data);
        setGroups(grpRes.data);
        setAllAllocations(allocRes.data);
        setSelectedSubject("");
        setSelectedGroups(new Set());
        setConflictWarning(false);
      } catch (err) {
        showToast("Error loading curriculum data", "error");
      }
    };
    fetchOptions();
  }, [filterSem]);

  const handleSubjectSelect = (subId) => {
    setSelectedSubject(subId);
    setConflictWarning(false); 
  };

  const toggleGroup = (groupId) => {
    const newSet = new Set(selectedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setSelectedGroups(newSet);
    setConflictWarning(false); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSubject || selectedGroups.size === 0) {
      showToast("Please select a subject and at least one batch.", "error");
      return;
    }

    const conflicts = Array.from(selectedGroups)
      .map((groupId) => {
        return allAllocations.find(
          (a) =>
            a.subject == selectedSubject &&
            a.student_group == groupId &&
            a.faculty !== faculty.id,
        );
      })
      .filter(Boolean);

    if (conflicts.length > 0 && !conflictWarning) {
      setConflictingClasses(conflicts);
      setConflictWarning(true);
      return; 
    }

    setLoading(true);
    try {
      await academicService.createAllocations({
        academic_year: ayId,
        faculty_id: faculty.id,
        subject_id: selectedSubject,
        student_group_ids: Array.from(selectedGroups),
      });
      showToast("Workload assigned successfully!");
      onRefresh();
      onClose();
    } catch (err) {
      showToast(
        err.response?.data?.error || "Error assigning classes",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3>Assign Workload</h3>
            <p className="modal-subtitle">
              Assigning to:{" "}
              <strong className="text-primary">
                {faculty.full_name || faculty.name}
              </strong>
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="filter-pill-bar" style={{ margin: "1.5rem 2rem 0 2rem", background: "transparent", padding: 0 }}>
          <span className="text-sm font-medium text-muted mr-2">
            {activeTerm} Term:
          </span>
          {availableSemesters.map((sem) => (
            <button
              key={sem}
              type="button"
              className={`pill-btn ${filterSem === sem ? "active" : ""}`}
              onClick={() => setFilterSem(sem)}
            >
              Sem {sem}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>Select Subject</label>
              <div className="subject-select-box">
                {subjects.length > 0 ? (
                  subjects.map((sub) => (
                    <div
                      key={sub.id}
                      className={`subject-select-item ${selectedSubject === sub.id ? "selected" : ""}`}
                      onClick={() => handleSubjectSelect(sub.id)}
                    >
                      <div className="item-details">
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {sub.code} - {sub.name}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                          • {sub.subject_type.replace("_", " ")} • {sub.credits}{" "}
                          Credits
                        </span>
                      </div>
                      {selectedSubject === sub.id && (
                        <CheckCircle size={18} className="text-primary" />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted text-sm p-3" style={{ padding: "1rem" }}>
                    No subjects defined for Sem {filterSem} yet.
                  </p>
                )}
              </div>
            </div>

            {selectedSubject && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "1.5rem" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)" }}>Select Target Audience (Batches / Classes)</label>
                <div className="multi-select-box">
                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <div
                        key={group.id}
                        className={`multi-select-item ${selectedGroups.has(group.id) ? "selected" : ""}`}
                        onClick={() => toggleGroup(group.id)}
                      >
                        {selectedGroups.has(group.id) ? (
                          <CheckSquare size={18} className="text-primary" />
                        ) : (
                          <Square size={18} className="text-muted" />
                        )}
                        <div className="item-details" style={{ marginLeft: "4px" }}>
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{group.name}</span>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            {" "}
                            • {group.student_count} Students • {group.type}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted text-sm p-3" style={{ padding: "1rem" }}>
                      No groups created for Sem {filterSem} yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            <AnimatePresence>
              {conflictWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alert-danger"
                >
                  <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Shared Load Warning!</strong>
                    <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                      The following classes are already assigned to other
                      teachers:
                      <ul>
                        {conflictingClasses.map((c, i) => (
                          <li key={i}>
                            <strong>{c.group_name}</strong> (Assigned to{" "}
                            {c.faculty_name})
                          </li>
                        ))}
                      </ul>
                      Proceeding will create a <strong>shared workload</strong>{" "}
                      where both teachers can access these batches.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} style={{ padding: "0.8rem 1.8rem", borderRadius: "12px", border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontWeight: "600", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading || !selectedSubject || selectedGroups.size === 0
              }
              style={{
                padding: "0.8rem 1.8rem", 
                borderRadius: "12px", 
                border: "none", 
                background: conflictWarning ? "#ef4444" : "var(--primary-color)", 
                color: "white", 
                fontWeight: "600", 
                cursor: (loading || !selectedSubject || selectedGroups.size === 0) ? "not-allowed" : "pointer",
                opacity: (loading || !selectedSubject || selectedGroups.size === 0) ? 0.6 : 1
              }}
            >
              {loading
                ? "Assigning..."
                : conflictWarning
                  ? "Confirm & Assign Anyway"
                  : `Assign ${selectedGroups.size} Classes`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AllocationMatrix;