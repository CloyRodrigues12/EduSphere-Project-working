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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { staffService, academicService, studentService } from "../services/api";
import "./AllocationMatrix.css";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";

const AllocationMatrix = () => {
  const { activeAcademicYear, activeDepartment } = useAcademic();
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
  }, [selectedFaculty]);

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
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-muted">
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

      <div className="page-header">
        <div>
          <h1 className="page-title">Teaching Allocation Matrix</h1>
          <p className="page-subtitle">
            Assign subjects and batches to faculty for {activeAcademicYear.name}
          </p>
        </div>
      </div>

      <div className="split-layout">
        <div className="left-pane glass-panel">
          <div className="pane-header">
            <h3 className="text-primary"> Faculty Members</h3>
          </div>

          <div className="search-bar" style={{ margin: "1rem", width: "auto" }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                    <div style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase", background: "var(--bg-main)", borderBottom: "1px solid var(--border-color)", borderTop: "1px solid var(--border-color)" }}>
                      📍 My Department
                    </div>
                  )}
                  {internalFaculties.map((faculty) => renderFacultyRow(faculty, false))}

                  {externalFaculties.length > 0 && (
                    <div style={{ padding: "0.5rem 1rem", fontSize: "0.75rem", fontWeight: "bold", color: "var(--text-muted)", textTransform: "uppercase", background: "var(--bg-main)", borderBottom: "1px solid var(--border-color)", borderTop: "1px solid var(--border-color)", marginTop: "0.5rem" }}>
                      🌐 Other Departments
                    </div>
                  )}
                  {externalFaculties.map((faculty) => renderFacultyRow(faculty, true))}
                </>
              )
            )}
          </div>
        </div>

        <div className="right-pane">
          {selectedFaculty ? (
            <>
              <div className="workload-header glass-panel">
                <div>
                  <h2 className="text-primary">
                    {selectedFaculty.full_name || selectedFaculty.name}'s
                    Workload
                  </h2>
                  <p className="text-muted">
                    {allocations.length} Classes Assigned
                  </p>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => setShowModal(true)}
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
                        >
                          {alloc.subject_type.replace("_", " ")}
                        </span>
                        <button
                          className="btn-icon hover-red"
                          onClick={() =>
                            setDeleteTarget(alloc)
                          } 
                          title="Remove Class"
                        >
                          <Trash2 size={16} />
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
                    className="empty-state glass-panel"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <BookOpen
                      size={48}
                      className="text-muted opacity-20 mb-2"
                    />
                    <p>No classes assigned to this teacher yet.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              className="empty-state glass-panel"
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
              }}
            >
              <Briefcase size={42} className="text-muted opacity-40 mb-3" />
              <h3
                style={{
                  marginBottom: "1.5rem",
                  color: "var(--text-primary)",
                  fontSize: "1.2rem",
                }}
              >
                Select a Faculty Member
              </h3>

              <div
                style={{
                  maxWidth: "380px",
                  textAlign: "left",
                  background: "var(--bg-input)",
                  padding: "1.2rem",
                  borderRadius: "10px",
                  border: "1px solid var(--border-color)",
                }}
              >
                <h4
                  style={{
                    color: "var(--primary-color)",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.95rem",
                  }}
                >
                  <Layers size={16} /> How to Allocate Workload:
                </h4>
                <ol
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.85rem",
                    lineHeight: "1.7",
                    paddingLeft: "1.2rem",
                    margin: 0,
                  }}
                >
                  <li style={{ marginBottom: "4px" }}>
                    Click on a <strong>teacher's name</strong> from the left
                    panel.
                  </li>
                  <li style={{ marginBottom: "4px" }}>
                    Click the <strong>+ Assign Class</strong> button.
                  </li>
                  <li style={{ marginBottom: "4px" }}>
                    Select the <strong>Subject</strong> they will teach.
                  </li>
                  <li style={{ marginBottom: "4px" }}>
                    Check the boxes for one or multiple{" "}
                    <strong>Batches/Classes</strong>.
                  </li>
                  <li>Click Save to instantly assign the workload.</li>
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
            >
              <div
                className="delete-icon-wrapper"
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "1rem",
                  color: "#ef4444",
                }}
              >
                <AlertTriangle size={48} />
              </div>
              <h3 style={{ textAlign: "center" }}>Remove Allocation?</h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "1.5rem",
                  textAlign: "center",
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
                style={{ justifyContent: "center", borderTop: "none" }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button className="btn-danger" onClick={confirmDelete}>
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

const AllocationModal = ({ faculty, ayId, onClose, onRefresh, showToast }) => {
  const [filterSem, setFilterSem] = useState(1);
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

        <div className="filter-pill-bar">
          <span className="text-sm font-medium text-muted mr-2">
            Curriculum:
          </span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
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

        <form
          onSubmit={handleSubmit}
          className="premium-form"
          style={{ marginTop: "1rem" }}
        >
          <div className="sinput-group">
            <label>Select Subject</label>
            <div className="subject-select-box">
              {subjects.length > 0 ? (
                subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className={`subject-select-item ${selectedSubject === sub.id ? "selected" : ""}`}
                    onClick={() => handleSubjectSelect(sub.id)}
                  >
                    <div className="item-details">
                      <span className="font-medium">
                        {sub.code} - {sub.name}
                      </span>
                      <span className="text-sm text-muted">
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
                <p className="text-muted text-sm p-3">
                  No subjects defined for Sem {filterSem} yet.
                </p>
              )}
            </div>
          </div>

          {selectedSubject && (
            <div className="sinput-group mt-4">
              <label>Select Target Audience (Batches / Classes)</label>
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
                      <div className="item-details">
                        <span className="font-medium">{group.name}</span>
                        <span className="text-sm text-muted">
                          {" "}
                          • {group.student_count} Students • {group.type}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted text-sm p-3">
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

          <div className="modal-actions" style={{ marginTop: "2rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading || !selectedSubject || selectedGroups.size === 0
              }
              className={conflictWarning ? "btn-danger" : "btn-primary"}
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