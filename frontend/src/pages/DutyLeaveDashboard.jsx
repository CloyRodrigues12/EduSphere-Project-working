import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { attendanceService, staffService } from "../services/api";
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertTriangle, 
  Plus, Users, Search, X, ShieldAlert, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const DutyLeaveDashboard = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const isStudent = user?.role_code === "STUDENT";

  useEffect(() => {
    fetchLeaves();
  }, []);

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
      await attendanceService.processDutyLeaveAction({
        request_id: requestId,
        participant_id: participantId,
        action: action, 
        stage: stage    
      });
      fetchLeaves(); 
    } catch (err) {
      alert("Failed to process action.");
    }
  };

  return (
    <div className="fade-in" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>Official Duty (OD) Management</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            {isStudent ? "Track and apply for sports, cultural, or technical duty leaves." : "Review and approve pending duty leave requests."}
          </p>
        </div>
        <button 
          onClick={() => setShowApplyModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--primary-color)", color: "white", padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "600", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)" }}
        >
          <Plus size={18} /> {isStudent ? "Apply for OD" : "Initiate OD for Students"}
        </button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: "5rem auto" }}></div>
      ) : leaves.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <Calendar size={48} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
          <h3 style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}>No Duty Leaves Found</h3>
          <p style={{ color: "var(--text-secondary)" }}>There are no active or pending official duty requests at the moment.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {leaves.map(leave => (
            <div key={leave.id} style={{ padding: "1.5rem", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderLeft: `6px solid ${leave.in_charge_status === 'APPROVED' ? '#10b981' : '#f59e0b'}`, boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontSize: "1.25rem" }}>{leave.title}</h3>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem" }}>{leave.reason}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary-color)", fontWeight: "600", marginBottom: "6px", background: "rgba(79, 70, 229, 0.1)", padding: "4px 12px", borderRadius: "20px" }}>
                    <Calendar size={14} /> 
                    {new Date(leave.start_date).toLocaleDateString('en-GB')} {leave.start_date !== leave.end_date ? ` to ${new Date(leave.end_date).toLocaleDateString('en-GB')}` : ""}
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Initiated by {leave.initiator_name}</span>
                </div>
              </div>

              {leave.event_in_charge && (
                <div style={{ background: "var(--bg-input)", padding: "12px 15px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <ShieldAlert size={18} style={{ color: "var(--text-muted)" }}/>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                      <strong>Event In-Charge:</strong> {leave.event_in_charge_name}
                    </span>
                  </div>
                  
                  {user?.id === leave.event_in_charge && leave.in_charge_status === 'PENDING' ? (
                     <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => handleAction(leave.id, null, 'APPROVED', 'IN_CHARGE')} style={{ padding: "6px 14px", fontSize: "0.85rem", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Approve</button>
                        <button onClick={() => handleAction(leave.id, null, 'REJECTED', 'IN_CHARGE')} style={{ padding: "6px 14px", fontSize: "0.85rem", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Reject</button>
                     </div>
                  ) : (
                    <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", background: leave.in_charge_status === 'APPROVED' ? "rgba(16, 185, 129, 0.1)" : leave.in_charge_status === 'REJECTED' ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)", color: leave.in_charge_status === 'APPROVED' ? "#10b981" : leave.in_charge_status === 'REJECTED' ? "#ef4444" : "#f59e0b" }}>
                      STATUS: {leave.in_charge_status}
                    </span>
                  )}
                </div>
              )}

              <div>
                <h4 style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600" }}>Participants ({leave.participants.length})</h4>
                <div style={{ display: "grid", gap: "12px" }}>
                  {leave.participants.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-main)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                      <div>
                        <div style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "0.95rem" }}>{p.student_name} <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "normal" }}>({p.roll_number})</span></div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>{p.department} • Semester {p.semester}</div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <div style={{ display: "flex", gap: "15px", fontSize: "0.8rem", fontWeight: "500" }}>
                           <span style={{ color: p.class_teacher_status === 'APPROVED' ? '#10b981' : p.class_teacher_status === 'REJECTED' ? '#ef4444' : 'var(--text-muted)', display: "flex", alignItems: "center", gap: "4px" }}>
                             CT: {p.class_teacher_status}
                           </span>
                           <span style={{ color: p.hod_status === 'APPROVED' ? '#10b981' : p.hod_status === 'REJECTED' ? '#ef4444' : 'var(--text-muted)', display: "flex", alignItems: "center", gap: "4px" }}>
                             HOD: {p.hod_status}
                           </span>
                        </div>

                        {/* CT ACTION BUTTONS (Bulletproof Visibility Check) */}
                        {user?.role_code !== 'STUDENT' && p.class_teacher_status === 'PENDING' && leave.in_charge_status !== 'PENDING' && (
                           <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => handleAction(leave.id, p.id, 'APPROVED', 'CLASS_TEACHER')} style={{ padding: "6px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Approve as Class Teacher"><CheckCircle size={16}/></button>
                              <button onClick={() => handleAction(leave.id, p.id, 'REJECTED', 'CLASS_TEACHER')} style={{ padding: "6px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Reject as Class Teacher"><XCircle size={16}/></button>
                           </div>
                        )}

                        {/* HOD ACTION BUTTONS */}
                        {(user?.role_code === 'HOD' || user?.role_code === 'SUPER_ADMIN') && p.hod_status === 'PENDING' && p.class_teacher_status === 'APPROVED' && (
                           <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => handleAction(leave.id, p.id, 'APPROVED', 'HOD')} style={{ padding: "6px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Final HOD Approval"><CheckCircle size={16}/></button>
                              <button onClick={() => handleAction(leave.id, p.id, 'REJECTED', 'HOD')} style={{ padding: "6px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Final HOD Rejection"><XCircle size={16}/></button>
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- BULLETPROOF APPLICATION MODAL --- */}
      <AnimatePresence>
        {showApplyModal && (
          <ApplicationModal 
            onClose={() => setShowApplyModal(false)} 
            onRefresh={fetchLeaves} 
            user={user} 
            isStudent={isStudent} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: The Application Form
// ==========================================
const ApplicationModal = ({ onClose, onRefresh, user, isStudent }) => {
  const [loading, setLoading] = useState(false);
  const [faculties, setFaculties] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  
  const [studentSearch, setStudentSearch] = useState("");
  
  const [formData, setFormData] = useState({
    title: "",
    reason: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    event_in_charge_id: "",
  });
  
  const [selectedStudents, setSelectedStudents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facRes, stuRes] = await Promise.all([
          staffService.getOrganizationFaculties(),
          attendanceService.getDutyLeaveStudents() // <-- FIXED: Pointing to the new secure endpoint
        ]);
        setFaculties(facRes.data);
        setAllStudents(stuRes.data);

        // Auto-add the student creating the request
        if (isStudent && user) {
           const me = stuRes.data.find(s => s.id === user.id || s.user_id === user.id || s.full_name === user.name);
           if (me) setSelectedStudents([me]);
        }
      } catch (err) {
        console.error("Failed to load options", err);
      }
    };
    fetchData();
  }, [isStudent, user]);

  const filteredStudents = allStudents.filter(s => 
    !selectedStudents.find(selected => selected.id === s.id) &&
    (s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
     s.roll_number?.toLowerCase().includes(studentSearch.toLowerCase()))
  ).slice(0, 5); 

  const toggleStudent = (student) => {
    setSelectedStudents(prev => [...prev, student]);
    setStudentSearch(""); 
  };

  const removeStudent = (id) => {
    if (isStudent && (id === user.id || id === user.student_id)) return; 
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedStudents.length === 0) return alert("You must add at least one participant.");
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        student_ids: selectedStudents.map(s => s.id)
      };
      await attendanceService.submitDutyLeave(payload);
      onRefresh();
      onClose();
    } catch (err) {
      alert("Failed to submit request. Please try again.");
      setLoading(false);
    }
  };

  // STRICT INLINE CSS FOR THE OVERLAY TO PREVENT INLINE RENDERING
  const overlayStyle = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "1rem"
  };

  const modalStyle = {
    background: "var(--bg-card)", width: "100%", maxWidth: "600px",
    borderRadius: "16px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
    maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)",
    position: "relative"
  };

  const inputStyle = {
    width: "100%", padding: "10px", borderRadius: "8px", 
    border: "1px solid var(--border-color)", background: "var(--bg-input)", 
    color: "var(--text-primary)", fontSize: "0.95rem", outline: "none"
  };

  const labelStyle = {
    display: "block", marginBottom: "6px", fontSize: "0.85rem", 
    fontWeight: "600", color: "var(--text-secondary)"
  };

  return createPortal(
    <div style={overlayStyle}>
      <motion.div style={modalStyle} initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
        
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-main)", borderRadius: "16px 16px 0 0" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "var(--text-primary)" }}>Submit Duty Request</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>Fill details to route for approval.</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div style={{ marginBottom: "1.2rem" }}>
            <label style={labelStyle}>Event Title</label>
            <input type="text" required placeholder="e.g., Inter-College Football Tournament" style={inputStyle} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
          </div>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.2rem" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Start Date</label>
              <input type="date" required style={inputStyle} value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>End Date</label>
              <input type="date" required min={formData.start_date} style={inputStyle} value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
            </div>
          </div>

          <div style={{ marginBottom: "1.2rem" }}>
            <label style={labelStyle}>Event Details / Reason</label>
            <textarea required rows="2" placeholder="Briefly describe the purpose of this duty leave..." style={{...inputStyle, resize: "vertical"}} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Event In-Charge (Optional if initiated by Faculty)</label>
            <select required={isStudent} style={inputStyle} value={formData.event_in_charge_id} onChange={e => setFormData({...formData, event_in_charge_id: e.target.value})}>
              <option value="">-- Select Supervising Faculty/Staff --</option>
              {faculties.map(f => <option key={f.id} value={f.id}>{f.full_name || f.name}</option>)}
            </select>
          </div>

          {/* STUDENT TAGGING SYSTEM */}
          <div style={{ padding: "16px", background: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <label style={{...labelStyle, display: "flex", alignItems: "center", gap: "6px"}}><Users size={16}/> Tag Participants</label>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "10px", background: "var(--bg-input)", borderRadius: "8px", border: "1px solid var(--border-color)", minHeight: "45px", marginBottom: "12px" }}>
               {selectedStudents.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Search below to add students...</span>}
               {selectedStudents.map(student => (
                  <div key={student.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--primary-color)", color: "white", padding: "4px 10px", borderRadius: "16px", fontSize: "0.8rem", fontWeight: "500" }}>
                     {student.full_name || student.name}
                     <X size={14} style={{ cursor: "pointer", opacity: 0.8 }} onClick={() => removeStudent(student.id)} />
                  </div>
               ))}
            </div>

            <div style={{ position: "relative" }}>
               <div style={{ display: "flex", alignItems: "center", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "0 10px" }}>
                  <Search size={18} style={{ color: "var(--text-muted)" }} />
                  <input type="text" placeholder="Search friends by name or roll number..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={{ border: "none", background: "transparent", width: "100%", padding: "10px", outline: "none", color: "var(--text-primary)" }} />
               </div>

               {studentSearch.length > 1 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", marginTop: "5px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", zIndex: 10, overflow: "hidden" }}>
                     {filteredStudents.length === 0 ? (
                        <div style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>No matching students found</div>
                     ) : filteredStudents.map(s => (
                        <div key={s.id} onClick={() => toggleStudent(s)} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <div>
                              <div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)" }}>{s.full_name || s.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>{s.roll_number} • {s.department?.code || "Dept"}</div>
                           </div>
                           <Plus size={18} style={{ color: "var(--primary-color)" }}/>
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>

          <div style={{ marginTop: "2rem", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
            <button type="submit" disabled={loading || selectedStudents.length === 0} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "var(--primary-color)", color: "white", cursor: loading ? "not-allowed" : "pointer", fontWeight: "600", opacity: loading || selectedStudents.length === 0 ? 0.7 : 1 }}>
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
};

export default DutyLeaveDashboard;