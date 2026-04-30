import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { 
  Search, Users, UserCircle, MapPin, Phone, Briefcase, 
  Heart, Award, X, Edit3, Save, CheckCircle, Download, Upload, Loader2, AlertTriangle, MonitorSmartphone
} from "lucide-react";
import "./MenteeDirectory.css";

const MenteeDirectory = () => {
  const { user } = useAuth();
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activeTab, setActiveTab] = useState("ALL");
  const [departments, setDepartments] = useState([]);

  // Drawer State
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // Bulk Upload State
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // --- MOBILE DETECTION LOGIC ---
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePopupDismissed, setMobilePopupDismissed] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 850);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getToken = () => localStorage.getItem("access_token");
  const getBaseUrl = () => import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  useEffect(() => { fetchMentees(); }, []);

  const fetchMentees = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${getBaseUrl()}/api/counselling/mentees/`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setMentees(res.data);
      const uniqueDepts = [...new Set(res.data.map(m => m.department_name))].filter(Boolean);
      setDepartments(uniqueDepts);
    } catch (err) { console.error("Failed to fetch mentees", err); } 
    finally { setLoading(false); }
  };

  const filteredMentees = mentees.filter(m => {
    const matchesSearch = m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.roll_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "ALL" || m.department_name === activeTab;
    return matchesSearch && matchesTab;
  });

  // --- PROGRESS CALCULATION ---
  const calculateProgress = (profile) => {
    if (!profile) return 0;
    // 11 fields required for a "Complete" profile (excluding Guardian)
    const requiredFields = [
      'address', 'pin_code', 'contact_number',
      'father_name', 'father_occupation', 'father_contact',
      'mother_name', 'mother_occupation', 'mother_contact',
      'hobbies', 'achievements'
    ];
    let filled = 0;
    requiredFields.forEach(f => {
      if (profile[f] && String(profile[f]).trim() !== '') filled++;
    });
    return Math.round((filled / requiredFields.length) * 100);
  };

  // --- DRAWER HANDLERS ---
  const openProfile = (mentee) => {
    setSelectedMentee(mentee);
    setIsEditing(false);
    const p = mentee.profile || {};
    setFormData({
      address: p.address || "", pin_code: p.pin_code || "", contact_number: p.contact_number || "",
      father_name: p.father_name || "", father_occupation: p.father_occupation || "", father_contact: p.father_contact || "",
      mother_name: p.mother_name || "", mother_occupation: p.mother_occupation || "", mother_contact: p.mother_contact || "",
      guardian_name: p.guardian_name || "", guardian_contact: p.guardian_contact || "",
      hobbies: p.hobbies || "", achievements: p.achievements || ""
    });
  };

  const closeProfile = () => { setSelectedMentee(null); setIsEditing(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.patch(
        `${getBaseUrl()}/api/counselling/mentees/${selectedMentee.id}/`, 
        { profile: formData }, 
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setMentees(mentees.map(m => m.id === selectedMentee.id ? res.data : m));
      setSelectedMentee(res.data);
      setIsEditing(false);
    } catch (err) { alert("Failed to save profile details."); } 
    finally { setSaving(false); }
  };

  // --- EXCEL TEMPLATE GENERATION (WITH LOCKS) ---
  const handleExportTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Mentee Profiles");

    const columns = [
      { header: 'ROLL NO', key: 'roll_number', width: 15 },
      { header: 'NAME', key: 'name', width: 25 },
      { header: 'DEPARTMENT', key: 'dept', width: 20 },
      { header: 'ADDRESS', key: 'address', width: 30 },
      { header: 'PIN CODE', key: 'pin_code', width: 15 },
      { header: 'MENTEE CONTACT', key: 'contact_number', width: 20 },
      { header: 'FATHER NAME', key: 'father_name', width: 20 },
      { header: 'FATHER OCCUPATION', key: 'father_occupation', width: 20 },
      { header: 'FATHER CONTACT', key: 'father_contact', width: 20 },
      { header: 'MOTHER NAME', key: 'mother_name', width: 20 },
      { header: 'MOTHER OCCUPATION', key: 'mother_occupation', width: 20 },
      { header: 'MOTHER CONTACT', key: 'mother_contact', width: 20 },
      { header: 'GUARDIAN NAME', key: 'guardian_name', width: 20 },
      { header: 'GUARDIAN CONTACT', key: 'guardian_contact', width: 20 },
      { header: 'HOBBIES', key: 'hobbies', width: 30 },
      { header: 'ACHIEVEMENTS', key: 'achievements', width: 30 }
    ];
    worksheet.columns = columns;

    // Fill Data
    filteredMentees.forEach(m => {
      const p = m.profile || {};
      worksheet.addRow({
        roll_number: m.roll_number, name: m.full_name, dept: m.department_name,
        address: p.address || "", pin_code: p.pin_code || "", contact_number: p.contact_number || "",
        father_name: p.father_name || "", father_occupation: p.father_occupation || "", father_contact: p.father_contact || "",
        mother_name: p.mother_name || "", mother_occupation: p.mother_occupation || "", mother_contact: p.mother_contact || "",
        guardian_name: p.guardian_name || "", guardian_contact: p.guardian_contact || "",
        hobbies: p.hobbies || "", achievements: p.achievements || ""
      });
    });

    // Style Headers & Apply Protection
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (rowNumber === 1) {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNumber <= 3 ? 'FFB0BEC5' : 'FFECEFF1' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
        
        // Lock only the first 3 columns (Roll No, Name, Dept). Unlock the rest.
        if (colNumber <= 3) {
            cell.protection = { locked: true };
        } else {
            cell.protection = { locked: false };
        }
      });
    });

    // Protect the sheet (prevents editing locked cells)
    await worksheet.protect('edusphere_secure', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: true,
        formatColumns: true,
        formatRows: true,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = activeTab === "ALL" ? "All_Mentees_Bulk_Update.xlsx" : `${activeTab}_Mentees_Bulk_Update.xlsx`;
    saveAs(blob, fileName);
  };

  // --- CLIENT-SIDE PREVIEW PARSER ---
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const worksheet = workbook.worksheets[0];

        let headers = [];
        let parsedRows = [];
        let changes = [];
        let warnings = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                headers = row.values.map(v => v?.toString().trim());
            } else {
                let rowData = {};
                row.values.forEach((val, idx) => {
                    if (headers[idx]) rowData[headers[idx]] = val?.toString().trim() || "";
                });
                if (rowData['ROLL NO']) parsedRows.push(rowData);
            }
        });

        const fieldMap = {
            'ADDRESS': 'address', 'PIN CODE': 'pin_code', 'MENTEE CONTACT': 'contact_number',
            'FATHER NAME': 'father_name', 'FATHER OCCUPATION': 'father_occupation', 'FATHER CONTACT': 'father_contact',
            'MOTHER NAME': 'mother_name', 'MOTHER OCCUPATION': 'mother_occupation', 'MOTHER CONTACT': 'mother_contact',
            'GUARDIAN NAME': 'guardian_name', 'GUARDIAN CONTACT': 'guardian_contact',
            'HOBBIES': 'hobbies', 'ACHIEVEMENTS': 'achievements'
        };

        parsedRows.forEach(row => {
            const rollNo = row['ROLL NO'];
            const existing = mentees.find(m => m.roll_number === rollNo);
            if (existing) {
                // Check if core fields were maliciously/accidentally changed
                if (row['NAME'] && row['NAME'] !== existing.full_name) warnings.push(`Roll No ${rollNo}: Name modification detected and will be ignored.`);
                if (row['DEPARTMENT'] && row['DEPARTMENT'] !== existing.department_name) warnings.push(`Roll No ${rollNo}: Department modification detected and will be ignored.`);

                let updatedFields = [];
                const p = existing.profile || {};
                
                Object.keys(fieldMap).forEach(excelHeader => {
                    const dbField = fieldMap[excelHeader];
                    const newVal = row[excelHeader] || "";
                    const oldVal = p[dbField] || "";
                    if (newVal !== oldVal) updatedFields.push(excelHeader);
                });

                if (updatedFields.length > 0) {
                    changes.push({ roll_number: rollNo, name: existing.full_name, fields: updatedFields.join(", ") });
                }
            }
        });

        setPreviewData({ file, changes, warnings });
    } catch (err) {
        alert("Failed to parse the Excel file. Make sure it is the exported template.");
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmBulkUpload = async () => {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", previewData.file);

      try {
        await axios.post(`${getBaseUrl()}/api/counselling/mentees/bulk-upload/`, formData, {
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "multipart/form-data" }
        });
        setPreviewData(null);
        fetchMentees(); 
      } catch (err) {
        alert(err.response?.data?.error || "Failed to upload file.");
      } finally {
        setIsUploading(false);
      }
  };

  return (
    <div className="mentee-directory-container fade-in">
      
      {/* 🚨 MOBILE BANNER: Only visible on mobile CSS breakpoint */}
      <div className="mobile-desktop-warning">
          <MonitorSmartphone size={24} />
          <span>For maximum efficiency and data safety, Exporting and Bulk Updating Excel files is best performed on a Desktop device.</span>
      </div>

      {/* HEADER */}
      <div className="directory-header" style={{ position: 'relative' }}>
        {isUploading && !previewData && (
           <div className="upload-loading-overlay fade-in">
              <Loader2 size={40} className="animate-spin text-primary" />
              <h3 style={{ marginTop: '10px' }}>Processing...</h3>
           </div>
        )}

        <div>
          <h1>Mentee Profiles</h1>
          <p>Digitized Registration Forms & Background Details</p>
        </div>
        
        <div className="header-actions">
          <div className="search-bar-wrapper">
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search by name or roll no..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          {/* 🚨 FIX: Replaced inline styles with a class so CSS can force them into a column on mobile! */}
          <div className="header-action-buttons">
            <button className="btn btn-secondary" onClick={handleExportTemplate} title="Download a protected Excel sheet for offline editing">
              <Download size={18} /> <span>Export List</span>
            </button>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} title="Upload the filled Excel sheet">
              <Upload size={18} /> <span>Bulk Update</span>
            </button>
            <input type="file" ref={fileInputRef} hidden accept=".xlsx" onChange={handleFileSelect} />
          </div>
        </div>
      </div>

      {/* DEPARTMENT TABS */}
      {departments.length > 0 && (
        <div className="md-tabs-container">
          <button className={`md-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`} onClick={() => setActiveTab('ALL')}>All Departments</button>
          {departments.map(dept => (
             <button key={dept} className={`md-tab-btn ${activeTab === dept ? 'active' : ''}`} onClick={() => setActiveTab(dept)}>{dept}</button>
          ))}
        </div>
      )}

      {/* GRID */}
      {loading ? (
        <div className="spinner" style={{ margin: "5rem auto" }}></div>
      ) : filteredMentees.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", background: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--border-color)" }}>
          <Users size={48} style={{ color: "var(--text-muted)", opacity: 0.5, margin: "0 auto 1rem auto" }} />
          <h3 style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}>No Mentees Found</h3>
          <p style={{ color: "var(--text-secondary)" }}>Adjust your search or switch tabs.</p>
        </div>
      ) : (
        <div className="mentee-grid">
          {filteredMentees.map(mentee => {
            const progress = calculateProgress(mentee.profile);
            return (
                <div key={mentee.id} className="mentee-card" onClick={() => openProfile(mentee)}>
                  <div className="mentee-card-top">
                    <div className="mentee-avatar">{mentee.full_name.charAt(0)}</div>
                    <div className="mentee-info">
                      <h3>{mentee.full_name}</h3>
                      <p>{mentee.roll_number}</p>
                    </div>
                  </div>
                  <div className="mentee-badges">
                    <span className="m-badge">Sem {mentee.current_semester}</span>
                    {activeTab === 'ALL' && <span className="m-badge">{mentee.department_name}</span>}
                    
                    <div className="progress-wrapper">
                        {progress === 100 ? (
                            <span className="m-badge" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.2)", margin: 0, display: "flex", alignItems: "center" }}>
                                <CheckCircle size={12} style={{ marginRight: "4px" }}/> Profile Complete
                            </span>
                        ) : (
                            <div title={`${progress}% Complete`} style={{ width: '100%' }}>
                                <div className="progress-text">{progress}% Complete</div>
                                <div className="progress-bar-bg">
                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
            );
          })}
        </div>
      )}

      {/* PREVIEW MODAL */}
      <AnimatePresence>
        {previewData && (
           <div className="modal-overlay center-mobile fade-in" style={{ zIndex: 1500 }}>
             <div className="modal-content glass-panel">
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle className="text-primary" size={20} /> Review Bulk Update
                </h3>
                
                {previewData.warnings.length > 0 && (
                    <div className="warning-box">
                        <strong style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16}/> Notice: Restricted Fields Ignored</strong>
                        <ul>{previewData.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </div>
                )}

                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Found updates for <strong>{previewData.changes.length}</strong> mentee(s).
                </p>

                {previewData.changes.length > 0 ? (
                    <div className="preview-table-wrapper">
                        <table className="preview-table">
                            <thead><tr><th>Roll No</th><th>Student Name</th><th>Updated Fields</th></tr></thead>
                            <tbody>
                                {previewData.changes.map((c, i) => (
                                    <tr key={i}>
                                        <td>{c.roll_number}</td><td>{c.name}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>{c.fields}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No profile changes detected in the uploaded file.</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => setPreviewData(null)}>Cancel</button>
                    {previewData.changes.length > 0 && (
                        <button className="btn btn-primary" onClick={confirmBulkUpload}>Confirm Upload</button>
                    )}
                </div>
             </div>
           </div>
        )}
      </AnimatePresence>

      {/* 🚨 MOBILE POPUP (Only shows once per session if on mobile) */}
      <AnimatePresence>
          {isMobile && !mobilePopupDismissed && (
              <div className="modal-overlay center-mobile" style={{ zIndex: 9999 }}>
                  <motion.div className="modal-content small-modal" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ padding: "2rem", textAlign: "center" }}>
                      <div style={{ width: "64px", height: "64px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto" }}>
                          <MonitorSmartphone size={32} />
                      </div>
                      <h3 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>Desktop Recommended</h3>
                      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: "1.5" }}>
                          Exporting and Bulk Updating Excel data requires precision. For the best experience and to avoid accidental data overrides, please use a Desktop or Laptop browser.
                      </p>
                      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMobilePopupDismissed(true)}>
                          I Understand, Continue Anyway
                      </button>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* SLIDING DRAWER */}
      <AnimatePresence>
        {selectedMentee && (
          <div className="drawer-overlay" onClick={closeProfile}>
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.3 }}
              className="drawer-panel" onClick={e => e.stopPropagation()}
            >
              <div className="drawer-header">
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>{selectedMentee.full_name}</h2>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Registration Form</span>
                </div>
                <button className="icon-btn" style={{ background: 'var(--bg-input)', border: 'none', borderRadius: '50%', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={closeProfile}>
                    <X size={22} />
                </button>
              </div>

              <div className="drawer-content">
                <div>
                  <div className="form-section-title"><UserCircle size={18} /> Core Academic Info</div>
                  <div className="form-grid">
                    <div className="form-group"><label>Roll Number</label><input disabled value={selectedMentee.roll_number} /></div>
                    <div className="form-group"><label>Department</label><input disabled value={selectedMentee.department_name} /></div>
                    <div className="form-group"><label>Semester / Class</label><input disabled value={`Semester ${selectedMentee.current_semester}`} /></div>
                    <div className="form-group"><label>Date of Birth</label><input disabled value={selectedMentee.dob || "N/A"} /></div>
                    <div className="form-group"><label>Gender</label><input disabled value={selectedMentee.gender || "N/A"} /></div>
                    <div className="form-group"><label>College Email</label><input disabled value={selectedMentee.email} /></div>
                  </div>
                </div>

                <div>
                  <div className="form-section-title"><MapPin size={18} /> Contact Details</div>
                  <div className="form-grid">
                    <div className="form-group full-width"><label>Residential Address</label><textarea rows="2" name="address" disabled={!isEditing} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={isEditing ? "Enter full address..." : "-"} /></div>
                    <div className="form-group"><label>Pin Code</label><input name="pin_code" disabled={!isEditing} value={formData.pin_code} onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })} placeholder={isEditing ? "e.g. 403602" : "-"} /></div>
                    <div className="form-group"><label>Mentee Mobile No.</label><input name="contact_number" disabled={!isEditing} value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} placeholder={isEditing ? "e.g. +91 98765..." : "-"} /></div>
                  </div>
                </div>

                <div>
                  <div className="form-section-title"><Users size={18} /> Family Details</div>
                  <div className="form-grid">
                    <div className="form-group full-width"><label style={{ color: "var(--primary-color)" }}>Father's Details</label></div>
                    <div className="form-group"><label>Name</label><input name="father_name" disabled={!isEditing} value={formData.father_name} onChange={(e) => setFormData({ ...formData, father_name: e.target.value })} placeholder={isEditing ? "Father's full name" : "-"} /></div>
                    <div className="form-group"><label>Occupation</label><input name="father_occupation" disabled={!isEditing} value={formData.father_occupation} onChange={(e) => setFormData({ ...formData, father_occupation: e.target.value })} placeholder={isEditing ? "e.g. Business" : "-"} /></div>
                    <div className="form-group"><label>Contact No.</label><input name="father_contact" disabled={!isEditing} value={formData.father_contact} onChange={(e) => setFormData({ ...formData, father_contact: e.target.value })} placeholder={isEditing ? "Mobile number" : "-"} /></div>
                    
                    <div className="form-group full-width" style={{ marginTop: "10px" }}><label style={{ color: "var(--primary-color)" }}>Mother's Details</label></div>
                    <div className="form-group"><label>Name</label><input name="mother_name" disabled={!isEditing} value={formData.mother_name} onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })} placeholder={isEditing ? "Mother's full name" : "-"} /></div>
                    <div className="form-group"><label>Occupation</label><input name="mother_occupation" disabled={!isEditing} value={formData.mother_occupation} onChange={(e) => setFormData({ ...formData, mother_occupation: e.target.value })} placeholder={isEditing ? "e.g. Teacher" : "-"} /></div>
                    <div className="form-group"><label>Contact No.</label><input name="mother_contact" disabled={!isEditing} value={formData.mother_contact} onChange={(e) => setFormData({ ...formData, mother_contact: e.target.value })} placeholder={isEditing ? "Mobile number" : "-"} /></div>

                    <div className="form-group full-width" style={{ marginTop: "10px" }}><label style={{ color: "var(--primary-color)" }}>Local Guardian (If applicable)</label></div>
                    <div className="form-group"><label>Name</label><input name="guardian_name" disabled={!isEditing} value={formData.guardian_name} onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })} placeholder={isEditing ? "Guardian's name" : "-"} /></div>
                    <div className="form-group"><label>Contact No.</label><input name="guardian_contact" disabled={!isEditing} value={formData.guardian_contact} onChange={(e) => setFormData({ ...formData, guardian_contact: e.target.value })} placeholder={isEditing ? "Mobile number" : "-"} /></div>
                  </div>
                </div>

                <div>
                  <div className="form-section-title"><Award size={18} /> Activities & Achievements</div>
                  <div className="form-grid">
                    <div className="form-group full-width"><label><Heart size={14} style={{ display: "inline", marginRight: "4px" }}/> Hobbies / Interests</label><textarea rows="3" name="hobbies" disabled={!isEditing} value={formData.hobbies} onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })} placeholder={isEditing ? "Sports, reading, coding..." : "-"} /></div>
                    <div className="form-group full-width"><label><Award size={14} style={{ display: "inline", marginRight: "4px" }}/> Achievements & Victories</label><textarea rows="3" name="achievements" disabled={!isEditing} value={formData.achievements} onChange={(e) => setFormData({ ...formData, achievements: e.target.value })} placeholder={isEditing ? "Hackathons won, sports medals..." : "-"} /></div>
                  </div>
                </div>
              </div>

              <div className="drawer-footer">
                {!isEditing ? (
                  <button className="btn btn-primary" onClick={() => setIsEditing(true)}><Edit3 size={18} /> Edit Profile Data</button>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={() => { setIsEditing(false); openProfile(selectedMentee); }} disabled={saving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : <><Save size={18} /> Save Changes</>}</button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenteeDirectory;