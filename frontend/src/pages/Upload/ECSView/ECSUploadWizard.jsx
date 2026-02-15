import React, { useState, useContext } from "react";
import {
  ChevronUp,
  ChevronDown,
  CloudUpload,
  Users,
  FileText,
  Calendar,
  Receipt,
  Info,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import AuthContext from "../../../context/AuthContext";
import "./ECSUploadWizard.css";

const ECSUploadWizard = () => {
  const { authTokens } = useContext(AuthContext); // Get JWT Token
  const [isDragging, setIsDragging] = useState(false);

  // New States for API Interaction
  const [status, setStatus] = useState("IDLE"); // IDLE, UPLOADING, SUCCESS, ERROR
  const [feedback, setFeedback] = useState(null); // Server response data

  const [context, setContext] = useState({
    category: "STUDENTS",
    startYear: 2025,
    endYear: 2026,
    semester: null,
  });

  const categories = [
    { id: "STUDENTS", label: "Students", icon: Users, color: "#4f46e5" },
    { id: "RESULTS", label: "Results", icon: FileText, color: "#10b981" },
    { id: "ATTENDANCE", label: "Attendance", icon: Calendar, color: "#f59e0b" },
    { id: "FEES", label: "Fees", icon: Receipt, color: "#ef4444" },
  ];

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

  const adjustYear = (amount) => {
    setContext((prev) => ({
      ...prev,
      startYear: prev.startYear + amount,
      endYear: prev.endYear + amount,
    }));
  };

  // --- API LOGIC START ---
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) await processUpload(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processUpload(file);
  };

  const processUpload = async (file) => {
    setStatus("UPLOADING");
    setFeedback(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", context.category);
    formData.append("academic_year", `${context.startYear}-${context.endYear}`);
    if (context.semester) formData.append("semester", context.semester);

    try {
      // Dynamic Endpoint Selection
      let endpoint = "http://127.0.0.1:8000/api/upload/students/";
      if (context.category === "RESULTS")
        endpoint = "http://127.0.0.1:8000/api/upload/results/";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authTokens?.access}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("SUCCESS");
        setFeedback(data);
      } else {
        setStatus("ERROR");
        setFeedback({
          message: data.message || "Upload failed. Check file format.",
        });
      }
    } catch (error) {
      console.error(error);
      setStatus("ERROR");
      setFeedback({ message: "Network Error: Could not reach backend." });
    }
  };
  // --- API LOGIC END ---

  return (
    <div className="ecs-page-container fade-in">
      <div className="ecs-main-layout">
        {/* LEFT: CONFIGURATION PANEL */}
        <div className="ecs-config-side d_glass-panel">
          <div className="config-header">
            <div className="header-icon-bg">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-primary">ECS Injection</h2>
              <p className="text-secondary">Departmental Data Pipeline</p>
            </div>
          </div>

          <div className="config-section">
            <label className="section-label">1. Select Category</label>
            <div className="category-list">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`category-item ${context.category === cat.id ? "active" : ""}`}
                  onClick={() => {
                    setContext({ ...context, category: cat.id });
                    setStatus("IDLE");
                  }}
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
                <span className="year-tag">Session Period</span>
                <span className="year-value">
                  {context.startYear} — {context.endYear}
                </span>
              </div>
              <div className="year-stepper-engine">
                <button className="step-btn up" onClick={() => adjustYear(1)}>
                  <ChevronUp size={20} />
                </button>
                <div className="step-divider" />
                <button
                  className="step-btn down"
                  onClick={() => adjustYear(-1)}
                >
                  <ChevronDown size={20} />
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

        {/* RIGHT: ACTION ZONE (Dynamic States) */}
        <div className="ecs-upload-side">
          {/* STATE: IDLE */}
          {status === "IDLE" && (
            <div
              className={`compact-glass-dropzone d_glass-panel ${isDragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="dropzone-core">
                <div className="visual-feedback">
                  <div className="glow-effect"></div>
                  <CloudUpload size={54} className="main-upload-icon" />
                </div>

                <div className="selection-preview">
                  <h3>{context.category} Module</h3>
                  <div className="preview-badges">
                    <span className="badge-outline">
                      {context.startYear}-{context.endYear}
                    </span>
                    {context.semester && (
                      <span className="badge-solid">S{context.semester}</span>
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
                  onChange={handleFileSelect}
                />
              </div>
              <div className="dropzone-footer">
                <Info size={14} />
                <span>ECS Pre-mapped Pipeline Active</span>
              </div>
            </div>
          )}

          {/* STATE: UPLOADING */}
          {status === "UPLOADING" && (
            <div className="compact-glass-dropzone d_glass-panel">
              <Loader2 size={64} className="animate-spin text-primary" />
              <h3 style={{ marginTop: "20px", color: "var(--text-primary)" }}>
                Injecting Data...
              </h3>
              <p className="text-secondary">Validating against ECS Schema</p>
            </div>
          )}

          {/* STATE: SUCCESS */}
          {status === "SUCCESS" && (
            <div className="compact-glass-dropzone d_glass-panel border-green">
              <CheckCircle size={64} color="#10b981" />
              <h3 className="success-text">Ingestion Complete</h3>
              <div className="stats-box">
                <p>
                  <strong>{feedback?.processed || 0}</strong> Records Processed
                </p>
                {feedback?.errors?.length > 0 ? (
                  <p className="text-warning">
                    {feedback.errors.length} Rows Skipped
                  </p>
                ) : (
                  <p className="text-secondary">No Errors Found</p>
                )}
              </div>
              <button
                className="upload-action-btn"
                onClick={() => setStatus("IDLE")}
              >
                Upload Another
              </button>
            </div>
          )}

          {/* STATE: ERROR */}
          {status === "ERROR" && (
            <div className="compact-glass-dropzone d_glass-panel border-red">
              <XCircle size={64} color="#ef4444" />
              <h3 className="error-text">Upload Failed</h3>
              <p className="error-msg">{feedback?.message}</p>
              <button
                className="upload-action-btn"
                onClick={() => setStatus("IDLE")}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ECSUploadWizard;
