import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { resultsService, academicService } from "../services/api";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Save, Download, CheckCircle, AlertTriangle } from "lucide-react";

import "./InternalAssessment.css";
// --- THE PREDICTIVE MATH ENGINE (ROUNDED UP) ---
export const evaluateMarks = (it1, it2, it3) => {
  const marks = [it1, it2, it3].filter(m => m !== null && m !== undefined && m !== "");
  const numMarks = marks.map(m => parseFloat(m));
  const c = numMarks.length;

  let final_score = 0;
  let status = "PENDING";
  let req = "-";
  let is_passing = false;

  // Because we round UP (Math.ceil), a sum of 19.0 divided by 2 is 9.5, which rounds to 10.
  // Therefore, the absolute target sum needed to pass is now 19.
  const TARGET_SUM = 19; 

  if (c === 0) {
    req = `${TARGET_SUM} total`;
  } else if (c === 1) {
    // Math.ceil rounds up to the nearest whole number
    final_score = Math.ceil(numMarks[0] / 2);
    is_passing = final_score >= 10;
    
    const needed = TARGET_SUM - numMarks[0];
    if (needed <= 0) {
        status = "SECURED";
        req = "-";
    } else {
        status = needed <= 15 ? "ON TRACK" : "NEEDS EFFORT";
        req = `${needed} in next IT`;
    }
  } else if (c === 2) {
    numMarks.sort((a, b) => b - a);
    const sum = numMarks[0] + numMarks[1];
    
    // Round up the average
    final_score = Math.ceil(sum / 2);
    is_passing = final_score >= 10;

    if (sum >= TARGET_SUM) {
       status = "SECURED";
       req = "-";
    } else {
       // Target is 19. We subtract their highest score to see what they need to replace the lowest with.
       const neededInThird = TARGET_SUM - numMarks[0]; 
       if (neededInThird <= 25) {
         status = "CRITICAL";
         req = `${neededInThird} in IT3`;
       } else {
         status = "FAILING";
         req = "Impossible";
       }
    }
  } else if (c === 3) {
    numMarks.sort((a, b) => b - a);
    const sum = numMarks[0] + numMarks[1];
    
    // Round up the final average
    final_score = Math.ceil(sum / 2);
    is_passing = final_score >= 10;
    status = is_passing ? "CLEARED" : "FAILED";
    req = "-";
  }

  return { final_score, is_passing, status, req, conducted: c };
};
export const getStatusColor = (status) => {
  switch(status) {
    case "SECURED": case "CLEARED": case "All Clear": return { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981" };
    case "ON TRACK": case "On Track": return { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" };
    case "NEEDS EFFORT": case "CRITICAL": case "At Risk": return { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b" };
    case "FAILING": case "FAILED": case "Failing": return { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" };
    default: return { bg: "#f3f4f6", text: "#6b7280" }; // PENDING
  }
};

const InternalAssessment = () => {
  const { user } = useAuth();
  const { activeAcademicYear, activeTerm } = useAcademic();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  useEffect(() => {
    if (activeAcademicYear && activeTerm) loadClasses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeTerm]);

  const loadClasses = async () => {
    try {
      const res = await resultsService.getAssessmentAllocations(activeAcademicYear.id, activeTerm);
      const processedData = res.data.map(c => {
        const sem = c.semester;
        let yl = "FE";
        if (sem > 2) yl = "SE";
        if (sem > 4) yl = "TE";
        if (sem > 6) yl = "BE";

        return {
          ...c,
          class_label: `${yl} ECS`,
          display_faculty: c.faculty_name 
            ? (c.faculty_name.startsWith("Prof.") ? c.faculty_name : `Prof. ${c.faculty_name}`) 
            : "Faculty"
        };
      });
      setClasses(processedData);
    } catch (err) {
      console.error("Error loading classes:", err);
    }
  };

  const loadMarksheet = async(allocation) => {
    setSelectedClass(allocation);
    setLoading(true);

    try {
      const res = await resultsService.getMarksheet(allocation.id, activeTerm);
      const processedStudents = res.data.map(student => {
        const evalData = evaluateMarks(student.it1, student.it2, student.it3);
        return {
          ...student,
          ...evalData
        };
      });
      setStudents(processedStudents);
    } catch(err) {
      console.log("Error loading marks", err);
    }
    setLoading(false);
  };

  const handleMarkChange = (targetStudentId, field, value) => {
    let rawValue = value;
    if (rawValue !== "") {
      if (parseFloat(rawValue) > 25) rawValue = "25";
      if (parseFloat(rawValue) < 0) rawValue = "0";
    }

    setStudents(prev => prev.map(s => {
      if (s.student === targetStudentId) {
        const updated = { ...s, [field]: rawValue === "" ? null : rawValue };
        const evalData = evaluateMarks(updated.it1, updated.it2, updated.it3);
        return { ...updated, ...evalData };
      }
      return s;
    }));
  };

  const handleSave = async () => {
    try {
      const payloadStudents = students.map(s => ({
        ...s,
        it1: (s.it1 === null || s.it1 === "") ? null : Number(s.it1),
        it2: (s.it2 === null || s.it2 === "") ? null : Number(s.it2),
        it3: (s.it3 === null || s.it3 === "") ? null : Number(s.it3),
      }));

      await resultsService.saveMarks({
        allocation_id: selectedClass.id,
        term: activeTerm,
        marks: payloadStudents
      });
      showToast("Marks saved successfully!", "success");
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to save marks.", "error");
    }
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Edusphere - Internal Assessment Report", 14, 20);
    doc.setFontSize(14);
    doc.text(`INTERNAL ASSESSMENT: ${selectedClass.subject_name}`, 14, 32);
    doc.setFontSize(11);
    doc.text(`Subject Code: ${selectedClass.course_code || selectedClass.subject_code || "-"}`, 14, 44);
    const branchName = selectedClass.branch || (selectedClass.class_name ? selectedClass.class_name.split(' ').pop() : "ECS");
    doc.text(`Branch: ${branchName}`, 14, 52);
    doc.text(`Semester: ${selectedClass.semester}`, 14, 60);
    doc.text(`Faculty: ${selectedClass.faculty_name || "Faculty"}`, 14, 68);
    doc.text(`Batch: ${selectedClass.group_name}`, 14, 76);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 84);
    doc.line(14, 90, 196, 90);

    const columns = ["Sr", "Roll No", "Student Name", "IT1", "IT2", "IT3", "Final Avg", "Status"];
    const rows = students.map((s,i) => [
      i+1,
      s.roll_number || s.student_roll_number,
      s.student_name,
      s.it1 !== null ? s.it1 : "-",
      s.it2 !== null ? s.it2 : "-",
      s.it3 !== null ? s.it3 : "-",
      s.conducted > 0 ? s.final_score : "-", 
      s.status
    ]);

    autoTable(doc, {
      startY: 95,
      head: [columns],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
    });
    doc.save(`${selectedClass.subject_name}_Internal_Report.pdf`);
  };

  if (!selectedClass) {
    return (
      <div id="attendance-engine-root" className="fade-in">
        <div className="att-header-section">
          <h1 className="att-title">Internal Assessment</h1>
          <p className="att-subtitle">
            {user?.role_code === "ORG_ADMIN"
              ? "College-wide subject directory (Administration View)"
              : "Select a class to record or view internal marks"}
          </p>
        </div>

        <div className="att-grid-layout mt-6">
          {classes.map((c) => (
            <motion.div key={c.id} className="att-card att-card-mine" whileHover={{ y: -5 }} onClick={() => loadMarksheet(c)} style={{ cursor: "pointer" }}>
              <div className="att-card-icon"><div className="icon-box">📖</div></div>
              <div className="att-card-details">
                <h3 className="text-xl font-bold">{c.subject_name}</h3>
                <div className="tags">
                  <span className="tag">{c.class_label}</span>
                  <span className="tag purple">Sem {c.semester}</span>
                </div>
                <p className="group">{c.class_name} • {c.group_name}</p>
                <div className="att-prof-badge"><span role="img" aria-label="teacher">👨‍🏫</span> {c.display_faculty}</div>
              </div>
              <button className="att-btn att-btn-primary mt-4">Select Class</button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="attendance-engine-root" className="assessment-container fade-in">
      <div className={`toast-notification ${toast.type} ${toast.show ? "show" : ""}`}>
        {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
        <span>{toast.message}</span>
      </div>
      
      <div className="att-header-section with-back" style={{ marginBottom: '2rem' }}>
        <button className="att-back-btn" onClick={() => setSelectedClass(null)}><ArrowLeft size={24} /></button>
        <div style={{ flex: 1 }}>
          <h1 className="att-title" style={{ margin: 0 }}>{selectedClass.subject_name} </h1>
          <p className="att-subtitle" style={{ margin: 0 }}>
            {selectedClass.class_name && selectedClass.class_name !== "undefined" 
              ? selectedClass.class_name 
              : (selectedClass.department_code || "BE ECS")
            } • {selectedClass.group_name} • Internal Assessment
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="att-btn att-btn-secondary" onClick={handleDownloadReport}><Download size={16} /> Cumulative Master Report</button>
          {user?.role_code === "FACULTY" && (
            <button className="att-btn att-btn-primary" onClick={handleSave}><Save size={16} /> Save Progress</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loader">Loading students...</div>
      ) : (
        <>
          {/* --- NEW SWIPE HINT --- */}
          <div className="mobile-swipe-hint">
            <span>← Swipe table to view all columns →</span>
          </div>
        
        <div className="table-wrapper">
          <table className="marks-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Roll No</th>
                <th>Student Name</th>
                <th style={{textAlign: "center"}}>IT1 (25)</th>
                <th style={{textAlign: "center"}}>IT2 (25)</th>
                <th style={{textAlign: "center"}}>IT3 (25)</th>
                <th style={{textAlign: "center"}}>Current Avg</th>
                <th style={{textAlign: "center"}}>Target</th>
                <th style={{textAlign: "center"}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, index) => {
                const badgeStyle = getStatusColor(s.status);
                
                return (
                  <tr key={s.student}>
                    <td>{index + 1}</td>
                    <td className="font-medium">{s.roll_number}</td>
                    <td className="font-medium">{s.student_name}</td>

                    <td style={{textAlign: "center"}}>
                      <input
                        className="standard-input"
                        style={{ width: "70px", textAlign: "center", margin: "0 auto" }}
                        type="number"
                        min="0" max="25" step="0.5"
                        value={s.it1 ?? ""}
                        disabled={user?.role_code !== "FACULTY"}
                        onWheel={(e) => e.target.blur()} 
                        onChange={(e) => handleMarkChange(s.student, "it1", e.target.value)}
                      />
                    </td>

                    <td style={{textAlign: "center"}}>
                      <input
                        className="standard-input"
                        style={{ width: "70px", textAlign: "center", margin: "0 auto" }}
                        type="number"
                        min="0" max="25" step="0.5"
                        value={s.it2 ?? ""}
                        disabled={user?.role_code !== "FACULTY"}
                        onWheel={(e) => e.target.blur()} 
                        onChange={(e) => handleMarkChange(s.student, "it2", e.target.value)}
                      />
                    </td>

                    <td style={{textAlign: "center"}}>
                      <input
                        className="standard-input"
                        style={{ width: "70px", textAlign: "center", margin: "0 auto" }}
                        type="number"
                        min="0" max="25" step="0.5"
                        value={s.it3 ?? ""}
                        disabled={user?.role_code !== "FACULTY"}
                        onWheel={(e) => e.target.blur()} 
                        onChange={(e) => handleMarkChange(s.student, "it3", e.target.value)}
                      />
                    </td>
                    
                    <td style={{ textAlign: "center", fontSize: "1.1rem" }}>
                      <strong>{s.conducted > 0 ? s.final_score : "-"}</strong>
                    </td>
                    
                    <td style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                      {s.req}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <span className="badge" style={{ background: badgeStyle.bg, color: badgeStyle.text, padding: "6px 12px" }}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div></>
      )}
    </div>
    
  );
  
};


export default InternalAssessment;