import React, { useState } from "react";
import {
  CloudUpload,
  Users,
  FileText,
  Calendar,
  Receipt,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Table,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import "./ECSUploadWizard.css";

const ECSUploadWizard = () => {
  // --- STATE MANAGEMENT ---
  const [step, setStep] = useState("IDLE");
  const [context, setContext] = useState({
    category: "STUDENTS",
    startYear: 2025,
    endYear: 2026,
    semester: null,
  });
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [commitError, setCommitError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // UI States
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPartialConfirmation, setShowPartialConfirmation] = useState(false);

  const categories = [
    { id: "STUDENTS", label: "Students", icon: Users, color: "#4f46e5" },
    { id: "RESULTS", label: "Results", icon: FileText, color: "#10b981" },
    { id: "ATTENDANCE", label: "Attendance", icon: Calendar, color: "#f59e0b" },
    { id: "FEES", label: "Fees", icon: Receipt, color: "#ef4444" },
  ];

  const adjustYear = (amount) => {
    setContext((prev) => ({
      ...prev,
      startYear: prev.startYear + amount,
      endYear: prev.endYear + amount,
    }));
  };

  const getYearLabel = (sem) => {
    if (!sem) return "Academic Level";
    const labels = [
      "First Year (FE)",
      "Second Year (SE)",
      "Third Year (TE)",
      "Fourth Year (BE)",
    ];
    return labels[Math.floor((sem - 1) / 2)] || "Unknown";
  };

  const handleCategorySelect = (catId) => {
    setContext((prev) => ({
      ...prev,
      category: catId,
      semester: catId === "STUDENTS" ? null : prev.semester,
    }));
    setStep("IDLE");
    setFile(null);
    setReport(null);
    setDuplicateWarning(false);
    setCommitError(null);
  };

  // --- API HANDLERS ---
  const getToken = () => localStorage.getItem("access_token");
  const getBaseUrl = () =>
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    await checkDuplicate(selectedFile);
  };

  const checkDuplicate = async (fileObj) => {
    setStep("CHECKING");
    try {
      const res = await fetch(`${getBaseUrl()}/api/upload/check-duplicate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        // FIX: Now sending the Academic Year so the backend checks the right bucket
        body: JSON.stringify({
          filename: fileObj.name,
          academic_year: `${context.startYear}-${context.endYear}`,
        }),
      });
      const data = await res.json();

      if (data.exists) {
        setDuplicateWarning(true);
      } else {
        await fetchPreview(fileObj);
      }
    } catch (err) {
      console.error(err);
      setStep("ERROR");
      setReport({ error: "Could not connect to server." });
    }
  };

  const fetchPreview = async (fileObj) => {
    const activeFile = fileObj || file;
    if (!activeFile) return;

    setStep("PREVIEW_LOADING");
    setDuplicateWarning(false);
    setIsExpanded(false);
    setShowPartialConfirmation(false);

    const formData = new FormData();
    formData.append("file", activeFile);
    formData.append("category", context.category);
    // FIX: Send Context Data to backend
    formData.append("academic_year", `${context.startYear}-${context.endYear}`);
    if (context.semester) formData.append("semester", context.semester);

    try {
      const res = await fetch(`${getBaseUrl()}/api/upload/preview/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setReport(data);
        setStep("PREVIEW");
      } else {
        setReport({ error: data.errors || "Schema validation failed" });
        setStep("ERROR");
      }
    } catch (err) {
      setStep("ERROR");
      setReport({ error: "Network Error during preview generation." });
    }
  };

  const commitUpload = async (mode) => {
    if (!report?.log_id) return;
    setStep("COMMITTING");
    setCommitError(null);

    try {
      const res = await fetch(`${getBaseUrl()}/api/upload/commit/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          log_id: report.log_id,
          mode: mode,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStep("SUCCESS");
        setReport(null);
      } else {
        setCommitError(data.message);
        setStep("PREVIEW");
      }
    } catch (err) {
      setCommitError("Network Error: Failed to commit data.");
      setStep("PREVIEW");
    }
  };

  // --- DRAG & DROP HANDLERS ---
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) await handleFileSelect(files[0]);
  };

  const getPreviewRows = () => {
    if (!report?.preview_data) return [];
    if (isExpanded) return report.preview_data;
    return report.preview_data.slice(0, 5);
  };

  // --- CONFIRMATION MODAL ---
  const renderPartialConfirmationModal = () => (
    <div className="modal-overlay fade-in" style={{ zIndex: 1100 }}>
      <div
        className="modal-content glass-panel"
        style={{ width: "500px", height: "auto" }}
      >
        <div
          className="modal-header"
          style={{ borderBottom: "none", paddingBottom: 0 }}
        >
          <h3 className="text-warning">
            <AlertTriangle size={22} /> Confirm Partial Upload
          </h3>
        </div>

        <div
          className="modal-scroll-area"
          style={{ overflow: "visible", padding: "1.5rem" }}
        >
          <p
            style={{
              fontSize: "1rem",
              marginBottom: "1.5rem",
              color: "var(--text-primary)",
            }}
          >
            You are about to insert{" "}
            <strong>{report.summary.valid_count}</strong> valid records into the
            database.
          </p>

          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h4
              style={{
                color: "#ef4444",
                margin: "0 0 0.5rem 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.95rem",
              }}
            >
              <XCircle size={18} /> {report.summary.error_count} Records will be
              SKIPPED
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              These rows failed validation and will <strong>NOT</strong> be
              saved. You can correct them in Excel and upload them later.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={() => setShowPartialConfirmation(false)}
          >
            Go Back
          </button>
          <button
            className="btn-warning"
            onClick={() => {
              setShowPartialConfirmation(false);
              commitUpload("PARTIAL");
            }}
          >
            Yes, Commit Partial Data
          </button>
        </div>
      </div>
    </div>
  );

  // --- PREVIEW MODAL ---
  const renderPreviewModal = () => (
    <div className="modal-overlay fade-in">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h3>
            <Sparkles size={18} className="text-primary" /> Data Verification
          </h3>
          <button className="close-btn" onClick={() => setStep("IDLE")}>
            <X size={20} />
          </button>
        </div>

        <div className="report-summary">
          <div className="stat-box valid">
            <span className="stat-val">{report.summary.valid_count}</span>
            <span className="stat-label">Valid Rows</span>
          </div>
          <div className="stat-box error">
            <span className="stat-val">{report.summary.error_count}</span>
            <span className="stat-label">Errors</span>
          </div>
          <div className="stat-box total">
            <span className="stat-val">{report.summary.total_rows}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>

        {commitError && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{commitError}</span>
          </div>
        )}

        <div className="modal-scroll-area">
          <div className="table-wrapper">
            <div className="table-header-row">
              <h4 className="table-title">
                <Table size={16} className="text-primary" /> Valid Data Preview
              </h4>
              <button
                className="expand-btn"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {isExpanded ? " Collapse" : " View All Rows"}
              </button>
            </div>

            <div
              className="table-scroll"
              style={{ maxHeight: isExpanded ? "400px" : "auto" }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    {report.preview_data?.length > 0 &&
                      Object.keys(report.preview_data[0]).map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {getPreviewRows().map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report.error_report?.length > 0 && (
            <div className="error-table-wrapper">
              <h4 className="table-title error">
                <AlertTriangle size={16} /> Issues Found
              </h4>
              <table className="error-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Issue</th>
                    <th>Data Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {report.error_report.map((err, idx) => (
                    <tr key={idx}>
                      {/* FIX: Crash prevented here by matching backend property names */}
                      <td>#{err.row || err.row_index}</td>
                      <td className="text-red">
                        {err.error ||
                          (err.reasons && err.reasons.join(", ")) ||
                          "Unknown Error"}
                      </td>
                      <td className="text-mono">
                        {err.data && Object.values(err.data).length > 0
                          ? Object.values(err.data)[0]
                          : "N/A"}
                        ...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setStep("IDLE")}>
            Cancel
          </button>
          {report.summary.error_count > 0 ? (
            <button
              className="btn-warning"
              onClick={() => setShowPartialConfirmation(true)}
            >
              Proceed with Partial <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => commitUpload("FULL")}
            >
              Commit All Records <CheckCircle size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="ecs-page-container fade-in">
      <div className="ecs-main-layout">
        {/* LEFT: CONFIGURATION */}
        <div className="ecs-config-side d_glass-panel">
          <div className="config-header">
            <div className="header-icon-bg">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-primary">Data Injection</h2>
            </div>
          </div>

          <div className="config-section">
            <label className="section-label">1. Select Category</label>
            <div className="category-list">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`category-item ${context.category === cat.id ? "active" : ""}`}
                  onClick={() => handleCategorySelect(cat.id)}
                  style={{ "--item-color": cat.color }}
                >
                  <div className="cat-icon-box">
                    <cat.icon size={20} />
                  </div>
                  <span className="cat-label">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="config-section">
            <label className="section-label">2. Academic Year</label>
            <div className="elegant-year-card">
              <div className="year-info">
                <span className="year-value">
                  {context.startYear} — {context.endYear}
                </span>
              </div>
              <div className="year-stepper-engine">
                <button className="step-btn up" onClick={() => adjustYear(1)}>
                  ▲
                </button>
                <div className="step-divider" />
                <button
                  className="step-btn down"
                  onClick={() => adjustYear(-1)}
                >
                  ▼
                </button>
              </div>
            </div>
          </div>

          {context.category !== "STUDENTS" && (
            <div className="config-section animate-slide-up">
              <div className="sem-header">
                <label className="section-label">3. Semester</label>
                <span className="level-indicator">
                  {getYearLabel(context.semester)}
                </span>
              </div>
              <div className="semester-modern-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <button
                    key={s}
                    className={`sem-pill ${context.semester === s ? "active" : ""}`}
                    onClick={() => setContext({ ...context, semester: s })}
                  >
                    Sem {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: ACTION ZONE */}
        <div className="ecs-upload-side">
          {duplicateWarning ? (
            <div className="compact-glass-dropzone d_glass-panel border-warning fade-in">
              <AlertTriangle size={64} className="text-warning" />
              <h3>Duplicate File Detected</h3>
              <p
                className="text-secondary text-center"
                style={{ maxWidth: "300px" }}
              >
                "{file?.name}" has been uploaded before for {context.startYear}-
                {context.endYear}. Do you want to process it again?
              </p>
              <div className="action-row">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setDuplicateWarning(false);
                    setStep("IDLE");
                    setFile(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-warning"
                  onClick={() => fetchPreview(file)}
                >
                  Proceed Anyway
                </button>
              </div>
            </div>
          ) : step === "SUCCESS" ? (
            <div className="compact-glass-dropzone d_glass-panel border-green">
              <CheckCircle size={64} className="text-success" />
              <h3>Ingestion Complete</h3>
              <p>Data successfully merged into Master Records.</p>
              <button
                className="upload-action-btn"
                onClick={() => setStep("IDLE")}
              >
                Upload Another
              </button>
            </div>
          ) : step === "ERROR" ? (
            <div className="compact-glass-dropzone d_glass-panel border-red">
              <XCircle size={64} className="text-error" />
              <h3>Upload Failed</h3>
              <p className="error-msg">
                {report?.error || "An unexpected error occurred."}
              </p>
              <button
                className="upload-action-btn"
                onClick={() => setStep("IDLE")}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div
              className={`compact-glass-dropzone d_glass-panel ${isDragging ? "dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="dropzone-core">
                {step === "CHECKING" ||
                step === "PREVIEW_LOADING" ||
                step === "COMMITTING" ? (
                  <>
                    <Loader2 size={54} className="animate-spin text-primary" />
                    <h3 style={{ marginTop: "15px" }}>Processing...</h3>
                    <p className="text-secondary">
                      {step === "CHECKING" && "Checking for duplicates..."}
                      {step === "PREVIEW_LOADING" && "Validating Schema..."}
                      {step === "COMMITTING" && "Saving Data..."}
                    </p>
                  </>
                ) : (
                  <>
                    <CloudUpload size={54} className="main-upload-icon" />
                    <div className="selection-preview">
                      <h3>{context.category} Ingestion</h3>
                      <div className="preview-badges">
                        <span className="badge-outline">
                          {
                            categories.find((c) => c.id === context.category)
                              ?.label
                          }
                        </span>
                        <span className="badge-outline">
                          {context.startYear}-{context.endYear}
                        </span>
                        {context.semester && (
                          <span className="badge-solid">
                            S{context.semester}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="upload-text text-secondary">
                      Drag & Drop your Excel file here
                    </p>
                    <label htmlFor="file-input" className="upload-action-btn">
                      Browse Files
                    </label>
                    <input
                      type="file"
                      id="file-input"
                      hidden
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {step === "PREVIEW" && report && renderPreviewModal()}
      {showPartialConfirmation && renderPartialConfirmationModal()}
    </div>
  );
};

export default ECSUploadWizard;
