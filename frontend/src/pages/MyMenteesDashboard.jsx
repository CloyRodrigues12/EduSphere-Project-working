import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { assignmentService, counsellingService } from "../services/api";
import { 
  Users, Search, X, Activity, AlertTriangle, 
  TrendingUp, FileText, UserCircle, MapPin, 
  Users as UsersIcon, Award, Mail, Phone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./MyMenteesDashboard.css";

// IMPORT THE UNIFIED PREDICTIVE MATH ENGINE
import { evaluateMarks, getStatusColor } from "./InternalAssessment";

const getYearLevel = (sem) => {
  if (!sem) return "Unknown";
  if (sem <= 2) return "FE";
  if (sem <= 4) return "SE";
  if (sem <= 6) return "TE";
  return "BE";
};

const MyMenteesDashboard = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState(null); 
  const [menteeProfiles, setMenteeProfiles] = useState([]); // Isolated state for profiles
  const [search, setSearch] = useState("");
  
  const [selectedProfileMentee, setSelectedProfileMentee] = useState(null);
  const [selectedMentee, setSelectedMentee] = useState(null); 
  const [selectedResultsMentee, setSelectedResultsMentee] = useState(null); 
  
  const [activeTab, setActiveTab] = useState("profiles"); 
  const [yearFilter, setYearFilter] = useState("ALL");

  useEffect(() => {
    if (activeAcademicYear) fetchDashboard();
  }, [activeAcademicYear, activeTerm]);

  const fetchDashboard = async () => {
    setLoading(true);
    setSelectedMentee(null); setSelectedResultsMentee(null); setSelectedProfileMentee(null);
    try {
      // 1. Fetch Tracking Data
      const dashRes = await assignmentService.getMyMenteesDashboard(activeAcademicYear.id);
      
      // 2. Fetch Detailed Profiles safely and independently
      try {
        const profilesRes = await counsellingService.getMyDetailedMentees();
        setMenteeProfiles(profilesRes.data);
      } catch (profErr) {
        console.error("Failed to load detailed profiles", profErr);
      }
      
      // 3. Process Original Tracking Data
      if (dashRes.data.has_mentees) {
        const processedMentees = dashRes.data.mentees.map(s => {
          let s_fail = false; let s_risk = false; let s_pending = true; let s_on_track = false;
          let s_total_score = 0; let s_subjects = 0;

          s.subject_marks?.forEach(m => {
             const evalRes = evaluateMarks(m.it1, m.it2, m.it3);
             m.detailedStatus = evalRes.status; m.target = evalRes.req;
             m.final_score = evalRes.final_score; m.conducted = evalRes.conducted;
             if (evalRes.conducted > 0) {
                 s_pending = false; s_total_score += evalRes.final_score; s_subjects++;
                 if (["FAILING", "FAILED"].includes(evalRes.status)) s_fail = true;
                 else if (["NEEDS EFFORT", "CRITICAL"].includes(evalRes.status)) s_risk = true;
                 else if (evalRes.status === "ON TRACK") s_on_track = true;
             } else s_on_track = true;
          });

          const overall_avg = s_subjects > 0 ? Number((s_total_score / s_subjects).toFixed(2)) : 0;
          let overall_mark_status = "All Clear";
          if (s_pending) overall_mark_status = "Pending";
          else if (s_fail) overall_mark_status = "Failing";
          else if (s_risk) overall_mark_status = "At Risk";
          else if (s_on_track) overall_mark_status = "On Track";

          return { ...s, overall_avg, overall_mark_status };
        });
        setData({ ...dashRes.data, mentees: processedMentees });
      } else {
        setData(dashRes.data);
      }
    } catch (error) { console.error("Dashboard error", error); } 
    finally { setLoading(false); }
  };

  if (!activeAcademicYear || loading) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  if (!data?.has_mentees && menteeProfiles.length === 0) {
    return (
      <div className="mentees-container fade-in">
        <motion.div className="empty-state glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Users size={64} className="text-muted opacity-20 mb-4" />
          <h2>No Mentees Assigned</h2>
          <p className="text-muted">You have no mentees assigned for the {activeAcademicYear.name} academic year.</p>
        </motion.div>
      </div>
    );
  }

  // --- FILTERING FOR TRACKING DATA ---
  const filteredMentees = (data?.mentees || []).filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toLowerCase().includes(search.toLowerCase())
  );
  
  const groupedMentees = {
    "FE": filteredMentees.filter(s => getYearLevel(s.semester) === "FE"),
    "SE": filteredMentees.filter(s => getYearLevel(s.semester) === "SE"),
    "TE": filteredMentees.filter(s => getYearLevel(s.semester) === "TE"),
    "BE": filteredMentees.filter(s => getYearLevel(s.semester) === "BE"),
    "Alumni": filteredMentees.filter(s => !s.is_active)
  };

  // --- FILTERING FOR DETAILED PROFILES DATA ---
  const filteredProfiles = menteeProfiles.filter(m => {
    const matchSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || 
                        m.roll_number.toLowerCase().includes(search.toLowerCase()) ||
                        (m.enrollment_number && m.enrollment_number.toLowerCase().includes(search.toLowerCase()));
    const matchYear = yearFilter === "ALL" || getYearLevel(m.current_semester) === yearFilter;
    return matchSearch && matchYear;
  });
  
  const groupedProfiles = filteredProfiles.reduce((acc, mentee) => {
    const sem = mentee.current_semester || "Unknown";
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(mentee);
    return acc;
  }, {});

  return (
    <div className="mentees-container fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "1.8rem" }}>My Mentees</h1>
          <p className="page-subtitle">Counselling & Academic Mentorship ({activeTerm} Term)</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
           <select className="premium-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
             <option value="ALL">All Students</option>
             <option value="FE">FE Students</option>
             <option value="SE">SE Students</option>
             <option value="TE">TE Students</option>
             <option value="BE">BE Students</option>
             <option value="Alumni">Graduated</option>
           </select>
        </div>
      </div>

      <div className="mentee-tabs-container">
        <button className={`mentee-tab-btn ${activeTab === 'profiles' ? 'active' : ''}`} onClick={() => setActiveTab('profiles')}><UserCircle size={18}/> Mentee Profiles</button>
        <button className={`mentee-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}><Activity size={18}/> Attendance Tracker</button>
        <button className={`mentee-tab-btn ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}><TrendingUp size={18}/> Internal Results</button>
      </div>

      <div className="search-bar premium-search" style={{ maxWidth: "400px", margin: "1.5rem 0" }}>
        <Search size={18} className="text-muted" />
        <input type="text" placeholder="Search mentees by name, roll no, or enroll no..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* ===================== PROFILES TAB ===================== */}
      {activeTab === "profiles" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
           {Object.keys(groupedProfiles).length === 0 ? (
               <div className="empty-state glass-panel"><Users size={48} className="text-muted opacity-20 mb-4" /><h3>No Profiles Found</h3></div>
           ) : (
               Object.keys(groupedProfiles).sort().map(sem => (
                  <div key={sem}>
                      <h3 className="semester-group-title"><UsersIcon size={20}/> Semester {sem}</h3>
                      <div className="profiles-grid">
                          {groupedProfiles[sem].map(mentee => (
                              <div key={mentee.id} className="profile-card-modern" onClick={() => setSelectedProfileMentee(mentee)}>
                                  <div className="profile-avatar-large">{mentee.full_name.charAt(0)}</div>
                                  <div className="profile-card-info">
                                      <h4>{mentee.full_name}</h4>
                                      <p>{mentee.roll_number} <span style={{opacity: 0.5}}>|</span> {mentee.enrollment_number || "No Enroll No"}</p>
                                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                                          <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary-color)' }}>{mentee.department_name}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
               ))
           )}
        </motion.div>
      )}

      {/* ===================== ATTENDANCE TAB ===================== */}
      {activeTab === "attendance" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {["FE", "SE", "TE", "BE", "Alumni"].map(year => {
            if (yearFilter !== "ALL" && yearFilter !== year) return null;
            if (!groupedMentees[year] || groupedMentees[year].length === 0) return null;
            
            return (
              <div key={year} style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: year === "Alumni" ? "var(--text-secondary)" : "var(--primary-color)", borderBottom: "2px solid var(--border-color)", paddingBottom: "6px", marginBottom: "1rem", fontSize: "1.1rem" }}>
                  {year === "Alumni" ? "Graduated / Alumni" : `${year} Students`} ({groupedMentees[year].length})
                </h3>
                
                <div className="mentee-grid">
                  {groupedMentees[year].map(student => (
                    <motion.div key={student.id} className="mentee-card glass-panel" whileHover={{ y: -4, scale: 1.02 }} onClick={() => year !== "Alumni" && setSelectedMentee(student)} style={{ cursor: year === "Alumni" ? "default" : "pointer", opacity: year === "Alumni" ? 0.7 : 1 }}>
                      <div className="mentee-header">
                        <div className="avatar-circle">{student.name.charAt(0)}</div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "1rem" }}>{student.name}</h4>
                          <span className="text-muted text-sm">{student.roll_number} • Sem {student.semester}</span>
                        </div>
                      </div>
                      {year !== "Alumni" && (
                        <div className="mentee-stats">
                          <div className="stat-box"><span className="stat-label">Attendance</span><span className="stat-value" style={{ color: student.percentage < 75 ? "#ef4444" : "var(--text-primary)" }}>{student.percentage}%</span></div>
                          <div className="stat-box" style={{ alignItems: "flex-end" }}><span className="stat-label">Status</span><span className="badge" style={{ background: student.status === "Safe" ? "rgba(16, 185, 129, 0.1)" : student.status === "At Risk" ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)", color: student.status === "Safe" ? "#10b981" : student.status === "At Risk" ? "#f59e0b" : "#ef4444" }}>{student.status}</span></div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* ===================== RESULTS TAB ===================== */}
      {activeTab === "results" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {["FE", "SE", "TE", "BE", "Alumni"].map(year => {
            if (yearFilter !== "ALL" && yearFilter !== year) return null;
            if (!groupedMentees[year] || groupedMentees[year].length === 0) return null;
            
            return (
              <div key={`res-${year}`} style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: year === "Alumni" ? "var(--text-secondary)" : "var(--primary-color)", borderBottom: "2px solid var(--border-color)", paddingBottom: "6px", marginBottom: "1rem", fontSize: "1.1rem" }}>
                  {year === "Alumni" ? "Graduated / Alumni" : `${year} Students`} ({groupedMentees[year].length})
                </h3>
                
                <div className="mentee-grid">
                  {groupedMentees[year].map(student => {
                    const badgeStyle = getStatusColor(student.overall_mark_status);
                    return (
                      <motion.div key={`res-card-${student.id}`} className="mentee-card glass-panel" whileHover={{ y: -4, scale: 1.02 }} onClick={() => year !== "Alumni" && setSelectedResultsMentee(student)} style={{ cursor: year === "Alumni" ? "default" : "pointer", opacity: year === "Alumni" ? 0.7 : 1 }}>
                        <div className="mentee-header">
                          <div className="avatar-circle">{student.name.charAt(0)}</div>
                          <div><h4 style={{ margin: 0, fontSize: "1rem" }}>{student.name}</h4><span className="text-muted text-sm">{student.roll_number} • Sem {student.semester}</span></div>
                        </div>
                        {year !== "Alumni" && (
                          <div className="mentee-stats">
                            <div className="stat-box"><span className="stat-label">Average</span><span className="stat-value" style={{ color: "var(--text-primary)" }}>{student.overall_avg} <span style={{fontSize:'0.75rem', color:'var(--text-secondary)'}}>/ 25</span></span></div>
                            <div className="stat-box" style={{ alignItems: "flex-end" }}><span className="stat-label">Status</span><span className="badge premium-status-badge" style={{ background: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.bg}` }}>{student.overall_mark_status}</span></div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* ===================== MODALS ===================== */}
      <AnimatePresence>
        
        {/* NEW: PROFILE MODAL WITH ENROLLMENT NO */}
        {selectedProfileMentee && (
            <div className="modal-overlay" onClick={() => setSelectedProfileMentee(null)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="full-profile-modal" onClick={e => e.stopPropagation()}>
                   <div className="fp-header">
                       <button className="fp-close" onClick={() => setSelectedProfileMentee(null)}><X size={20}/></button>
                       <div className="fp-avatar">{selectedProfileMentee.full_name.charAt(0)}</div>
                       <div className="fp-title">
                           <h2>{selectedProfileMentee.full_name}</h2>
                           <p>{selectedProfileMentee.roll_number} • {selectedProfileMentee.enrollment_number} • {selectedProfileMentee.department_name} • Sem {selectedProfileMentee.current_semester}</p>
                       </div>
                   </div>
                   
                   <div className="fp-content">
                       <div className="fp-section">
                           <div className="fp-section-title"><UserCircle size={18}/> Student Information</div>
                           <div className="fp-grid">
                               <div className="fp-field"><span className="fp-label">Roll No.</span><span className="fp-value">{selectedProfileMentee.roll_number || <span className="fp-empty">Not recorded</span>}</span></div>
                               
                               <div className="fp-field"><span className="fp-label">Enrollment Number</span><span className="fp-value">{selectedProfileMentee.enrollment_number || <span className="fp-empty">Not recorded</span>}</span></div>  
                              <div className="fp-field"><span className="fp-label"><Mail size={12} style={{display:'inline', marginRight:'4px'}}/> Email</span><span className="fp-value">{selectedProfileMentee.email || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Date of Birth</span><span className="fp-value">{selectedProfileMentee.dob || <span className="fp-empty">Not recorded</span>}</span></div>

                               <div className="fp-field"><span className="fp-label">Gender</span><span className="fp-value">{selectedProfileMentee.gender || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label"><Phone size={12} style={{display:'inline', marginRight:'4px'}}/> Mentee Contact</span><span className="fp-value">{selectedProfileMentee.profile?.contact_number || <span className="fp-empty">Not recorded</span>}</span></div>
                           </div>
                       </div>
                       
                       <div className="fp-section">
                           <div className="fp-section-title"><MapPin size={18}/> Residential Address</div>
                           <div className="fp-grid">
                               <div className="fp-field full"><span className="fp-label">Address</span><span className="fp-value">{selectedProfileMentee.profile?.address || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Pin Code</span><span className="fp-value">{selectedProfileMentee.profile?.pin_code || <span className="fp-empty">Not recorded</span>}</span></div>
                           </div>
                       </div>
                       
                       <div className="fp-section">
                           <div className="fp-section-title"><UsersIcon size={18}/> Family Details</div>
                           <div className="fp-grid">
                               <div className="fp-field"><span className="fp-label">Father's Name</span><span className="fp-value">{selectedProfileMentee.profile?.father_name || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Occupation</span><span className="fp-value">{selectedProfileMentee.profile?.father_occupation || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Contact</span><span className="fp-value">{selectedProfileMentee.profile?.father_contact || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Mother's Name</span><span className="fp-value">{selectedProfileMentee.profile?.mother_name || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Occupation</span><span className="fp-value">{selectedProfileMentee.profile?.mother_occupation || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Contact</span><span className="fp-value">{selectedProfileMentee.profile?.mother_contact || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field full" style={{ marginTop: '10px' }}><span className="fp-label" style={{ color: 'var(--primary-color)' }}>Local Guardian</span></div>
                               <div className="fp-field"><span className="fp-label">Guardian Name</span><span className="fp-value">{selectedProfileMentee.profile?.guardian_name || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field"><span className="fp-label">Contact</span><span className="fp-value">{selectedProfileMentee.profile?.guardian_contact || <span className="fp-empty">Not recorded</span>}</span></div>
                           </div>
                       </div>

                       <div className="fp-section">
                           <div className="fp-section-title"><Award size={18}/> Extracurriculars</div>
                           <div className="fp-grid">
                               <div className="fp-field full"><span className="fp-label">Hobbies / Interests</span><span className="fp-value">{selectedProfileMentee.profile?.hobbies || <span className="fp-empty">Not recorded</span>}</span></div>
                               <div className="fp-field full"><span className="fp-label">Achievements & Victories</span><span className="fp-value">{selectedProfileMentee.profile?.achievements || <span className="fp-empty">Not recorded</span>}</span></div>
                           </div>
                       </div>
                   </div>
                </motion.div>
            </div>
        )}

        {selectedMentee && <MenteeDrilldownModal student={selectedMentee} ayId={activeAcademicYear.id} onClose={() => setSelectedMentee(null)} />}
        {selectedResultsMentee && <MenteeResultsModal student={selectedResultsMentee} onClose={() => setSelectedResultsMentee(null)} />}
      </AnimatePresence>
    </div>
  );
};

// --- ATTENDANCE MODAL (Unchanged) ---
const MenteeDrilldownModal = ({ student, ayId, onClose }) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assignmentService.getMenteeSubjectAttendance(student.id, ayId)
      .then(res => { setSubjects(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [student, ayId]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <motion.div className="modal-content premium-modal large-modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <div>
            <h3>{student.name}'s Attendance</h3>
            <p className="text-muted text-sm">{student.roll_number} • Semester {student.semester}</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div className="drilldown-summary" style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "12px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem" }}>
            <Activity size={32} color={student.percentage < 75 ? "#ef4444" : "#10b981"} />
            <div>
              <p className="text-muted text-sm" style={{ margin: 0 }}>Overall Term Attendance</p>
              <h2 style={{ margin: 0, color: "var(--text-primary)" }}>{student.percentage}%</h2>
            </div>
          </div>
          {student.percentage < 75 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "0.8rem", borderRadius: "8px" }}>
              <AlertTriangle size={24} />
              <span className="font-medium text-sm">Critical Warning: Mentee is short of attendance.</span>
            </div>
          )}
        </div>

        <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "350px", overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          {loading ? <p className="text-center text-muted py-8">Loading detailed subjects...</p> : (
            <table className="data-table drilldown-table" style={{ fontSize: "0.9rem" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)" }}>
                <tr><th>Subject</th><th>Teacher</th><th style={{ textAlign: "center" }}>TA</th><th style={{ textAlign: "center" }}>TC</th><th style={{ textAlign: "center" }}>%</th></tr>
              </thead>
              <tbody>
                {subjects.map(sub => (
                  <tr key={sub.code} className="premium-row">
                    <td><div className="font-medium">{sub.name}</div><div className="text-muted text-sm">{sub.code}</div></td>
                    <td className="text-muted">{sub.teacher}</td>
                    <td style={{ textAlign: "center" }}>{sub.ta}</td>
                    <td style={{ textAlign: "center" }}>{sub.tc}</td>
                    <td style={{ textAlign: "center", fontWeight: "bold", color: sub.percentage < 75 ? "#ef4444" : sub.percentage < 80 ? "#f59e0b" : "#10b981" }}>{sub.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- RESULTS MODAL (Unchanged) ---
const MenteeResultsModal = ({ student, onClose }) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <motion.div className="modal-content premium-modal large-modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header">
          <div>
            <h3>{student.name}'s Academic Performance</h3>
            <p className="text-muted text-sm">{student.roll_number} • Semester {student.semester}</p>
          </div>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>

        <div className="drilldown-summary" style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "12px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem" }}>
            <TrendingUp size={32} color="var(--primary-color)" />
            <div>
              <p className="text-muted text-sm" style={{ margin: 0 }}>Overall Test Average</p>
              <h2 style={{ margin: 0, color: "var(--text-primary)" }}>{student.overall_avg} / 25</h2>
            </div>
          </div>
          {student.overall_mark_status === "Failing" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "0.8rem", borderRadius: "8px" }}>
              <AlertTriangle size={24} />
              <span className="font-medium text-sm">Critical Warning: Mentee is failing one or more subjects.</span>
            </div>
          )}
        </div>

        <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "350px", overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          {(!student.subject_marks || student.subject_marks.length === 0) ? (
            <p className="text-center text-muted" style={{ padding: '2rem 0' }}>No tests recorded yet for this academic term.</p>
          ) : (
            <table className="data-table drilldown-table" style={{ fontSize: "0.9rem", width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: '12px' }}>Subject</th><th style={{ textAlign: "center", padding: '12px' }}>IT 1</th><th style={{ textAlign: "center", padding: '12px' }}>IT 2</th><th style={{ textAlign: "center", padding: '12px' }}>IT 3</th><th style={{ textAlign: "center", padding: '12px' }}>Target</th><th style={{ textAlign: "center", padding: '12px' }}>Final</th><th style={{ textAlign: "center", padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {student.subject_marks.map(sub => {
                  const badgeStyle = getStatusColor(sub.detailedStatus);
                  return (
                    <tr key={sub.code} className="premium-row">
                      <td style={{ padding: '12px' }}><div className="font-medium">{sub.name}</div><div className="text-muted text-sm">{sub.code}</div></td>
                      <td style={{ textAlign: "center", padding: '12px' }}>{sub.it1 !== null ? sub.it1 : "-"}</td>
                      <td style={{ textAlign: "center", padding: '12px' }}>{sub.it2 !== null ? sub.it2 : "-"}</td>
                      <td style={{ textAlign: "center", padding: '12px' }}>{sub.it3 !== null ? sub.it3 : "-"}</td>
                      <td style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem", padding: '12px' }}>{sub.target}</td>
                      <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "1.1rem", padding: '12px' }}>{sub.conducted > 0 ? sub.final_score : "-"}</td>
                      <td style={{ textAlign: "center", padding: '12px' }}><span className="badge premium-status-badge" style={{ background: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.bg}` }}>{sub.detailedStatus}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MyMenteesDashboard;