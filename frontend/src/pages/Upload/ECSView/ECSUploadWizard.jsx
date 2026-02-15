import React, { useState } from "react";
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
} from "lucide-react";
import "./ECSUploadWizard.css";

const ECSUploadWizard = () => {
  const [isDragging, setIsDragging] = useState(false);
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
    return labels[Math.floor((sem - 1) / 2)];
  };

  const adjustYear = (amount) => {
    setContext((prev) => ({
      ...prev,
      startYear: prev.startYear + amount,
      endYear: prev.endYear + amount,
    }));
  };

  return (
    <div className="ecs-page-container fade-in">
      <div className="ecs-main-layout">
        {/* LEFT: CONFIGURATION PANEL (420px) */}
        <div className="ecs-config-side d_glass-panel">
          <div className="config-header">
            <div className="header-icon-bg">
              <Sparkles size={18} />
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
                  onClick={() => setContext({ ...context, category: cat.id })}
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
                  <ChevronUp size={15} />
                </button>
                <div className="step-divider" />
                <button
                  className="step-btn down"
                  onClick={() => adjustYear(-1)}
                >
                  <ChevronDown size={15} />
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

        {/* RIGHT: COMPACT UPLOAD AREA */}
        <div className="ecs-upload-side">
          <div
            className={`compact-glass-dropzone d_glass-panel ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
          >
            <div className="dropzone-core">
              <div className="visual-feedback">
                <CloudUpload size={52} className="main-upload-icon" />
              </div>

              {/* 🔹 Dynamic context preview INSIDE card */}
              <div className="dropzone-context">
                <span className="context-chip">{context.category}</span>
                <span className="context-chip">
                  {context.startYear}-{context.endYear}
                </span>
                {context.semester && (
                  <span className="context-chip solid">
                    Sem {context.semester}
                  </span>
                )}
              </div>

              <p className="upload-text">Drag & Drop your Excel file here</p>

              <label htmlFor="file-input" className="upload-action-btn">
                Browse Files
              </label>
              <input type="file" id="file-input" hidden />

              <span className="upload-hint">Supports .xls, .xlsx</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ECSUploadWizard;
