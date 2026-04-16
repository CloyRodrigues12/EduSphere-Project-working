import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { attendanceService, staffService } from "../services/api";
import { 
  Calendar, Clock, CheckCircle, XCircle, Plus, Users, 
  Search, X, ShieldAlert, Check, ChevronRight, FileText, UserCircle, Info, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import "./DutyLeaveDashboard.css"; 

// --- STATUS BADGE (Cleaned up, no tooltip here anymore) ---
const StatusBadge = ({ role, status, name }) => {
    const isApproved = status === 'APPROVED';
    const isRejected = status === 'REJECTED';
    const color = isApproved ? '#10b981' : isRejected ? '#ef4444' : '#f59e0b';
    const bg = isApproved ? 'rgba(16, 185, 129, 0.1)' : isRejected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';
    const Icon = isApproved ? CheckCircle : isRejected ? XCircle : Clock;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", background: bg, color: color, padding: "2px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "600", border: `1px solid ${color}40` }}>
            <Icon size={12} />
            <span>{role}: {status}</span>
            {name && name !== "Unassigned" && (
                <span style={{ opacity: 0.8, marginLeft: "2px", borderLeft: `1px solid ${color}60`, paddingLeft: "4px" }}>
                    {name}
                </span>
            )}
        </div>
    );
}

