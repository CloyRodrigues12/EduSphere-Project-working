import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { academicService, staffService } from "../services/api";
import {
  CalendarDays, Plus, CheckCircle, AlertTriangle, Check, Edit2,
  ChevronUp, ChevronDown, Info, Users, Layers, Briefcase, BookOpen,
  X, Building2, ShieldAlert, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./AcademicSettings.css";

const AcademicSettings = () => {
  const { refreshContext } = useAcademic();

  const [activeTab, setActiveTab] = useState("years"); 

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (refreshContext) refreshContext(); 
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
      if (refreshContext) refreshContext(); 
    } catch (err) {
      showToast(
        err.response?.data?.error || "Failed to delete department.",
        "error",
      );
    }
  };

  return (
    <div className="academic-settings-scope fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>

      <div className="as-top-toolbar">
        <div className="as-header-stack">
          <h1>
            <ShieldAlert size={28} className="text-primary" style={{ display: "inline", verticalAlign: "bottom", marginRight: "8px" }} />
            Admin Actions
          </h1>
          <p>Master configurations and structure for your institution.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => activeTab === "years" ? setShowCreateModal(true) : setShowDeptModal(true)}
        >
          <Plus size={18} />{" "}
          {activeTab === "years" ? "New Academic Year" : "New Department"}
        </button>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div className="as-tabs-container">
        <button
          className={`as-tab-btn ${activeTab === "years" ? "active" : ""}`}
          onClick={() => setActiveTab("years")}
        >
          <CalendarDays size={18} /> Academic Years
          {activeTab === "years" && <motion.div className="active-tab-indicator" layoutId="asTab" />}
        </button>
        <button
          className={`as-tab-btn ${activeTab === "departments" ? "active" : ""}`}
          onClick={() => setActiveTab("departments")}
        >
          <Building2 size={18} /> Departments
          {activeTab === "departments" && <motion.div className="active-tab-indicator" layoutId="asTab" />}
        </button>
      </div>

      <div className="settings-content">
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1.5rem 0", color: "var(--primary-color)" }}>
            {activeTab === "years" ? <><CalendarDays size={20} /> Registered Academic Years</> : <><Building2 size={20} /> Registered Departments</>}
          </h3>

          {loading ? (
            <div className="spinner" style={{ margin: "2rem auto" }}></div>
          ) : (
            <div className="year-list">
              {/* ACADEMIC YEARS LIST */}
              {activeTab === "years" &&
                academicYears.map((ay) => (
                  <div key={ay.id} className={`year-card ${ay.is_active ? "active-year" : ""}`}>
                    <div className="year-info">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h4 className="year-name">{ay.name}</h4>
                        <button className="btn-icon text-muted" onClick={() => setSummaryTarget(ay)} title="View Year Data Structure">
                          <Info size={16} />
                        </button>
                        <button className="btn-icon text-muted" onClick={() => setEditTarget(ay)} title="Edit Term Dates">
                          <Edit2 size={14} />
                        </button>
                      </div>
                      <span className="year-dates">
                        {new Date(ay.start_date).toLocaleDateString()} — {new Date(ay.end_date).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="year-actions">
                      {ay.is_active ? (
                        <span className="active-badge"><Check size={16} /> System Year</span>
                      ) : (
                        <button className="btn-secondary" onClick={() => setPendingActiveYear(ay)}>
                          Set as Active
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {/* DEPARTMENTS LIST */}
              {activeTab === "departments" &&
                departments.map((dept) => (
                  <div key={dept.id} className="year-card" style={{ borderLeft: "4px solid var(--primary-color)" }}>
                    <div className="year-info">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <h4 className="year-name">{dept.name}</h4>
                      </div>
                      <span className="year-dates text-muted" style={{ display: "inline-block", background: "var(--bg-input)", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontWeight: "bold" }}>
                        Code: {dept.code}
                      </span>
                    </div>

                    <div className="year-actions" style={{ display: "flex", gap: "8px" }}>
                      <button className="btn-icon" onClick={() => { setEditDeptTarget(dept); setShowDeptModal(true); }} title="Edit Department">
                        <Edit2 size={18} />
                      </button>
                      <button className="btn-icon text-danger" onClick={() => handleDeleteDept(dept.id)} title="Delete Department">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

              {/* EMPTY STATES */}
              {activeTab === "years" && academicYears.length === 0 && (
                <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No academic years found.</p>
              )}
              {activeTab === "departments" && departments.length === 0 && (
                <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No departments found.</p>
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
              style={{ textAlign: "center", padding: "2rem" }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem", color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", width: "64px", height: "64px", borderRadius: "50%", alignItems: "center", margin: "0 auto 1.5rem auto" }}>
                <AlertTriangle size={32} />
              </div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Update System Database?</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: "1.5" }}>
                You are about to make <strong>{pendingActiveYear.name}</strong>{" "}
                the official active year. This will globally lock old data and
                affect where new data is written.
              </p>
              <div className="modal-actions" style={{ justifyContent: "center", borderTop: "none", padding: 0 }}>
                <button className="btn-secondary" onClick={() => setPendingActiveYear(null)}>Cancel</button>
                <button className="btn-warning" onClick={confirmSetActive}>Confirm System Update</button>
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
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form">
            <div className="input-group">
              <label>Department Name</label>
              <input type="text" className="standard-input" required placeholder="e.g. Computer Science" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginTop: "1rem" }}>
              <label>Department Code</label>
              <input type="text" className="standard-input" required placeholder="e.g. COMP" value={code} onChange={(e) => setCode(e.target.value)} />
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>Keep it short, e.g. IT, MECH, ECS.</p>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
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

  useEffect(() => {
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3>Database Analytics Report</h3>
            <p className="modal-subtitle">
              System data linked to: <strong className="text-primary">{year.name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        {loading || !stats ? (
          <div className="spinner" style={{ margin: "3rem auto" }}></div>
        ) : (
          <div className="premium-form">
            <div className="as-stats-grid">
              <div className="glass-panel" style={{ padding: "1.5rem", textAlign: "center" }}>
                <Users size={24} className="text-primary" style={{ margin: "0 auto 8px auto" }} />
                <h2 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>{stats.total_students}</h2>
                <span className="text-muted text-sm">Total Students</span>
              </div>
              <div className="glass-panel" style={{ padding: "1.5rem", textAlign: "center" }}>
                <BookOpen size={24} className="text-warning" style={{ margin: "0 auto 8px auto" }} />
                <h2 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>{stats.total_allocations}</h2>
                <span className="text-muted text-sm">Total Classes Assigned</span>
              </div>
            </div>

            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 10px 0", color: "var(--primary-color)" }}>
              <Layers size={18} /> Batches Created ({stats.total_batches} Total)
            </h4>
            <div className="glass-panel" style={{ padding: "15px", marginBottom: "1.5rem", background: "var(--bg-input)", border: "none" }}>
              {stats.semester_breakdown.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {stats.semester_breakdown.map((sem, idx) => (
                    <div key={idx} style={{ background: "var(--bg-card)", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                      <strong>Sem {sem.semester}:</strong> {sem.batch_count} Batches
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm" style={{ margin: 0 }}>No batches created for this year yet.</p>
              )}
            </div>

            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 10px 0", color: "var(--primary-color)" }}>
              <Briefcase size={18} /> Faculty Workload Assignments
            </h4>
            <div className="glass-panel" style={{ padding: "10px", background: "var(--bg-input)", border: "none" }}>
              {stats.faculty_workload.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {stats.faculty_workload.map((fac, idx) => (
                    <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 15px", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        Prof. {fac.faculty__user__first_name} {fac.faculty__user__last_name}
                      </span>
                      <span className="badge" style={{ background: "var(--primary-color)", color: "white" }}>
                        {fac.class_count} Classes
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm" style={{ margin: "5px" }}>No subjects allocated to faculty yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn-primary" style={{ width: "100%" }}>Close Analytics</button>
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
  
  const [oddStartDate, setOddStartDate] = useState(`${currentYear}-07-01`);
  const [oddEndDate, setOddEndDate] = useState(`${currentYear}-12-15`);
  const [evenStartDate, setEvenStartDate] = useState(`${currentYear + 1}-01-01`);
  const [evenEndDate, setEvenEndDate] = useState(`${currentYear + 1}-05-15`);
  
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleYearChange = (newBase) => {
    setBaseYear(newBase);
    setStartDate(`${newBase}-07-01`);
    setEndDate(`${newBase + 1}-06-30`);
    setOddStartDate(`${newBase}-07-01`);
    setOddEndDate(`${newBase}-12-15`);
    setEvenStartDate(`${newBase + 1}-01-01`);
    setEvenEndDate(`${newBase + 1}-05-15`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await academicService.createAcademicYear({
        name: `${baseYear}-${baseYear + 1}`,
        start_date: startDate,
        end_date: endDate,
        odd_term_start_date: oddStartDate,
        odd_term_end_date: oddEndDate,
        even_term_start_date: evenStartDate,
        even_term_end_date: evenEndDate,
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
        className="modal-content premium-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3>Create Academic Year</h3>
            <p className="modal-subtitle">Define a new yearly cycle.</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="premium-form">
            <div className="input-group">
              <label>Select Academic Year</label>
              <div className="custom-year-stepper">
                <button type="button" className="stepper-btn" onClick={() => handleYearChange(baseYear - 1)}>
                  <ChevronDown size={20} />
                </button>
                <div className="stepper-display">
                  <span className="stepper-main">{baseYear} - {baseYear + 1}</span>
                </div>
                <button type="button" className="stepper-btn" onClick={() => handleYearChange(baseYear + 1)}>
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            <div className="as-grid-2" style={{ marginTop: "1rem" }}>
              <div className="input-group">
                <label>Year Start Date</label>
                <input required type="date" className="standard-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Year End Date</label>
                <input required type="date" className="standard-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div style={{ margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Odd Term Dates</h4>
            
            <div className="as-grid-2">
              <div className="input-group">
                <label>Odd Term Start</label>
                <input type="date" className="standard-input" value={oddStartDate} onChange={(e) => setOddStartDate(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Odd Term End</label>
                <input type="date" className="standard-input" value={oddEndDate} onChange={(e) => setOddEndDate(e.target.value)} />
              </div>
            </div>

            <div style={{ margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Even Term Dates</h4>

            <div className="as-grid-2">
              <div className="input-group">
                <label>Even Term Start</label>
                <input type="date" className="standard-input" value={evenStartDate} onChange={(e) => setEvenStartDate(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Even Term End</label>
                <input type="date" className="standard-input" value={evenEndDate} onChange={(e) => setEvenEndDate(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "10px", alignItems: "center" }}>
              <input type="checkbox" id="makeActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: "20px", height: "20px" }} />
              <label htmlFor="makeActive" style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>Set as Active System Year immediately</label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">Create Year</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- EDIT DATES MODAL ---
const EditYearModal = ({ year, onClose, onRefresh, showToast }) => {
  const [startDate, setStartDate] = useState(year.start_date || "");
  const [endDate, setEndDate] = useState(year.end_date || "");
  const [oddStartDate, setOddStartDate] = useState(year.odd_term_start_date || "");
  const [oddEndDate, setOddEndDate] = useState(year.odd_term_end_date || "");
  const [evenStartDate, setEvenStartDate] = useState(year.even_term_start_date || "");
  const [evenEndDate, setEvenEndDate] = useState(year.even_term_end_date || "");

  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFinalSave = async () => {
    setLoading(true);
    try {
      await academicService.updateAcademicYear({
        id: year.id,
        start_date: startDate,
        end_date: endDate,
        odd_term_start_date: oddStartDate || null,
        odd_term_end_date: oddEndDate || null,
        even_term_start_date: evenStartDate || null,
        even_term_end_date: evenEndDate || null,
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
        className="modal-content premium-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header">
          <div>
            <h3>Edit Term Dates</h3>
            <p className="modal-subtitle">Adjusting schedule for: <strong className="text-primary">{year.name}</strong></p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        {showConfirm ? (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <AlertTriangle size={48} className="text-warning" style={{ margin: "0 auto 1rem auto", display: "block" }} />
            <h3 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>Confirm Date Changes?</h3>
            <p className="text-muted" style={{ marginBottom: "2rem" }}>
              Adjusting the term dates might affect attendance calculations and report generations that fall outside the new window.
            </p>
            <div className="modal-actions" style={{ borderTop: "none", padding: 0 }}>
              <button type="button" onClick={() => setShowConfirm(false)} className="btn-secondary">Go Back</button>
              <button type="button" onClick={handleFinalSave} disabled={loading} className="btn-warning">
                {loading ? "Saving..." : "Yes, Update Dates"}
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-form">
            <div className="premium-form">
              
              <div className="as-grid-2">
                <div className="input-group">
                  <label>Year Start Date</label>
                  <input required type="date" className="standard-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Year End Date</label>
                  <input required type="date" className="standard-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div style={{ margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Odd Term Dates</h4>
              
              <div className="as-grid-2">
                <div className="input-group">
                  <label>Odd Term Start</label>
                  <input type="date" className="standard-input" value={oddStartDate} onChange={(e) => setOddStartDate(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Odd Term End</label>
                  <input type="date" className="standard-input" value={oddEndDate} onChange={(e) => setOddEndDate(e.target.value)} />
                </div>
              </div>

              <div style={{ margin: '1rem 0', borderTop: '1px solid var(--border-color)' }}></div>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Even Term Dates</h4>

              <div className="as-grid-2">
                <div className="input-group">
                  <label>Even Term Start</label>
                  <input type="date" className="standard-input" value={evenStartDate} onChange={(e) => setEvenStartDate(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Even Term End</label>
                  <input type="date" className="standard-input" value={evenEndDate} onChange={(e) => setEvenEndDate(e.target.value)} />
                </div>
              </div>

            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="button" onClick={() => setShowConfirm(true)} className="btn-primary">Review Changes</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AcademicSettings;