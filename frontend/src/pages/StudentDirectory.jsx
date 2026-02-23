import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  UserPlus,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  ArrowRight,
  BookOpen,
  Layers,
  CheckCircle,
  AlertTriangle,
  X,
  Edit2,
  UserX,
  UserCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { studentService } from "../services/api";
import "./StudentDirectory.css";
import { useAcademic } from "../context/AcademicContext";

const StudentDirectory = () => {
  const { activeAcademicYear } = useAcademic();

  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSem, setActiveSem] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudents, setSelectedStudents] = useState(new Set());

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    if (activeAcademicYear) {
      fetchData();
      setSelectedStudents(new Set());
    }
  }, [activeSem, searchTerm, activeAcademicYear]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, groupsRes] = await Promise.all([
        studentService.getStudents(
          activeAcademicYear.id,
          activeSem,
          searchTerm,
        ),
        studentService.getGroups(activeAcademicYear.id, activeSem),
      ]);
      setStudents(studentsRes.data);
      setGroups(groupsRes.data);
    } catch (error) {
      showToast("Failed to fetch data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length)
      setSelectedStudents(new Set());
    else setSelectedStudents(new Set(students.map((s) => s.id)));
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const handleBulkPromote = async (targetSem) => {
    if (selectedStudents.size === 0) return;
    try {
      await studentService.bulkUpdateSemester(
        Array.from(selectedStudents),
        targetSem,
        activeAcademicYear.id, // <-- NEW: Locks them into the current active year
      );
      showToast(
        `Successfully moved ${selectedStudents.size} students to Sem ${targetSem}`,
      );
      setShowPromoteModal(false);
      setSelectedStudents(new Set()); // <-- Clears the checkboxes after promoting
      fetchData();
    } catch (err) {
      showToast("Failed to promote students.", "error");
    }
  };

  const handleAssignToGroup = async (groupId) => {
    if (selectedStudents.size === 0) return;
    try {
      await studentService.updateGroupStudents(
        groupId,
        Array.from(selectedStudents),
        "add",
      );
      showToast(`Added ${selectedStudents.size} students to group.`);
      fetchData();
      setSelectedStudents(new Set());
    } catch (err) {
      showToast("Failed to assign students.", "error");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      await studentService.deleteGroup(groupId);
      showToast("Group deleted successfully.");
      fetchData();
    } catch (err) {
      showToast("Failed to delete group.", "error");
    }
  };

  const handleToggleStatus = async (student) => {
    const actionText = student.is_active ? "deactivate" : "activate";
    if (
      !window.confirm(
        `Are you sure you want to ${actionText} ${student.full_name}?`,
      )
    )
      return;
    try {
      await studentService.toggleStatus(student.id);
      showToast(`Student ${actionText}d successfully.`);
      fetchData();
    } catch (err) {
      showToast("Failed to change student status.", "error");
    }
  };

  // loading guard
  if (!activeAcademicYear) {
    return (
      <div
        className="fade-in"
        style={{ padding: "2rem", textAlign: "center", marginTop: "5rem" }}
      >
        <AlertTriangle
          size={48}
          color="#f59e0b"
          style={{ margin: "0 auto 1rem auto" }}
        />
        <h2 style={{ color: "var(--text-primary)" }}>No Academic Year Found</h2>
        <p style={{ color: "var(--text-muted)" }}>
          Please go to Settings and create an Academic Year to start using this
          module.
        </p>
      </div>
    );
  }
  return (
    <div className="directory-container fade-in">
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
          <h1 className="page-title">Student Directory & Batches</h1>
          <p className="page-subtitle">
            Organize {activeAcademicYear.name} students into classes and lab
            batches.
          </p>
        </div>
      </div>

      <div className="directory-toolbar glass-panel">
        <div className="search-bar" style={{ width: "300px" }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Name or Enrollment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="semester-tabs">
          <Filter
            size={18}
            className="text-secondary"
            style={{ marginRight: "10px" }}
          />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <button
              key={sem}
              className={`sem-tab ${activeSem === sem ? "active" : ""}`}
              onClick={() => setActiveSem(sem)}
            >
              Sem {sem}
            </button>
          ))}
        </div>
      </div>

      <div className="split-layout">
        {/* LEFT PANE */}
        <div className="left-pane glass-panel">
          <div className="pane-header">
            <h3>
              <Users size={18} className="text-primary" /> Master Roster (Sem{" "}
              {activeSem})
            </h3>
            <span className="count-badge">{students.length} Students</span>
          </div>

          <AnimatePresence>
            {selectedStudents.size > 0 && (
              <motion.div
                className="bulk-action-bar"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <span className="selection-count">
                  {selectedStudents.size} Selected
                </span>
                <div className="bulk-actions">
                  <button
                    className="btn-warning btn-sm"
                    onClick={() => setShowPromoteModal(true)}
                  >
                    <ArrowRight size={16} /> Promote
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setSelectedStudents(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="table-wrapper">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
              </div>
            ) : (
              <table className="roster-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <button
                        className="checkbox-btn"
                        onClick={handleSelectAll}
                      >
                        {selectedStudents.size === students.length &&
                        students.length > 0 ? (
                          <CheckSquare size={18} className="text-primary" />
                        ) : (
                          <Square size={18} className="text-muted" />
                        )}
                      </button>
                    </th>
                    <th>Enrollment</th>
                    <th>Full Name</th>
                    <th>Roll No</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length > 0 ? (
                    students.map((student) => (
                      <tr
                        key={student.id}
                        className={
                          selectedStudents.has(student.id) ? "selected-row" : ""
                        }
                        style={{
                          opacity: student.is_active === false ? 0.5 : 1,
                        }}
                      >
                        <td>
                          <button
                            className="checkbox-btn"
                            onClick={() => toggleSelection(student.id)}
                          >
                            {selectedStudents.has(student.id) ? (
                              <CheckSquare size={18} className="text-primary" />
                            ) : (
                              <Square size={18} className="text-muted" />
                            )}
                          </button>
                        </td>
                        <td className="font-mono text-sm">
                          {student.enrollment_number}
                        </td>
                        <td className="font-medium">
                          {student.full_name}{" "}
                          {student.is_active === false && (
                            <span style={{ color: "red", fontSize: "0.7rem" }}>
                              (Deactivated)
                            </span>
                          )}
                        </td>
                        <td
                          className="text-muted"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          {student.roll_number || "-"}
                          {/* NEW: Deactivate Button */}
                          <button
                            className="btn-icon"
                            onClick={() => handleToggleStatus(student)}
                            title={
                              student.is_active
                                ? "Deactivate Student"
                                : "Activate Student"
                            }
                          >
                            {student.is_active ? (
                              <UserX size={16} color="#ef4444" />
                            ) : (
                              <UserCheck size={16} color="#10b981" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        <Users size={32} className="opacity-20 mb-2" />
                        <p>No students found for this semester.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="right-pane">
          <div className="pane-header">
            <h3>
              <Layers size={18} className="text-primary" /> Groups & Batches
            </h3>
            {/* COMPACT BUTTON */}
            <button
              className="btn-primary"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
              onClick={() => setShowGroupModal(true)}
            >
              <UserPlus size={16} /> New Group
            </button>
          </div>

          <div className="groups-grid">
            {groups.length > 0 ? (
              groups.map((group) => (
                <div
                  key={group.id}
                  className={`group-card ${selectedStudents.size > 0 ? "assignment-mode" : ""}`}
                >
                  <div className="group-card-header">
                    <div>
                      <h4>{group.name}</h4>
                      <span
                        className={`badge type-${group.type.toLowerCase()}`}
                      >
                        {group.type}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn-icon hover-primary"
                        onClick={() => setEditGroupTarget(group)}
                        title="Edit Group"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="btn-icon hover-red"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="Delete Group"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="group-card-body">
                    <div className="student-count">
                      <Users size={16} /> {group.student_count} Students
                    </div>

                    <AnimatePresence>
                      {selectedStudents.size > 0 && (
                        <motion.button
                          className="btn-assign"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          onClick={() => handleAssignToGroup(group.id)}
                        >
                          <UserPlus size={16} /> Add {selectedStudents.size}{" "}
                          Students Here
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state glass-panel">
                <BookOpen size={32} className="opacity-20 mb-2" />
                <p>No batches created for this semester.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(showGroupModal || editGroupTarget) && (
          <GroupFormModal
            activeSem={activeSem}
            activeAyId={activeAcademicYear.id}
            groupData={editGroupTarget}
            onClose={() => {
              setShowGroupModal(false);
              setEditGroupTarget(null);
            }}
            onRefresh={fetchData}
            showToast={showToast}
          />
        )}
        {showPromoteModal && (
          <PromoteModal
            selectedCount={selectedStudents.size}
            currentSem={activeSem}
            onClose={() => setShowPromoteModal(false)}
            onConfirm={handleBulkPromote}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- DYNAMIC GROUP FORM MODAL ---
const GroupFormModal = ({
  onClose,
  onRefresh,
  showToast,
  activeSem,
  activeAyId,
  groupData = null,
}) => {
  const isEdit = !!groupData;
  const [formData, setFormData] = useState({
    name: groupData?.name || "",
    type: groupData?.type || "CLASS",
    semester: groupData?.semester || activeSem,
    academic_year: activeAyId,
  });

  // Local state to track students so we can remove them instantly from the UI
  const [studentsList, setStudentsList] = useState(
    groupData?.students_list || [],
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await studentService.updateGroup({ id: groupData.id, ...formData });
        showToast("Group updated successfully.");
      } else {
        await studentService.createGroup(formData);
        showToast("Group created successfully.");
      }
      onRefresh();
      onClose();
    } catch (err) {
      showToast("Failed to save group.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      await studentService.updateGroupStudents(
        groupData.id,
        [studentId],
        "remove",
      );
      setStudentsList(studentsList.filter((s) => s.id !== studentId)); // Remove from UI instantly
      onRefresh(); // Refresh background data
      showToast("Student removed from batch.", "success");
    } catch (err) {
      showToast("Failed to remove student.", "error");
    }
  };

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal small-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3>{isEdit ? "Edit Batch" : "Create New Batch"}</h3>
            <p className="modal-subtitle">Semester {activeSem} Student Group</p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="premium-form">
          <div className="sinput-group">
            <label>Group Name</label>
            <input
              required
              type="text"
              placeholder="e.g. TE ECS - Batch A1"
              className="standard-input"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="sinput-group">
            <label>Group Type</label>
            <select
              className="standard-input"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
            >
              <option value="CLASS">Whole Class (Theory)</option>
              <option value="BATCH">Lab Batch (Practical)</option>
              <option value="ELECTIVE">Elective Section</option>
            </select>
          </div>

          {/* NEW: Student Roster Management for Edit Mode */}
          {isEdit && (
            <div className="sinput-group mt-4">
              <label>Current Students ({studentsList.length})</label>
              <div className="students-scroll-box">
                {studentsList.map((s) => (
                  <div key={s.id} className="mini-student-row">
                    <span>
                      {s.full_name}{" "}
                      <span className="text-muted text-sm">
                        ({s.enrollment_number})
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn-remove-student"
                      onClick={() => handleRemoveStudent(s.id)}
                      title="Remove from Group"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {studentsList.length === 0 && (
                  <p className="text-muted text-sm" style={{ padding: "10px" }}>
                    No students in this batch.
                  </p>
                )}
              </div>
              <p
                className="text-muted text-sm mt-2"
                style={{ fontSize: "0.8rem" }}
              >
                * To add more students, select them from the Master Roster.
              </p>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Group"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- PROMOTE / DEMOTE MODAL ---
const PromoteModal = ({ onClose, onConfirm, selectedCount, currentSem }) => {
  const defaultSem = currentSem < 8 ? currentSem + 1 : 1;
  const [targetSem, setTargetSem] = useState(defaultSem);

  // Check if they are demoting/degrading
  const isDemotion = targetSem < currentSem;

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal small-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3 className="text-warning">Update Semester</h3>
            <p className="modal-subtitle">
              Move {selectedCount} students to a new semester.
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="premium-form" style={{ padding: "1rem 0" }}>
          <div className="sinput-group">
            <label>Target Semester</label>
            <select
              className="standard-input"
              value={targetSem}
              onChange={(e) => setTargetSem(parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* NEW: Demotion Warning popup */}
          {isDemotion && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="alert-danger"
            >
              <AlertTriangle size={20} />
              <div>
                <strong>Warning!</strong>
                <div style={{ fontSize: "0.85rem" }}>
                  You are moving students backwards to a lower semester (Year
                  Down / ATKT).
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={isDemotion ? "btn-danger" : "btn-warning"}
            onClick={() => onConfirm(targetSem)}
          >
            {isDemotion ? "Confirm Demotion" : "Promote Students"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default StudentDirectory;
