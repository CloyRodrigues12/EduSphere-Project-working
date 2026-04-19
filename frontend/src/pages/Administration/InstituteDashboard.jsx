import React, { useState, useEffect, useMemo } from "react";
import { instituteService } from "../../services/api";
import { useAcademic } from "../../context/AcademicContext";
import { Search, X, UserCircle, MapPin, Phone, Users, CheckCircle, XCircle, ShieldCheck, Mail, Calendar, AlertCircle, FileText, Activity, Award, HeartHandshake, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { evaluateMarks, getStatusColor } from "../InternalAssessment";
import "./InstituteDashboard.css";

const DEPT_COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#10b981", "#f59e0b"];

const getYearLevel = (sem) => {
  if (!sem) return "Unknown";
  if (sem <= 2) return "FE";
  if (sem <= 4) return "SE";
  if (sem <= 6) return "TE";
  return "BE";
};

const InstituteDashboard = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const [data, setData] = useState({ students: [], departments: [], user_role: "", user_department_id: null });
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [activeCohort, setActiveCohort] = useState("All");
  
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalTab, setModalTab] = useState("profile");

  useEffect(() => {
    instituteService.getDirectory().then(res => {
      setData(res.data);
      if (res.data.user_role === 'HOD') setSelectedDept(res.data.user_department_id);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const openStudent360 = async (student) => {
    if (!activeAcademicYear) return alert("Please configure an Academic Year first.");
    
    setSelectedStudent({ ...student, loading: true, error: false });
    setModalTab("profile"); 
    
    try {
      const res = await instituteService.getStudent360(student.id, activeAcademicYear.id, activeTerm);
      setSelectedStudent({ ...student, ...res.data, loading: false, error: false });
    } catch (error) {
      console.error("Failed to load 360 data:", error);
      setSelectedStudent({ ...student, loading: false, error: true });
    }
  };

  const filteredStudents = useMemo(() => {
    if (!data.students) return [];
    const query = searchTerm.toLowerCase().trim();
    
    return data.students.filter(s => {
      const matchSearch = query === "" || 
        s.name.toLowerCase().includes(query) || 
        s.roll_number.toLowerCase().includes(query) || 
        (s.enrollment_number && s.enrollment_number.toLowerCase().includes(query));
        
      const matchDept = selectedDept === "ALL" || s.department_id === selectedDept;
      
      let matchCohort = true;
      if (query === "") {
        if (activeCohort === "Alumni") {
            matchCohort = s.is_active === false;
        } else if (activeCohort === "All") {
            matchCohort = s.is_active !== false; 
        } else {
            matchCohort = s.is_active !== false && getYearLevel(s.semester) === activeCohort;
        }
      }
      
      return matchSearch && matchDept && matchCohort;
    });
  }, [data.students, searchTerm, selectedDept, activeCohort]);

  const visibleStudents = filteredStudents.slice(0, 100);

  if (loading) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  return (
    <div className="institute-dashboard-page">
      <div className="institute-dashboard fade-in">
        
        <div className="hero-search-container">
          <h1>Institute Directory</h1>
          <div className="massive-search-bar">
            <Search size={20} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Live search by Name, Roll No, or Enrollment No..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            {searchTerm && <X size={18} color="var(--text-muted)" style={{cursor:'pointer'}} onClick={() => setSearchTerm("")}/>}
          </div>
        </div>

        {data.user_role !== "HOD" && (
          <div className="dept-cards-grid">
            <div className={`dept-card ${selectedDept === "ALL" ? 'active' : ''}`} onClick={() => setSelectedDept("ALL")}>
              <div className="dept-icon" style={{ background: "linear-gradient(135deg, #475569, #1e293b)" }}><Users size={20}/></div>
              <div><h3 style={{ margin: 0, fontSize: "0.95rem" }}>All Departments</h3><span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Global View</span></div>
            </div>
            {data.departments.map((d, idx) => (
              <div key={d.id} className={`dept-card ${selectedDept === d.id ? 'active' : ''}`} onClick={() => setSelectedDept(d.id)}>
                <div className="dept-icon" style={{ background: DEPT_COLORS[idx % DEPT_COLORS.length] }}>{d.code}</div>
                <div><h3 style={{ margin: 0, fontSize: "0.95rem" }}>{d.name}</h3><span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Department</span></div>
              </div>
            ))}
          </div>
        )}

        <div className="cohort-tabs">
          {["All", "FE", "SE", "TE", "BE", "Alumni"].map(yr => (
            <button 
              key={yr} 
              className={`cohort-tab ${!searchTerm && activeCohort === yr ? 'active' : ''}`} 
              onClick={() => {
                  setActiveCohort(yr);
                  setSearchTerm(""); 
              }}
            >
              {yr === "All" ? "All Active" : yr} {yr === "Alumni" || yr === "All" ? "" : "Students"}
            </button>
          ))}
        </div>

        <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.85rem" }}>
           {searchTerm ? "Search results across all years." : `Showing ${activeCohort} ${activeCohort === 'Alumni' ? 'records' : 'students'}.`} ({visibleStudents.length} {filteredStudents.length > 100 ? `of ${filteredStudents.length} matches` : "results"})
        </p>

        {visibleStudents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 2rem", background: "var(--bg-card)", borderRadius: "16px", border: "1px dashed var(--border-color)" }}>
             <Users size={40} style={{ color: "var(--text-muted)", opacity: 0.3, margin: "0 auto 1rem auto" }} />
             <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontSize: "1.1rem" }}>No Match Found</h3>
          </div>
        ) : (
          <div className="student-grid">
            {visibleStudents.map(s => (
              <div key={s.id} className="s-card" onClick={() => openStudent360(s)} style={{ opacity: s.is_active === false ? 0.6 : 1 }}>
                <div className="s-avatar">{s.name.charAt(0)}</div>
                <div className="s-info">
                  <h4>{s.name}</h4>
                  {/* --- ENHANCED GRID CARD INFO --- */}
                  <p>
                      <span className="s-badge">{s.roll_number}</span>
                      <span style={{ opacity: 0.4, margin: '0 4px' }}>•</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{getYearLevel(s.semester)} </span>
                      <span style={{ opacity: 0.4, margin: '0 4px' }}>•</span>
                      {s.department_code}
                      {s.is_active === false && <span style={{color:'#ef4444', fontWeight:600, fontSize:'0.75rem', marginLeft:'6px'}}>Alumni</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================================
            THE 360 CRM MODAL
        ========================================================= */}
        <AnimatePresence>
          {selectedStudent && (
            <div className="modal-360-overlay" onClick={() => setSelectedStudent(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="modal-360-content" onClick={e => e.stopPropagation()}>
                
                <div className="modal-360-header">
                  <div className="m-head-left">
                    <div className="m-avatar">{selectedStudent.name.charAt(0)}</div>
                    <div className="m-title">
                      <h2>{selectedStudent.name}</h2>
                      <p>
                          <span className="s-badge" style={{ background: 'var(--bg-input)' }}>{selectedStudent.roll_number}</span>
                          {selectedStudent.enrollment_number && <span className="s-badge" style={{ background: 'var(--bg-input)' }}>{selectedStudent.enrollment_number}</span>}
                          <span className="s-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)' }}>{selectedStudent.department_code || selectedStudent.department_name}</span>
                          {selectedStudent.is_active === false && <span className="s-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Alumni</span>}
                      </p>
                    </div>
                  </div>
                  <button className="close-btn" style={{ background: 'var(--bg-input)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedStudent(null)}><X size={20} /></button>
                </div>

                {selectedStudent.loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                      <div className="spinner"></div><p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Building 360° Profile...</p>
                  </div>
                ) : selectedStudent.error ? (
                  <div className="error-state">
                      <AlertCircle size={40} style={{ margin: '0 auto 1rem auto' }} />
                      <h2 style={{ margin: '0 0 0.5rem 0', fontSize:'1.4rem' }}>Data Unavailable</h2>
                      <p style={{ margin: 0, fontSize:'0.9rem' }}>Failed to load profile. They may be missing registry data.</p>
                  </div>
                ) : (
                  <div className="modal-360-layout">
                    
                    <div className="m-sidebar">
                      <div className={`m-nav-item ${modalTab === 'profile' ? 'active' : ''}`} onClick={() => setModalTab('profile')}><UserCircle size={16}/> Registration Profile</div>
                      <div className={`m-nav-item ${modalTab === 'marks' ? 'active' : ''}`} onClick={() => setModalTab('marks')}><FileText size={16}/> Internal Results</div>
                      <div className={`m-nav-item ${modalTab === 'attendance' ? 'active' : ''}`} onClick={() => setModalTab('attendance')}><Activity size={16}/> Attendance Tracker</div>
                      <div className={`m-nav-item ${modalTab === 'support' ? 'active' : ''}`} onClick={() => setModalTab('support')}><HeartHandshake size={16}/> Mentorship & Support</div>
                      <div className={`m-nav-item ${modalTab === 'duty' ? 'active' : ''}`} onClick={() => setModalTab('duty')}><Award size={16}/> Official Duty Logs</div>
                    </div>

                    <div className="m-content-area premium-scroll">
                      
                      {modalTab === 'profile' && selectedStudent.profile && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          
                          {/* --- NEW ENHANCED ENROLLMENT & ACADEMIC BLOCK --- */}
                          <div className="fp-section" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', borderBottom: '1px solid rgba(99, 102, 241, 0.1)', paddingBottom: '8px', fontSize:'1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <BookOpen size={18} /> Academic & Enrollment Details
                            </h3>
                            <div className="fp-grid">
                              <div className="fp-field"><span className="fp-label">Roll Number</span><span className="fp-value">{selectedStudent.roll_number || "-"}</span></div>
                              <div className="fp-field"><span className="fp-label">Enrollment No.</span><span className="fp-value">{selectedStudent.enrollment_number || "Not Provided"}</span></div>
                              <div className="fp-field"><span className="fp-label">Class & Semester</span><span className="fp-value">{getYearLevel(selectedStudent.semester)} (Semester {selectedStudent.semester})</span></div>
                              <div className="fp-field"><span className="fp-label">Department</span><span className="fp-value">{selectedStudent.department_name || selectedStudent.department_code || "-"}</span></div>
                            </div>
                          </div>

                          <div className="fp-section">
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize:'1.05rem' }}>Personal & Official Data</h3>
                            <div className="fp-grid">
                              <div className="fp-field"><span className="fp-label"><Mail size={12} style={{display:'inline'}}/> Email</span><span className="fp-value">{selectedStudent.profile.email || "-"}</span></div>
                              <div className="fp-field"><span className="fp-label"><Phone size={12} style={{display:'inline'}}/> Mobile No.</span><span className="fp-value">{selectedStudent.profile.mobile_number || "-"}</span></div>
                              <div className="fp-field"><span className="fp-label"><Calendar size={12} style={{display:'inline'}}/> DOB / Gender</span><span className="fp-value">{selectedStudent.profile.dob || "-"} / {selectedStudent.profile.gender || "-"}</span></div>
                              <div className="fp-field"><span className="fp-label">AIC ID</span><span className="fp-value">{selectedStudent.profile.aic_id || "-"}</span></div>
                              <div className="fp-field"><span className="fp-label">Aadhaar No.</span><span className="fp-value">{selectedStudent.profile.aadhar_number ? `•••• ${String(selectedStudent.profile.aadhar_number).slice(-4)}` : "-"}</span></div>
                              <div className="fp-field"><span className="fp-label">Name on Aadhaar</span><span className="fp-value">{selectedStudent.profile.name_on_aadhar || "-"}</span></div>
                            </div>
                          </div>

                          <div className="fp-section">
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize:'1.05rem' }}>Address & Family</h3>
                            <div className="fp-grid">
                              <div className="fp-field" style={{ gridColumn: '1/-1' }}><span className="fp-label">Residential Address</span><span className="fp-value">{selectedStudent.profile.profile?.address || "-"}</span></div>
                              <div className="fp-field"><span className="fp-label">Father's Details</span><span className="fp-value">{selectedStudent.profile.profile?.father_name || "-"}<br/><span style={{fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:400}}>{selectedStudent.profile.profile?.father_contact || ""}</span></span></div>
                              <div className="fp-field"><span className="fp-label">Mother's Details</span><span className="fp-value">{selectedStudent.profile.profile?.mother_name || "-"}<br/><span style={{fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:400}}>{selectedStudent.profile.profile?.mother_contact || ""}</span></span></div>
                              <div className="fp-field"><span className="fp-label">Local Guardian</span><span className="fp-value">{selectedStudent.profile.profile?.guardian_name || "-"}<br/><span style={{fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:400}}>{selectedStudent.profile.profile?.guardian_contact || ""}</span></span></div>
                            </div>
                          </div>

                          <div className="fp-section">
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize:'1.05rem' }}>Extracurriculars & Remarks</h3>
                            <div className="fp-grid">
                              <div className="fp-field" style={{ gridColumn: '1/-1' }}><span className="fp-label">Hobbies & Interests</span><span className="fp-value">{selectedStudent.profile.profile?.hobbies || "-"}</span></div>
                              <div className="fp-field" style={{ gridColumn: '1/-1' }}><span className="fp-label">Achievements</span><span className="fp-value">{selectedStudent.profile.profile?.achievements || "-"}</span></div>
                              <div className="fp-field" style={{ gridColumn: '1/-1' }}><span className="fp-label">Official Remarks</span><span className="fp-value" style={{ color: '#ef4444' }}>{selectedStudent.profile.remarks || "-"}</span></div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {modalTab === 'marks' && selectedStudent.academics && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="fp-section">
                             <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', fontSize:'1.05rem' }}>Internal Assessment Marks ({activeTerm} Term)</h3>
                             {(!selectedStudent.academics.marks_subjects || selectedStudent.academics.marks_subjects.length === 0) ? (
                                <p className="text-muted" style={{ fontStyle: 'italic', fontSize:'0.9rem' }}>No internal tests recorded yet for this term.</p>
                             ) : (
                               <div style={{overflowX: 'auto'}}>
                               <table className="premium-table">
                                 <thead><tr><th>Subject</th><th style={{textAlign:'center'}}>IT 1</th><th style={{textAlign:'center'}}>IT 2</th><th style={{textAlign:'center'}}>IT 3</th><th style={{textAlign:'center'}}>Final</th><th style={{textAlign:'center'}}>Target</th><th style={{textAlign:'center'}}>Status</th></tr></thead>
                                 <tbody>
                                   {selectedStudent.academics.marks_subjects.map((sub, i) => {
                                       const evalData = evaluateMarks(sub.it1, sub.it2, sub.it3);
                                       const badgeStyle = getStatusColor(evalData.status);
                                       return (
                                         <tr key={i}>
                                           <td><div style={{fontWeight:600}}>{sub.subject_name}</div><div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>{sub.subject_code}</div></td>
                                           <td style={{textAlign:'center'}}>{sub.it1 !== null ? sub.it1 : "-"}</td>
                                           <td style={{textAlign:'center'}}>{sub.it2 !== null ? sub.it2 : "-"}</td>
                                           <td style={{textAlign:'center'}}>{sub.it3 !== null ? sub.it3 : "-"}</td>
                                           <td style={{textAlign:'center', fontWeight:'bold', fontSize:'1rem'}}>{evalData.conducted > 0 ? evalData.final_score : "-"}</td>
                                           <td style={{textAlign:'center', fontSize:'0.8rem', color:'var(--text-secondary)'}}>{evalData.req}</td>
                                           <td style={{textAlign:'center'}}><span className="s-badge" style={{background: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.bg}`}}>{evalData.status}</span></td>
                                         </tr>
                                       )
                                   })}
                                 </tbody>
                               </table>
                               </div>
                             )}
                          </div>
                        </motion.div>
                      )}

                      {modalTab === 'attendance' && selectedStudent.academics && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", padding: "1.25rem", background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))", borderRadius: "12px", border: "1px solid rgba(99,102,241,0.2)" }}>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem" }}>
                              <Activity size={28} color={selectedStudent.academics.overall_attendance.percentage < 75 ? "#ef4444" : "#10b981"} />
                              <div>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Overall Term Attendance</p>
                                <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: '1.8rem', fontWeight: 800 }}>{selectedStudent.academics.overall_attendance.percentage}%</h2>
                              </div>
                            </div>
                          </div>

                          <div className="fp-section" style={{ padding: 0, overflow: 'hidden' }}>
                             {(!selectedStudent.academics.attendance_subjects || selectedStudent.academics.attendance_subjects.length === 0) ? (
                                <p className="text-muted" style={{ fontStyle: 'italic', padding: '1.5rem', fontSize:'0.9rem' }}>No attendance sessions recorded yet for this term.</p>
                             ) : (
                               <div style={{overflowX: 'auto'}}>
                               <table className="premium-table">
                                 <thead style={{ background: 'var(--bg-input)' }}>
                                    <tr><th style={{paddingLeft:'1.25rem'}}>Subject</th><th>Teacher</th><th style={{textAlign:'center'}}>TA</th><th style={{textAlign:'center'}}>TC</th><th style={{textAlign:'center', paddingRight:'1.25rem'}}>%</th></tr>
                                 </thead>
                                 <tbody>
                                   {selectedStudent.academics.attendance_subjects.map((sub, i) => (
                                     <tr key={i}>
                                       <td style={{paddingLeft:'1.25rem'}}><div style={{fontWeight:600}}>{sub.subject_name}</div><div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>{sub.subject_code}</div></td>
                                       <td>{sub.faculty_name}</td>
                                       <td style={{textAlign:'center'}}>{sub.ta}</td>
                                       <td style={{textAlign:'center'}}>{sub.tc}</td>
                                       <td style={{textAlign:'center', paddingRight:'1.25rem', fontWeight:'bold', color: sub.percentage < 75 ? '#ef4444' : '#10b981'}}>{sub.percentage}%</td>
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                               </div>
                             )}
                          </div>
                        </motion.div>
                      )}

                      {modalTab === 'support' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="fp-section">
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '6px', fontSize:'1.05rem' }}><UserCircle size={18}/> Class Teacher</h3>
                            {selectedStudent.class_teacher ? (
                              <div style={{ background: 'var(--bg-input)', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                <UserCircle size={24} color="var(--primary-color)" />
                                <span style={{ fontWeight: '600', fontSize:'1rem' }}>{selectedStudent.class_teacher}</span>
                              </div>
                            ) : (
                              <p className="text-muted" style={{ fontStyle: 'italic', fontSize:'0.9rem', margin:0 }}>No class teacher assigned for this academic year.</p>
                            )}
                          </div>

                          <div className="fp-section">
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '6px', fontSize:'1.05rem' }}><ShieldCheck size={18}/> Assigned Mentors</h3>
                            {(!selectedStudent.mentors || selectedStudent.mentors.length === 0) ? (
                                <p className="text-muted" style={{ fontStyle: 'italic', fontSize:'0.9rem', margin:0 }}>No official mentor assigned yet.</p>
                            ) : (
                              <div className="fp-grid">
                                {selectedStudent.mentors.map((m, i) => (
                                  <div key={i} style={{ background: 'var(--bg-input)', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <ShieldCheck size={24} color="var(--primary-color)" />
                                    <span style={{ fontWeight: '600', fontSize:'1rem' }}>{m}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {modalTab === 'duty' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="fp-section">
                            <h3 style={{ color: 'var(--primary-color)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '6px', fontSize:'1.05rem' }}><Award size={18}/> Official Duty Leave Log</h3>
                            {(!selectedStudent.duty_leaves || selectedStudent.duty_leaves.length === 0) ? (
                                <p className="text-muted" style={{ fontStyle: 'italic', fontSize:'0.9rem', margin:0 }}>No Duty Leaves recorded for this student.</p>
                            ) : (
                              selectedStudent.duty_leaves.map((dl, i) => (
                                <div key={i} style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '10px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                  <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{dl.event}</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/> {dl.start} to {dl.end}</p>
                                  </div>
                                  <div>
                                    {dl.status === 'APPROVED' ? <span className="s-badge" style={{ background: '#10b981', color: 'white', borderColor: '#10b981' }}>Approved</span> :
                                     dl.status === 'REJECTED' ? <span className="s-badge" style={{ background: '#ef4444', color: 'white', borderColor: '#ef4444' }}>Rejected</span> :
                                     <span className="s-badge" style={{ background: '#f59e0b', color: 'white', borderColor: '#f59e0b' }}>Pending</span>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}

                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InstituteDashboard;