import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { academicService, staffService } from "../services/api";
import {
  CalendarDays,
  Plus,
  CheckCircle,
  AlertTriangle,
  Check,
  Edit2,
  ChevronUp,
  ChevronDown,
  Info,
  Users,
  Layers,
  Briefcase,
  BookOpen,
  X,
  Building2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./AcademicSettings.css";

const AcademicSettings = () => {
  // Use refreshContext from the newly updated AcademicContext
  const { refreshContext } = useAcademic();

  const [activeTab, setActiveTab] = useState("years"); // 'years' or 'departments'

  // Data States
  const [academicYears, setAcademicYears] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals (Years)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [summaryTarget, setSummaryTarget] = useState(null);
  const [pendingActiveYear, setPendingActiveYear] = useState(null);

  // Modals (Departments)
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDeptTarget, setEditDeptTarget] = useState(null);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "years") {
        const res = await academicService.getAcademicYears();
        setAcademicYears(res.data);
      } else {
        const res = await staffService.getDepartments();
        setDepartments(res.data);
      }
    } catch (err) {
      showToast("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const confirmSetActive = async () => {
    if (!pendingActiveYear) return;
    try {
      await academicService.updateAcademicYear({
        id: pendingActiveYear.id,
        is_active: true,
      });
      showToast(`${pendingActiveYear.name} is now the active system year!`);
      fetchData();
      if (refreshContext) refreshContext(); // Update Global Topbar
    } catch (err) {
      showToast("Failed to update active year.", "error");
    } finally {
      setPendingActiveYear(null);
    }
  };

  const handleDeleteDept = async (id) => {
    if (!window.confirm("Are you sure you want to delete this department?"))
      return;
    try {
      await staffService.deleteDepartment(id);
      showToast("Department deleted successfully.");
      fetchData();
      if (refreshContext) refreshContext(); // Update Global Topbar
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to delete department.",
        "error",
      );
    }
  };

  return (
    <div className="academic-settings-container fade-in">
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
          <h1 className="page-title">
            <ShieldAlert
              size={28}
              className="text-primary"
              style={{
                display: "inline",
                verticalAlign: "bottom",
                marginRight: "8px",
              }}
            />
            Admin Actions
          </h1>
          <p className="page-subtitle">
            Master configurations and structure for your institution.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() =>
            activeTab === "years"
              ? setShowCreateModal(true)
              : setShowDeptModal(true)
          }
        >
          <Plus size={18} />{" "}
          {activeTab === "years" ? "New Academic Year" : "New Department"}
        </button>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          borderBottom: "2px solid var(--border-color)",
          marginBottom: "2rem",
        }}
      >
        <button
          onClick={() => setActiveTab("years")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "years"
                ? "3px solid var(--primary-color)"
                : "3px solid transparent",
            color:
              activeTab === "years"
                ? "var(--primary-color)"
                : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s",
          }}
        >
          <CalendarDays size={18} /> Academic Years
        </button>
        <button
          onClick={() => setActiveTab("departments")}
          style={{
            padding: "10px 20px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "departments"
                ? "3px solid var(--primary-color)"
                : "3px solid transparent",
            color:
              activeTab === "departments"
                ? "var(--primary-color)"
                : "var(--text-muted)",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s",
          }}
        >
          <Building2 size={18} /> Departments
        </button>
      </div>

      <div className="settings-content">
        <div className="glass-panel p-4">
          <h3
            className="mb-4 text-primary"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            {activeTab === "years" ? (
              <>
                <CalendarDays size={20} /> Registered Academic Years
              </>
            ) : (
              <>
                <Building2 size={20} /> Registered Departments
              </>
            )}
          </h3>

          {loading ? (
            <div className="spinner" style={{ margin: "2rem auto" }}></div>
          ) : (
            <div className="year-list">
              {/* ACADEMIC YEARS LIST */}
              {activeTab === "years" &&
                academicYears.map((ay) => (
                  <div
                    key={ay.id}
                    className={`year-card ${ay.is_active ? "active-year" : ""}`}
                  >
                    <div className="year-info">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <h4 className="year-name">{ay.name}</h4>
                        <button
                          className="btn-icon text-muted"
                          onClick={() => setSummaryTarget(ay)}
                          title="View Year Data Structure"
                        >
                          <Info size={16} />
                        </button>
                        <button
                          className="btn-icon text-muted"
                          onClick={() => setEditTarget(ay)}
                          title="Edit Term Dates"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                      <span className="year-dates">
                        {new Date(ay.start_date).toLocaleDateString()} —{" "}
                        {new Date(ay.end_date).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="year-actions">
                      {ay.is_active ? (
                        <span className="active-badge">
                          <Check size={16} /> Current System Year
                        </span>
                      ) : (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => setPendingActiveYear(ay)}
                        >
                          Set as Active
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {/* DEPARTMENTS LIST */}
              {activeTab === "departments" &&
                departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="year-card"
                    style={{
                      padding: "1rem 1.5rem",
                      borderLeft: "4px solid var(--primary-color)",
                    }}
                  >
                    <div className="year-info">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "4px",
                        }}
                      >
                        <h4 className="year-name">{dept.name}</h4>
                      </div>
                      <span
                        className="year-dates text-muted"
                        style={{
                          display: "inline-block",
                          background: "var(--bg-input)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-color)",
                          fontWeight: "bold",
                        }}
                      >
                        Code: {dept.code}
                      </span>
                    </div>

                    <div
                      className="year-actions"
                      style={{ display: "flex", gap: "8px" }}
                    >
                      <button
                        className="btn-icon edit"
                        onClick={() => {
                          setEditDeptTarget(dept);
                          setShowDeptModal(true);
                        }}
                        title="Edit Department"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="btn-icon delete text-danger"
                        onClick={() => handleDeleteDept(dept.id)}
                        title="Delete Department"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

              {/* EMPTY STATES */}
              {activeTab === "years" && academicYears.length === 0 && (
                <p
                  className="text-muted"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  No academic years found.
                </p>
              )}
              {activeTab === "departments" && departments.length === 0 && (
                <p
                  className="text-muted"
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  No departments found.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {/* 1. CREATE NEW YEAR MODAL */}
        {showCreateModal && (
          <NewYearModal
            onClose={() => setShowCreateModal(false)}
            onRefresh={() => {
              fetchData();
              if (refreshContext) refreshContext();
            }}
            showToast={showToast}
          />
        )}

        {/* 2. EDIT DATES MODAL */}
        {editTarget && (
          <EditYearModal
            year={editTarget}
            onClose={() => setEditTarget(null)}
            onRefresh={fetchData}
            showToast={showToast}
          />
        )}

        {/* 3. YEAR SUMMARY INFO MODAL */}
        {summaryTarget && (
          <YearSummaryModal
            year={summaryTarget}
            onClose={() => setSummaryTarget(null)}
          />
        )}

        {/* 4. SET ACTIVE SYSTEM YEAR CONFIRMATION */}
        {pendingActiveYear && (
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
                  color: "#f59e0b",
                }}
              >
                <AlertTriangle size={48} />
              </div>
              <h3 style={{ textAlign: "center" }}>Update System Database?</h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "1.5rem",
                  textAlign: "center",
                }}
              >
                You are about to make <strong>{pendingActiveYear.name}</strong>{" "}
                the official active year. This will globally lock old data and
                affect where new data is written.
              </p>
              <div
                className="modal-actions"
                style={{ justifyContent: "center", borderTop: "none" }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setPendingActiveYear(null)}
                >
                  Cancel
                </button>
                <button className="btn-warning" onClick={confirmSetActive}>
                  Confirm System Update
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 5. DEPARTMENT CREATE/EDIT MODAL */}
        {(showDeptModal || editDeptTarget) && (
          <DeptFormModal
            dept={editDeptTarget}
            onClose={() => {
              setShowDeptModal(false);
              setEditDeptTarget(null);
            }}
            onRefresh={() => {
              fetchData();
              if (refreshContext) refreshContext();
            }}
            showToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- DEPARTMENT FORM MODAL ---
const DeptFormModal = ({ dept, onClose, onRefresh, showToast }) => {
  const [name, setName] = useState(dept?.name || "");
  const [code, setCode] = useState(dept?.code || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (dept) {
        await staffService.updateDepartment({ id: dept.id, name, code });
        showToast("Department updated successfully!");
      } else {
        await staffService.createDepartment({ name, code });
        showToast("Department created successfully!");
      }
      onRefresh();
      onClose();
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to save department.",
        "error",
      );
    } finally {
      setLoading(false);
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
            <h3>{dept ? "Edit Department" : "Create Department"}</h3>
            <p className="modal-subtitle">Manage organizational units.</p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="sinput-group">
            <label>Department Name</label>
            <input
              type="text"
              className="standard-input"
              required
              placeholder="e.g. Computer Science"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="sinput-group" style={{ marginTop: "1rem" }}>
            <label>Department Code</label>
            <input
              type="text"
              className="standard-input"
              required
              placeholder="e.g. COMP"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              Keep it short, e.g. IT, MECH, ECS.
            </p>
          </div>
          <div className="modal-actions" style={{ marginTop: "2rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : "Save Department"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- YEAR SUMMARY INFO MODAL ---
const YearSummaryModal = ({ year, onClose }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await academicService.getAcademicYearSummary(year.id);
        setStats(res.data);
      } catch (err) {
        console.error("Failed to load summary stats");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [year.id]);

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content premium-modal"
        style={{ maxWidth: "800px" }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3>Database Analytics Report</h3>
            <p className="modal-subtitle">
              System data linked to:{" "}
              <strong className="text-primary">{year.name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        {loading || !stats ? (
          <div className="spinner" style={{ margin: "3rem auto" }}></div>
        ) : (
          <div
            className="summary-scroll-content"
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              paddingRight: "2rem",
              paddingLeft: "2rem",
              marginTop: "1rem",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <div
                className="glass-panel"
                style={{
                  padding: "0.3rem",
                  textAlign: "center",
                  border: "1px solid var(--border-color)",
                }}
              >
                <Users
                  size={24}
                  className="text-primary mx-auto mb-2"
                  style={{ margin: "0 auto" }}
                />
                <h2 style={{ margin: 0 }}>{stats.total_students}</h2>
                <span className="text-muted text-sm">Total Students</span>
              </div>
              <div
                className="glass-panel"
                style={{
                  padding: "0.3rem",
                  textAlign: "center",
                  border: "1px solid var(--border-color)",
                }}
              >
                <BookOpen
                  size={24}
                  className="text-warning mx-auto mb-2"
                  style={{ margin: "0 auto" }}
                />
                <h2 style={{ margin: 0 }}>{stats.total_allocations}</h2>
                <span className="text-muted text-sm">
                  Total Classes Assigned
                </span>
              </div>
            </div>

            <h4
              className="text-primary mb-2"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Layers size={18} /> Batches Created ({stats.total_batches} Total)
            </h4>
            <div
              className="glass-panel"
              style={{
                padding: "10px",
                marginBottom: "1.5rem",
                background: "var(--bg-input)",
              }}
            >
              {stats.semester_breakdown.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {stats.semester_breakdown.map((sem, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-card)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong>Semester {sem.semester}:</strong>{" "}
                      {sem.batch_count} Batches
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm" style={{ margin: "5px" }}>
                  No batches created for this year yet.
                </p>
              )}
            </div>

            <h4
              className="text-primary mb-2"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Briefcase size={18} /> Faculty Workload Assignments
            </h4>
            <div
              className="glass-panel"
              style={{ padding: "10px", background: "var(--bg-input)" }}
            >
              {stats.faculty_workload.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {stats.faculty_workload.map((fac, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px",
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <span className="font-medium">
                        Prof. {fac.faculty__user__first_name}{" "}
                        {fac.faculty__user__last_name}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: "var(--primary-color)",
                          color: "white",
                        }}
                      >
                        {fac.class_count} Classes
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm" style={{ margin: "5px" }}>
                  No subjects allocated to faculty yet.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{ width: "25%", margin: "0 auto", display: "block" }}
          >
            Close Analytics
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- CREATE NEW YEAR MODAL ---
const NewYearModal = ({ onClose, onRefresh, showToast }) => {
  const currentYear = new Date().getFullYear();
  const [baseYear, setBaseYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(`${currentYear}-07-01`);
  const [endDate, setEndDate] = useState(`${currentYear + 1}-06-30`);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleYearChange = (newBase) => {
    setBaseYear(newBase);
    setStartDate(`${newBase}-07-01`);
    setEndDate(`${newBase + 1}-06-30`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await academicService.createAcademicYear({
        name: `${baseYear}-${baseYear + 1}`,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
      });
      showToast("New Academic Year created!");
      onRefresh();
      onClose();
    } catch (err) {
      showToast("Error creating academic year.", "error");
    } finally {
      setLoading(false);
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
            <h3>Create Academic Year</h3>
            <p className="modal-subtitle">Define a new yearly cycle.</p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="premium-form">
          <div className="input-group">
            <label>Select Academic Year</label>
            <div className="custom-year-stepper">
              <button
                type="button"
                className="stepper-btn"
                onClick={() => handleYearChange(baseYear - 1)}
              >
                <ChevronDown size={20} />
              </button>
              <div className="stepper-display">
                <span className="stepper-main">
                  {baseYear} - {baseYear + 1}
                </span>
              </div>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => handleYearChange(baseYear + 1)}
              >
                <ChevronUp size={20} />
              </button>
            </div>
          </div>

          <div
            className="grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginTop: "1.5rem",
            }}
          >
            <div className="input-group">
              <label>Start Date</label>
              <input
                required
                type="date"
                className="standard-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>End Date</label>
              <input
                required
                type="date"
                className="standard-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div
            className="checkbox-group"
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              id="makeActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="makeActive" style={{ margin: 0 }}>
              Set as Active System Year immediately
            </label>
          </div>

          <div className="modal-actions" style={{ marginTop: "2rem" }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              Create Year
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- EDIT DATES MODAL ---
const EditYearModal = ({ year, onClose, onRefresh, showToast }) => {
  const [startDate, setStartDate] = useState(year.start_date);
  const [endDate, setEndDate] = useState(year.end_date);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFinalSave = async () => {
    setLoading(true);
    try {
      await academicService.updateAcademicYear({
        id: year.id,
        start_date: startDate,
        end_date: endDate,
      });
      showToast("Term dates updated successfully!");
      onRefresh();
      onClose();
    } catch (err) {
      showToast("Error updating dates.", "error");
    } finally {
      setLoading(false);
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
            <h3>Edit Term Dates</h3>
            <p className="modal-subtitle">
              Adjusting schedule for:{" "}
              <strong className="text-primary">{year.name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        {showConfirm ? (
          <div
            className="confirmation-step"
            style={{ padding: "1rem 0", textAlign: "center" }}
          >
            <AlertTriangle
              size={42}
              className="text-warning mx-auto mb-3"
              style={{ margin: "0 auto", display: "block" }}
            />
            <h4 style={{ marginBottom: "10px" }}>Confirm Date Changes?</h4>
            <p className="text-muted text-sm" style={{ marginBottom: "20px" }}>
              Adjusting the term dates might affect attendance calculations and
              report generations that fall outside the new window.
            </p>
            <div
              className="modal-actions"
              style={{ borderTop: "none", justifyContent: "center" }}
            >
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                disabled={loading}
                className="btn-warning"
              >
                {loading ? "Saving..." : "Yes, Update Dates"}
              </button>
            </div>
          </div>
        ) : (
          <div className="premium-form" style={{ marginTop: "1rem" }}>
            <div
              className="grid-2"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="input-group">
                <label>Start Date</label>
                <input
                  required
                  type="date"
                  className="standard-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>End Date</label>
                <input
                  required
                  type="date"
                  className="standard-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: "2rem" }}>
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="btn-primary"
              >
                Review Changes
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AcademicSettings;
