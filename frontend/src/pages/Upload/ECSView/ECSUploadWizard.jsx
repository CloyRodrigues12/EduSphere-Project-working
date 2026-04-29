import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { staffService } from "../../../services/api";
import {
  CloudUpload, Users, Receipt, Sparkles, Loader2, CheckCircle,
  XCircle, AlertTriangle, ArrowRight, Table, X, Maximize2,
  Minimize2, Info, Download, FileText, MonitorSmartphone
} from "lucide-react";
import "./ECSUploadWizard.css";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { motion, AnimatePresence } from "framer-motion";

const ECSUploadWizard = () => {
  const { user } = useAuth();
  const isHOD = user?.role_code === "HOD";

  // --- STATE MANAGEMENT ---
  const [step, setStep] = useState("IDLE");
  const [departments, setDepartments] = useState([]);
  
  const [context, setContext] = useState({
    category: "STUDENTS",
    department_id: null,
    startYear: 2025,
    endYear: 2026,
    semester: 1, 
  });
  
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [commitError, setCommitError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showPartialConfirmation, setShowPartialConfirmation] = useState(false);
  
  // --- DYNAMIC SCHEMA STATE ---
  const [showSchemaInfo, setShowSchemaInfo] = useState(false);
  const [schemaData, setSchemaData] = useState({ mandatory: [], optional: [] });
  const [loadingSchema, setLoadingSchema] = useState(false);

  // --- MOBILE DETECTION LOGIC ---
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePopupDismissed, setMobilePopupDismissed] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 850);
    handleResize(); // Check immediately on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const categories = [
    { id: "STUDENTS", label: "Students", icon: Users, color: "#4f46e5" },
    { id: "FEES", label: "Fees", icon: Receipt, color: "#ef4444" },
  ];

  const getToken = () => localStorage.getItem("access_token");
  const getBaseUrl = () => import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // Fetch Departments on Mount
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await staffService.getDepartments();
        setDepartments(res.data);
        if (isHOD && user.department_id) setContext((prev) => ({ ...prev, department_id: user.department_id }));
        else if (res.data.length > 0) setContext((prev) => ({ ...prev, department_id: res.data[0].id }));
      } catch (err) { console.error("Failed to load departments", err); }
    };
    fetchDepts();
  }, [isHOD, user]);

  // Fetch Dynamic Schema when Category changes
  useEffect(() => {
    const fetchSchema = async () => {
      setLoadingSchema(true);
      try {
        const res = await axios.get(`${getBaseUrl()}/api/upload/schema/?category=${context.category}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        setSchemaData(res.data);
      } catch (err) {
        console.error("Failed to fetch schema", err);
        setSchemaData({ mandatory: ["ROLL NO", "NAME"], optional: [] });
      } finally {
        setLoadingSchema(false);
      }
    };
    fetchSchema();
  }, [context.category]);

  const adjustYear = (amount) => setContext((prev) => ({ ...prev, startYear: prev.startYear + amount, endYear: prev.endYear + amount }));
  const getYearLabel = (sem) => {
    if (!sem) return "Academic Level";
    const labels = ["First Year (FE)", "Second Year (SE)", "Third Year (TE)", "Fourth Year (BE)"];
    return labels[Math.floor((sem - 1) / 2)] || "Unknown";
  };

  const handleCategorySelect = (catId) => {
    setContext((prev) => ({ ...prev, category: catId, semester: catId === "STUDENTS" ? 1 : prev.semester }));
    setStep("IDLE"); setFile(null); setReport(null); setDuplicateWarning(false); setCommitError(null);
  };

  // --- NATIVE EXCEL (.XLSX) GENERATION ---
  const handleDownloadSample = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${context.category} Template`);

    const mandatoryHeaders = schemaData.mandatory || [];
    const optionalHeaders = schemaData.optional || [];
    const allHeaders = [...mandatoryHeaders, ...optionalHeaders];

    const headerRow = worksheet.addRow(allHeaders);
    headerRow.height = 25; 

    allHeaders.forEach((headerText, index) => {
      const cell = headerRow.getCell(index + 1);
      const isMandatory = index < mandatoryHeaders.length;

      cell.font = { bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isMandatory ? 'FFB0BEC5' : 'FFECEFF1' } 
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        right: { style: 'thin', color: { argb: 'FF9E9E9E' } }
      };

      const column = worksheet.getColumn(index + 1);
      column.width = Math.max(20, headerText.length + 5);
    });

    worksheet.addRow([]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `EduSphere_${context.category.toLowerCase()}_template.xlsx`);
  };

  // --- API HANDLERS ---
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ filename: fileObj.name, academic_year: `${context.startYear}-${context.endYear}` }),
      });
      const data = await res.json();
      if (data.exists) setDuplicateWarning(true);
      else await fetchPreview(fileObj);
    } catch (err) { setStep("ERROR"); setReport({ error: "Could not connect to server." }); }
  };

  const fetchPreview = async (fileObj) => {
    const activeFile = fileObj || file;
    if (!activeFile) return;
    setStep("PREVIEW_LOADING"); setDuplicateWarning(false); setIsExpanded(false); setShowPartialConfirmation(false);

    const formData = new FormData();
    formData.append("file", activeFile);
    formData.append("category", context.category);
    formData.append("academic_year", `${context.startYear}-${context.endYear}`);
    if (context.semester) formData.append("semester", context.semester);

    try {
      const res = await fetch(`${getBaseUrl()}/api/upload/preview/`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
      const data = await res.json();
      if (res.ok) { setReport(data); setStep("PREVIEW"); } 
      else { setReport({ error: data.errors || "Schema validation failed" }); setStep("ERROR"); }
    } catch (err) { setStep("ERROR"); setReport({ error: "Network Error during preview generation." }); }
  };

  const commitUpload = async (mode) => {
    if (!report?.log_id) return;
    setStep("COMMITTING"); setCommitError(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/upload/commit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ log_id: report.log_id, mode: mode, department_id: context.department_id, semester: context.semester }),
      });
      const data = await res.json();
      if (res.ok) { setStep("SUCCESS"); setReport(null); } 
      else { setCommitError(data.message); setStep("PREVIEW"); }
    } catch (err) { setCommitError("Network Error: Failed to commit data."); setStep("PREVIEW"); }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = async (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const files = e.dataTransfer.files; if (files && files.length > 0) await handleFileSelect(files[0]); };

  const getPreviewRows = () => {
    if (!report?.preview_data) return [];
    if (isExpanded) return report.preview_data;
    return report.preview_data.slice(0, 5);
  };

  // --- MODALS ---
  const renderSchemaModal = () => {
    return (
      // 🚨 Added .center-mobile to fix clipping on small devices
      <div className="modal-overlay center-mobile fade-in" style={{ zIndex: 1200 }} onClick={(e) => { e.stopPropagation(); setShowSchemaInfo(false); }}>
        <div className="modal-content small-modal glass-panel" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-primary)' }}>
              <FileText size={20} className="text-primary"/> Data Schema Requirements
            </h3>
            <button className="close-btn" onClick={() => setShowSchemaInfo(false)}><X size={20}/></button>
          </div>
          
          <div className="modal-scroll-area">
            {loadingSchema ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-primary" size={32}/></div>
            ) : (
              <>
                <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  To successfully ingest <strong>{context.category}</strong> data, your Excel file must contain these exact column headers in the very first row.
                </p>

                {/* Mandatory Fields */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></div>
                    Mandatory Columns
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {schemaData.mandatory.map(f => (
                      <span key={f} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', fontFamily: 'monospace' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Optional Fields */}
                {schemaData.optional.length > 0 && (
                  <div>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                      Optional Columns
                    </h4>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Include these columns to automatically populate the supplementary profile dashboard.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {schemaData.optional.map(f => (
                        <span key={f} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', fontFamily: 'monospace' }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-primary" onClick={handleDownloadSample}>
              <Download size={18} /> Download Excel Template
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPartialConfirmationModal = () => (
    // 🚨 Added .center-mobile to fix clipping on small devices
    <div className="modal-overlay center-mobile fade-in" style={{ zIndex: 1100 }}>
      <div className="modal-content small-modal glass-panel">
        <div className="modal-header" style={{ borderBottom: "none", paddingBottom: 0 }}><h3 className="text-warning"><AlertTriangle size={22} /> Confirm Partial Upload</h3></div>
        <div className="modal-scroll-area" style={{ overflow: "visible" }}>
          <p style={{ fontSize: "1rem", marginBottom: "1.5rem", color: "var(--text-primary)" }}>You are about to insert <strong>{report.summary.valid_count}</strong> valid records into the database.</p>
          <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", padding: "1rem", marginBottom: "1rem" }}>
            <h4 style={{ color: "#ef4444", margin: "0 0 0.5rem 0", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem" }}><XCircle size={18} /> {report.summary.error_count} Records will be SKIPPED</h4>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>These rows failed validation and will <strong>NOT</strong> be saved. You can correct them in Excel and upload them later.</p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowPartialConfirmation(false)}>Go Back</button>
          <button className="btn-warning" onClick={() => { setShowPartialConfirmation(false); commitUpload("PARTIAL"); }}>Yes, Commit Partial Data</button>
        </div>
      </div>
    </div>
  );

  const renderPreviewModal = () => (
    <div className="modal-overlay fade-in">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h3><Sparkles size={18} className="text-primary" /> Data Verification</h3>
          <button className="close-btn" onClick={() => setStep("IDLE")}><X size={20} /></button>
        </div>

        <div className="report-summary" style={{ marginTop: "1rem" }}>
          <div className="stat-box valid"><span className="stat-val">{report.summary.valid_count}</span><span className="stat-label">Valid Rows</span></div>
          <div className="stat-box error"><span className="stat-val">{report.summary.error_count}</span><span className="stat-label">Errors</span></div>
          <div className="stat-box total"><span className="stat-val">{report.summary.total_rows}</span><span className="stat-label">Total</span></div>
        </div>

        {commitError && <div className="error-banner" style={{ margin: "0 1.5rem 1rem 1.5rem" }}><AlertTriangle size={18} /><span>{commitError}</span></div>}

        <div className="modal-scroll-area" style={{ paddingTop: 0 }}>
          <div className="table-wrapper">
            <div className="table-header-row">
              <h4 className="table-title"><Table size={16} className="text-primary" /> Valid Data Preview</h4>
              <button className="expand-btn" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />} <span className="desktop-only">{isExpanded ? "Collapse" : "View All"}</span>
              </button>
            </div>
            <div className="table-scroll" style={{ maxHeight: isExpanded ? "400px" : "auto" }}>
              <table className="data-table">
                <thead><tr>{report.preview_data?.length > 0 && Object.keys(report.preview_data[0]).map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>{getPreviewRows().map((row, idx) => (<tr key={idx}>{Object.values(row).map((val, cIdx) => <td key={cIdx}>{val}</td>)}</tr>))}</tbody>
              </table>
            </div>
          </div>

          {report.error_report?.length > 0 && (
            <div className="error-table-wrapper">
              <h4 className="table-title error"><AlertTriangle size={16} /> Issues Found</h4>
              <table className="error-table">
                <thead><tr><th>Row</th><th>Issue</th><th>Data Preview</th></tr></thead>
                <tbody>
                  {report.error_report.map((err, idx) => (
                    <tr key={idx}>
                      <td>#{err.row || err.row_index}</td>
                      <td className="text-red">{err.error || (err.reasons && err.reasons.join(", ")) || "Unknown Error"}</td>
                      <td className="text-mono">{err.data && Object.values(err.data).length > 0 ? Object.values(err.data)[0] : "N/A"}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setStep("IDLE")}>Cancel</button>
          {report.summary.error_count > 0 ? (
            <button className="btn-warning" onClick={() => setShowPartialConfirmation(true)}>Proceed with Partial <ArrowRight size={16} /></button>
          ) : (
            <button className="btn-primary" onClick={() => commitUpload("FULL")}>Commit All Records <CheckCircle size={16} /></button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="ecs-page-container fade-in">

      {/* 🚨 MOBILE BANNER: Only visible on mobile CSS breakpoint */}
      <div className="mobile-desktop-warning">
          <MonitorSmartphone size={24} />
          <span>For maximum efficiency and data safety, Excel ingestion is best performed on a Desktop device.</span>
      </div>

      <div className="ecs-main-layout">
        
        {/* LEFT: CONFIGURATION */}
        <div className="ecs-config-side d_glass-panel">
          <div className="config-header">
            <div className="header-icon-bg"><Sparkles size={18} className="text-primary" /></div>
            <div><h2 className="text-primary" style={{ margin: 0, fontSize: "1.3rem" }}>Data Injection</h2></div>
          </div>

          <div className="config-section">
            <label className="section-label">1. Select Category</label>
            <div className="category-list">
              {categories.map((cat) => (
                <div key={cat.id} className={`category-item ${context.category === cat.id ? "active" : ""}`} onClick={() => handleCategorySelect(cat.id)} style={{ "--item-color": cat.color }}>
                  <div className="cat-icon-box"><cat.icon size={20} /></div><span className="cat-label">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DEPARTMENT SELECTOR */}
          <div className="config-section animate-slide-up">
             <label className="section-label">2. Target Department</label>
             {isHOD ? (
                 <div className="elegant-year-card" style={{ justifyContent: 'center', opacity: 0.8, background: 'var(--bg-card)'}}>
                     <span className="year-value" style={{ fontSize: '1rem' }}>{departments.find(d => d.id === context.department_id)?.name || "Your Department"}</span>
                 </div>
             ) : (
                 <select className="premium-select" value={context.department_id || ""} onChange={(e) => setContext({...context, department_id: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)'}}>
                     {departments.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                 </select>
             )}
          </div>

          <div className="config-section">
            <label className="section-label">3. Academic Year</label>
            <div className="elegant-year-card">
              <div className="year-info"><span className="year-value">{context.startYear} — {context.endYear}</span></div>
              <div className="year-stepper-engine">
                <button className="step-btn up" onClick={() => adjustYear(1)}>▲</button><div className="step-divider" /><button className="step-btn down" onClick={() => adjustYear(-1)}>▼</button>
              </div>
            </div>
          </div>

          <div className="config-section animate-slide-up">
            <div className="sem-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="section-label" style={{ margin: 0 }}>4. Target Semester</label>
                <span className="level-indicator">{getYearLabel(context.semester)}</span>
            </div>
            <div className="semester-modern-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <button key={s} className={`sem-pill ${context.semester === s ? "active" : ""}`} onClick={() => setContext({ ...context, semester: s })}>Sem {s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: ACTION ZONE */}
        <div className="ecs-upload-side">
            
          {duplicateWarning ? (
            <div className="compact-glass-dropzone d_glass-panel border-warning fade-in">
              <AlertTriangle size={64} className="text-warning" style={{ marginBottom: "1rem" }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Duplicate File Detected</h3>
              <p className="text-secondary text-center" style={{ maxWidth: "300px" }}>"{file?.name}" has been uploaded before for {context.startYear}-{context.endYear}. Do you want to process it again?</p>
              <div className="action-row">
                <button className="btn-secondary" onClick={() => { setDuplicateWarning(false); setStep("IDLE"); setFile(null); }}>Cancel</button>
                <button className="btn-warning" onClick={() => fetchPreview(file)}>Proceed Anyway</button>
              </div>
            </div>
          ) : step === "SUCCESS" ? (
            <div className="compact-glass-dropzone d_glass-panel border-green fade-in">
              <CheckCircle size={64} className="text-success" style={{ marginBottom: "1rem" }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Ingestion Complete</h3>
              <p className="text-secondary">Data successfully merged into Master Records.</p>
              <button className="upload-action-btn" onClick={() => setStep("IDLE")}>Upload Another</button>
            </div>
          ) : step === "ERROR" ? (
            <div className="compact-glass-dropzone d_glass-panel border-red fade-in">
              <XCircle size={64} className="text-error" style={{ marginBottom: "1rem" }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Upload Failed</h3>
              <p className="error-msg">{report?.error || "An unexpected error occurred."}</p>
              <button className="upload-action-btn" onClick={() => setStep("IDLE")}>Try Again</button>
            </div>
          ) : (
            <div className={`compact-glass-dropzone d_glass-panel ${isDragging ? "dragging" : ""}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              
              <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px', zIndex: 10 }}>
                  <button 
                      onClick={(e) => { e.stopPropagation(); handleDownloadSample(e); }}
                      title="Download Excel Template"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', color: 'var(--text-secondary)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                      <Download size={16} /> <span className="desktop-only">Template</span>
                  </button>
                  <button 
                      onClick={(e) => { e.stopPropagation(); setShowSchemaInfo(true); }}
                      title="View Schema Info"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '8px', color: 'var(--primary-color)', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                      <Info size={16} /> <span className="desktop-only">Rules</span>
                  </button>
              </div>

              <div className="dropzone-core">
                {step === "CHECKING" || step === "PREVIEW_LOADING" || step === "COMMITTING" ? (
                  <>
                    <Loader2 size={54} className="animate-spin text-primary" />
                    <h3 style={{ marginTop: "15px", color: "var(--text-primary)" }}>Processing...</h3>
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
                      <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{context.category} Ingestion</h3>
                      <div className="preview-badges" style={{ marginTop: '0.5rem' }}>
                        <span className="badge-outline">{departments.find(d => d.id === context.department_id)?.code || "Dept"}</span>
                        <span className="badge-outline">{context.startYear}-{context.endYear}</span>
                        {context.semester && <span className="badge-solid">S{context.semester}</span>}
                      </div>
                    </div>
                    <p className="upload-text text-secondary">Drag & Drop your Excel file here</p>
                    <label htmlFor="file-input" className="upload-action-btn" onClick={e => e.stopPropagation()}>Browse Files</label>
                    <input type="file" id="file-input" hidden onChange={(e) => handleFileSelect(e.target.files[0])} onClick={e => e.stopPropagation()} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🚨 MOBILE POPUP (Only shows once per session if on mobile) */}
      <AnimatePresence>
          {isMobile && !mobilePopupDismissed && (
              <div className="modal-overlay center-mobile" style={{ zIndex: 9999 }}>
                  <motion.div className="modal-content small-modal glass-panel" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ padding: "2rem", textAlign: "center" }}>
                      <div style={{ width: "64px", height: "64px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto" }}>
                          <MonitorSmartphone size={32} />
                      </div>
                      <h3 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>Desktop Recommended</h3>
                      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: "1.5" }}>
                          Uploading and mapping Excel data requires precision. For the best experience and to avoid accidental data drops, please use a Desktop or Laptop browser.
                      </p>
                      <button className="upload-action-btn" style={{ width: "100%", margin: 0 }} onClick={() => setMobilePopupDismissed(true)}>
                          I Understand, Continue Anyway
                      </button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {showSchemaInfo && renderSchemaModal()}
      {step === "PREVIEW" && report && renderPreviewModal()}
      {showPartialConfirmation && renderPartialConfirmationModal()}
    </div>
  );
};

export default ECSUploadWizard;