const DutyLeaveDashboard = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [activeTab, setActiveTab] = useState("PENDING"); 

  const isStudent = user?.role_code === "STUDENT";

  useEffect(() => { fetchLeaves(); }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getDutyLeaves();
      setLeaves(res.data);
    } catch (err) {
      console.error("Failed to fetch duty leaves", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId, participantId, action, stage) => {
    try {
      await attendanceService.processDutyLeaveAction({ request_id: requestId, participant_id: participantId, action: action, stage: stage });
      fetchLeaves(); 
    } catch (err) {
      alert("Failed to process action.");
    }
  };

  const getLeaveOverallStatus = (leave) => {
      if (leave.in_charge_status === 'REJECTED') return 'REJECTED';
      if (!leave.participants || leave.participants.length === 0) return leave.in_charge_status;

      const anyRejected = leave.participants.some(p => p.hod_status === 'REJECTED' || p.class_teacher_status === 'REJECTED');
      if (anyRejected) return 'REJECTED';

      const allApproved = leave.participants.every(p => p.hod_status === 'APPROVED');
      if ((leave.in_charge_status === 'APPROVED' || leave.in_charge_status === 'SKIPPED') && allApproved) {
          return 'APPROVED';
      }
      return 'PENDING';
  };

  const filteredLeaves = leaves.filter(leave => {
      if (activeTab === 'ALL') return true;
      return getLeaveOverallStatus(leave) === activeTab;
  });

  return (
    <div className="fade-in" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", color: "var(--text-primary)", margin: "0 0 0.25rem 0" }}>Official Duty (OD) Management</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
            {isStudent ? "Track and apply for duty leaves." : "Review and approve pending requests."}
          </p>
        </div>
        <button onClick={() => setShowApplyModal(true)} className="od-btn" style={{ background: "var(--primary-color)", color: "white", padding: "10px 20px", fontSize: "0.95rem" }}>
          <Plus size={18} /> {isStudent ? "Apply for OD" : "Initiate OD"}
        </button>
      </div>

      <div className="od-tabs-container">
          <button className={`od-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`} onClick={() => setActiveTab('ALL')}>All Requests</button>
          <button className={`od-tab-btn ${activeTab === 'PENDING' ? 'active' : ''}`} onClick={() => setActiveTab('PENDING')}>Action Required / Live</button>
          <button className={`od-tab-btn ${activeTab === 'APPROVED' ? 'active' : ''}`} onClick={() => setActiveTab('APPROVED')}>History: Approved</button>
          <button className={`od-tab-btn ${activeTab === 'REJECTED' ? 'active' : ''}`} onClick={() => setActiveTab('REJECTED')}>History: Rejected</button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: "5rem auto" }}></div>
      ) : filteredLeaves.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1.5rem", borderRadius: "16px", background: "var(--bg-card)", border: "1px dashed var(--border-color)" }}>
          <Calendar size={48} style={{ color: "var(--text-muted)", opacity: 0.4, margin: "0 auto 1rem auto" }} />
          <h3 style={{ color: "var(--text-primary)", margin: "0 0 0.5rem 0", fontSize: "1.2rem" }}>No Requests Found</h3>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>There are no official duty records in this category.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <AnimatePresence>
            {filteredLeaves.map(leave => {
              const statusClass = `status-${getLeaveOverallStatus(leave).toLowerCase()}`;
              return (
              <motion.div layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} key={leave.id} className={`od-card ${statusClass}`}>
                
                {/* --- CARD HEADER --- */}
                <div className="od-card-top">
                  <div className="od-card-title-group">
                    <h3 className="od-card-title">{leave.title}</h3>
                    <span className="od-date-pill">
                      <Calendar size={14} /> 
                      {new Date(leave.start_date).toLocaleDateString('en-GB')} {leave.start_date !== leave.end_date ? ` to ${new Date(leave.end_date).toLocaleDateString('en-GB')}` : ""}
                    </span>
                  </div>
                  
                  <div className="od-card-meta-row">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><UserCircle size={15}/> <strong>Initiator:</strong> {leave.initiator_name}</span>
                      
                      {leave.event_in_charge && (
                          <>
                             <span className="meta-divider">|</span>
                             <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><ShieldAlert size={15}/> <strong>In-Charge:</strong> {leave.event_in_charge_name}</span>
                             
                             {user?.id === leave.event_in_charge && leave.in_charge_status === 'PENDING' ? (
                                <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
                                    <button onClick={() => handleAction(leave.id, null, 'APPROVED', 'IN_CHARGE')} className="od-btn od-btn-approve">Approve</button>
                                    <button onClick={() => handleAction(leave.id, null, 'REJECTED', 'IN_CHARGE')} className="od-btn od-btn-reject">Reject</button>
                                </div>
                             ) : (
                                <div style={{ marginLeft: "auto" }}>
                                    <StatusBadge role="Approval" status={leave.in_charge_status} />
                                </div>
                             )}
                          </>
                      )}
                  </div>
                </div>

                {/* --- REASON BLOCK --- */}
                <div className="od-reason-box">
                    <FileText size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <p className="od-reason-text">"{leave.reason}"</p>
                </div>

                {/* --- PARTICIPANTS LIST --- */}
                <div className="od-participants-section">
                    <h4 className="od-section-title">Participants ({leave.participants.length})</h4>
                    <div className="od-participants-list">
                      {leave.participants.map(p => (
                          <div key={p.id} className="od-participant-row">
                              
                              {/* --- TOP RIGHT ABSOLUTE INFO BUTTON --- */}
                              {p.hod_status === 'APPROVED' && (
                                  <div className="od-tooltip-wrapper" style={{ position: "absolute", top: "12px", right: "14px" }}>
                                      <Info size={18} style={{ color: "#10b981", cursor: "pointer" }} />
                                      <div className="od-tooltip-content tooltip-right-align">
                                          <div style={{ fontWeight: "bold", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px", marginBottom: "4px" }}>
                                              Protected Lectures
                                          </div>
                                          {p.protected_sessions?.length > 0 ? (
                                              <ul className="protected-session-list">
                                                  {p.protected_sessions.map((sess, idx) => (
                                                      <li key={idx}>
                                                          <span className="ps-date">{sess.date}</span>
                                                          <span className="ps-subject" title={sess.subject}>{sess.subject}</span>
                                                      </li>
                                                  ))}
                                              </ul>
                                          ) : (
                                              <div style={{ color: "var(--text-muted)", marginTop: "6px", fontStyle: "italic", fontSize: "0.8rem" }}>
                                                  No attendance records found for these dates yet. They will be protected automatically.
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )}

                              <div className="od-participant-info">
                                  <div className="od-avatar">{p.student_name.charAt(0)}</div>
                                  <div>
                                      <div className="od-p-name">{p.student_name}</div>
                                      <div className="od-p-sub">{p.roll_number} • {p.department} Sem {p.semester}</div>
                                  </div>
                              </div>

                              <div className="od-participant-badges">
                                  <div className={`od-attendance-pill ${p.attendance_percentage >= 75 ? 'attd-good' : 'attd-bad'}`}>
                                      <Activity size={14}/> {p.attendance_percentage}% Attd.
                                  </div>
                                  <StatusBadge role="CT" status={p.class_teacher_status} name={p.class_teacher_name} />
                                  <StatusBadge role="HOD" status={p.hod_status} name={p.hod_name} />
                              </div>

                              {/* Action Buttons */}
                              {user?.role_code !== 'STUDENT' && (
                                  <div className="od-participant-actions">
                                      {user?.id === p.class_teacher_id && p.class_teacher_status === 'PENDING' && leave.in_charge_status !== 'PENDING' && (
                                          <>
                                              <button onClick={() => handleAction(leave.id, p.id, 'APPROVED', 'CLASS_TEACHER')} className="od-btn od-btn-approve">Approve</button>
                                              <button onClick={() => handleAction(leave.id, p.id, 'REJECTED', 'CLASS_TEACHER')} className="od-btn od-btn-reject"><X size={16}/></button>
                                          </>
                                      )}

                                      {(user?.id === p.hod_id || user?.role_code === 'SUPER_ADMIN') && p.hod_status === 'PENDING' && p.class_teacher_status === 'APPROVED' && (
                                          <>
                                              <button onClick={() => handleAction(leave.id, p.id, 'APPROVED', 'HOD')} className="od-btn od-btn-approve">Approve</button>
                                              <button onClick={() => handleAction(leave.id, p.id, 'REJECTED', 'HOD')} className="od-btn od-btn-reject"><X size={16}/></button>
                                          </>
                                      )}
                                  </div>
                              )}
                          </div>
                      ))}
                    </div>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* --- BULLETPROOF APPLICATION MODAL --- */}
      <AnimatePresence>
        {showApplyModal && (
          <ApplicationModal onClose={() => setShowApplyModal(false)} onRefresh={fetchLeaves} user={user} isStudent={isStudent} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: The Application Form Modal
// ==========================================
const ApplicationModal = ({ onClose, onRefresh, user, isStudent }) => {
  const [loading, setLoading] = useState(false);
  const [faculties, setFaculties] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [showInChargeModal, setShowInChargeModal] = useState(false);
  const [inChargeSearch, setInChargeSearch] = useState(""); 
  const [dateSelectionType, setDateSelectionType] = useState("single"); 

  const [formData, setFormData] = useState({
    title: "", reason: "", start_date: new Date().toISOString().split("T")[0], end_date: new Date().toISOString().split("T")[0], event_in_charge_id: "",
  });
  
  const [selectedStudents, setSelectedStudents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facRes, stuRes] = await Promise.all([ staffService.getOrganizationFaculties(), attendanceService.getDutyLeaveStudents() ]);
        setFaculties(facRes.data); setAllStudents(stuRes.data);
        if (isStudent && user) {
           const me = stuRes.data.find(s => s.id === user.id || s.user_id === user.id || s.full_name === user.name);
           if (me) setSelectedStudents([me]);
        }
      } catch (err) {}
    };
    fetchData();
  }, [isStudent, user]);

  const filteredStudents = allStudents.filter(s => 
    !selectedStudents.find(selected => selected.id === s.id) &&
    (s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) || s.roll_number?.toLowerCase().includes(studentSearch.toLowerCase()))
  ).slice(0, 5); 

  const toggleStudent = (student) => { setSelectedStudents(prev => [...prev, student]); setStudentSearch(""); };
  const removeStudent = (id) => {
    if (isStudent && (id === user.id || id === user.student_id)) return; 
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const handleDateTypeChange = (type) => {
      setDateSelectionType(type);
      if (type === 'single') setFormData(prev => ({ ...prev, end_date: prev.start_date }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedStudents.length === 0) return alert("You must add at least one participant.");
    if (isStudent && !formData.event_in_charge_id) return alert("Students must select an Event In-Charge to verify the OD.");
    if (dateSelectionType === 'multiple' && formData.end_date < formData.start_date) return alert("End Date cannot be earlier than the Start Date.");

    setLoading(true);
    try {
      const payload = { ...formData, end_date: dateSelectionType === 'single' ? formData.start_date : formData.end_date, student_ids: selectedStudents.map(s => s.id) };
      await attendanceService.submitDutyLeave(payload);
      onRefresh(); onClose();
    } catch (err) { alert("Failed to submit request."); setLoading(false); }
  };

  const searchedFaculties = faculties.filter(f => (f.full_name || f.name || "").toLowerCase().includes(inChargeSearch.toLowerCase()) || (f.department_name || "").toLowerCase().includes(inChargeSearch.toLowerCase()));
  const sportsAndCounsellors = searchedFaculties.filter(f => ["SPORTS_STAFF", "COUNSELLOR"].includes(f.role_code || f.role));
  const hods = searchedFaculties.filter(f => (f.role_code || f.role) === "HOD");
  const teachers = searchedFaculties.filter(f => !["SPORTS_STAFF", "COUNSELLOR", "HOD"].includes(f.role_code || f.role));
  const labelStyle = { display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" };

  return createPortal(
    <div className="od-modal-overlay fade-in">
      <motion.div className="od-modal-content" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
        
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-main)", borderRadius: "16px 16px 0 0" }}>
          <div><h3 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>Submit Duty Request</h3><p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Fill details to route for approval.</p></div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div style={{ marginBottom: "1.2rem" }}><label style={labelStyle}>Event Title</label><input type="text" required placeholder="e.g., Inter-College Football Tournament" className="od-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>

          <div style={{ marginBottom: "1.2rem", background: "var(--bg-main)", padding: "12px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <button type="button" onClick={() => handleDateTypeChange("single")} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: dateSelectionType === "single" ? "none" : "1px solid var(--border-color)", background: dateSelectionType === "single" ? "var(--primary-color)" : "transparent", color: dateSelectionType === "single" ? "white" : "var(--text-secondary)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Single Day</button>
                  <button type="button" onClick={() => handleDateTypeChange("multiple")} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: dateSelectionType === "multiple" ? "none" : "1px solid var(--border-color)", background: dateSelectionType === "multiple" ? "var(--primary-color)" : "transparent", color: dateSelectionType === "multiple" ? "white" : "var(--text-secondary)", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Multiple Days</button>
              </div>

              {dateSelectionType === "single" ? (
                  <div><label style={labelStyle}>Date of Event</label><input type="date" required className="od-input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value, end_date: e.target.value})} /></div>
              ) : (
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div style={{ flex: 1 }}><label style={labelStyle}>Start Date</label><input type="date" required className="od-input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} /></div>
                    <div style={{ flex: 1 }}><label style={labelStyle}>End Date</label><input type="date" required min={formData.start_date} className="od-input" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} /></div>
                  </div>
              )}
          </div>

          <div style={{ marginBottom: "1.2rem" }}><label style={labelStyle}>Event Details / Reason</label><textarea required rows="2" placeholder="Briefly describe the purpose of this duty leave..." className="od-input" style={{resize: "vertical"}} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} /></div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Event In-Charge {isStudent ? "" : "(Optional)"}</label>
            <div onClick={() => setShowInChargeModal(true)} className="od-input" style={{cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: formData.event_in_charge_id ? "var(--bg-card)" : "var(--bg-input)"}}>
              <span style={{ color: formData.event_in_charge_id ? "var(--text-primary)" : "var(--text-muted)", fontWeight: formData.event_in_charge_id ? "600" : "normal" }}>
                {formData.event_in_charge_id ? faculties.find(f => f.id === parseInt(formData.event_in_charge_id))?.full_name || faculties.find(f => f.id === parseInt(formData.event_in_charge_id))?.name : "-- Click to Select Supervising Faculty/Staff --"}
              </span><ChevronRight size={18} style={{ color: "var(--text-muted)" }}/>
            </div>
          </div>

          <div style={{ padding: "16px", background: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <label style={{...labelStyle, display: "flex", alignItems: "center", gap: "6px"}}><Users size={16}/> Tag Participants</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "10px", background: "var(--bg-input)", borderRadius: "8px", border: "1px solid var(--border-color)", minHeight: "45px", marginBottom: "12px" }}>
               {selectedStudents.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Search below to add students...</span>}
               {selectedStudents.map(student => (
                  <div key={student.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--primary-color)", color: "white", padding: "4px 10px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: "500" }}>
                     {student.full_name || student.name}<X size={14} style={{ cursor: "pointer", opacity: 0.8 }} onClick={() => removeStudent(student.id)} />
                  </div>
               ))}
            </div>

            <div style={{ position: "relative" }}>
               <div style={{ display: "flex", alignItems: "center", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "0 10px" }}>
                  <Search size={18} style={{ color: "var(--text-muted)" }} /><input type="text" placeholder="Search friends by name or roll number..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={{ border: "none", background: "transparent", width: "100%", padding: "10px", outline: "none", color: "var(--text-primary)" }} />
               </div>
               {studentSearch.length > 1 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", marginTop: "5px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", zIndex: 10, overflow: "hidden" }}>
                     {filteredStudents.length === 0 ? (
                        <div style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No matching students found</div>
                     ) : filteredStudents.map(s => (
                        <div key={s.id} onClick={() => toggleStudent(s)} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                           <div><div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>{s.full_name || s.name}</div><div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>{s.roll_number} • {s.department?.code || "Dept"}</div></div><Plus size={18} style={{ color: "var(--primary-color)" }}/>
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>

          <div style={{ marginTop: "2rem", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
            <button type="submit" disabled={loading || selectedStudents.length === 0} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "var(--primary-color)", color: "white", cursor: loading ? "not-allowed" : "pointer", fontWeight: "600", opacity: loading || selectedStudents.length === 0 ? 0.7 : 1 }}>{loading ? "Submitting..." : "Submit Application"}</button>
          </div>
        </form>

        {/* --- NESTED IN-CHARGE SELECTION MODAL --- */}
        <AnimatePresence>
            {showInChargeModal && (
                <div className="od-modal-overlay" style={{ zIndex: 10001 }}>
                    <motion.div className="od-modal-content" style={{ maxWidth: "500px" }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-main)", borderRadius: "16px 16px 0 0" }}>
                            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem" }}>Select Event In-Charge</h3>
                            <button type="button" onClick={() => { setShowInChargeModal(false); setInChargeSearch(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: "16px 20px 0 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "0 10px" }}>
                                <Search size={18} style={{ color: "var(--text-muted)" }} /><input type="text" placeholder="Search by name or department..." value={inChargeSearch} onChange={(e) => setInChargeSearch(e.target.value)} style={{ border: "none", background: "transparent", width: "100%", padding: "10px", outline: "none", color: "var(--text-primary)" }} />
                            </div>
                        </div>
                        <div style={{ padding: "20px", maxHeight: "55vh", overflowY: "auto" }}>
                            {searchedFaculties.length === 0 ? ( <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No faculty found matching "{inChargeSearch}"</div> ) : (
                                <>
                                    {sportsAndCounsellors.length > 0 && (
                                        <div style={{ marginBottom: "1.5rem" }}><h4 style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>Sports & Event Staff</h4>
                                            <div style={{ display: "grid", gap: "8px" }}>
                                                {sportsAndCounsellors.map(f => (
                                                    <div key={f.id} onClick={() => { setFormData({...formData, event_in_charge_id: f.id}); setShowInChargeModal(false); setInChargeSearch(""); }} style={{ padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                                                        <div><div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>{f.full_name || f.name}</div><div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{f.designation || "Staff"} • {f.department_name || "Campus"}</div></div>{formData.event_in_charge_id === f.id && <Check size={18} style={{ color: "var(--primary-color)" }}/>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {hods.length > 0 && (
                                        <div style={{ marginBottom: "1.5rem" }}><h4 style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>Heads of Department</h4>
                                            <div style={{ display: "grid", gap: "8px" }}>
                                                {hods.map(f => (
                                                    <div key={f.id} onClick={() => { setFormData({...formData, event_in_charge_id: f.id}); setShowInChargeModal(false); setInChargeSearch(""); }} style={{ padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                                                        <div><div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>{f.full_name || f.name}</div><div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{f.department_name || "Department"}</div></div>{formData.event_in_charge_id === f.id && <Check size={18} style={{ color: "var(--primary-color)" }}/>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {teachers.length > 0 && (
                                        <div style={{ marginBottom: "1.5rem" }}><h4 style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>Teaching Faculty</h4>
                                            <div style={{ display: "grid", gap: "8px" }}>
                                                {teachers.map(f => (
                                                    <div key={f.id} onClick={() => { setFormData({...formData, event_in_charge_id: f.id}); setShowInChargeModal(false); setInChargeSearch(""); }} style={{ padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                                                        <div><div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>{f.full_name || f.name}</div><div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{f.department_name || "Department"}</div></div>{formData.event_in_charge_id === f.id && <Check size={18} style={{ color: "var(--primary-color)" }}/>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body 
  );
};

export default DutyLeaveDashboard;