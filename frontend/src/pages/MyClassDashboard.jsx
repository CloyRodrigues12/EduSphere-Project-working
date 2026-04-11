import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { assignmentService } from "../services/api";
import { Users, AlertTriangle, CheckCircle, ShieldAlert, Search, Presentation, Download, X, Activity, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./MyClassDashboard.css";

const MyClassDashboard = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState("attendance"); // 'attendance' or 'marks'

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (activeAcademicYear && activeTerm) fetchDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeTerm]);

  const fetchDashboard = async () => {
    setLoading(true);
    setSelectedStudent(null); 
    try {
      const res = await assignmentService.getMyClassDashboard(activeAcademicYear.id, activeTerm);
      const rawStudents = res.data.students || [];

      // Recalculate real % safely
      const processedStudents = rawStudents.map(s => {
        const ta = parseInt(s.ta) || 0;
        const tc = parseInt(s.tc) || 0;
        const realPercentage = tc > 0 ? (ta / tc) * 100 : 0;

        let status = "SAFE";
        if (realPercentage < 75) status = "DEFAULTER";
        else if (realPercentage < 80) status = "AT RISK";

        return { ...s, ta, tc, percentage: realPercentage.toFixed(1), status };
      });

      const newStats = {
        total_students: processedStudents.length,
        safe_count: processedStudents.filter(s => s.status === "SAFE").length,
        risk_count: processedStudents.filter(s => s.status === "AT RISK").length,
        defaulter_count: processedStudents.filter(s => s.status === "DEFAULTER").length,
      };

      setData({ ...res.data, students: processedStudents, stats: newStats });
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- PDF EXPORTS ---------------- */
  const downloadDefaultersPDF = () => {
    if (!data) return;
    const defaulters = data.students.filter(s => s.percentage < 75);
    if (defaulters.length === 0) return alert("No attendance defaulters found!");

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(239, 68, 68);
    doc.text(`Attendance Defaulters List (< 75%) - ${activeTerm} Term`, 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Roll No", "Student Name", "TA", "TC", "%", "Mentor"]],
      body: defaulters.map(s => [s.roll_number, s.name, s.ta, s.tc, `${s.percentage}%`, s.mentor_name]),
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68] }
    });
    doc.save(`Attendance_Defaulters_${data.class_info.year_level}.pdf`);
  };

  const downloadSubjectWisePDF = () => {
    if (!data) return;
    const doc = new jsPDF('l', 'mm', 'a4'); 
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); 
    doc.text("Class Academic Report - Subject Wise Marks", 14, 15);
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Class: ${data.class_info.year_level} ${data.class_info.department} (${activeTerm} Term)`, 14, 22);
    doc.text(`Academic Year: ${activeAcademicYear.name}`, 14, 28);

    const uniqueSubjects = [...new Set((data.students || []).flatMap(s => s.subject_marks?.map(sm => sm.name) || []))];
    const tableHeaders = ["Roll No", "Name", ...uniqueSubjects];
    
    const tableRows = data.students.map(s => {
      const row = [s.roll_number, s.name];
      uniqueSubjects.forEach(subName => {
        const markObj = s.subject_marks?.find(m => m.name === subName);
        row.push(markObj && markObj.marks !== null ? markObj.marks : "-");
      });
      return row;
    });

    autoTable(doc, { startY: 35, head: [tableHeaders], body: tableRows, theme: 'grid', headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 8 }});
    doc.save(`Subject_Marks_${data.class_info.year_level}.pdf`);
  };

  const downloadFullReportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.text(`Full Class Attendance Report - ${activeTerm} Term`, 14, 20);
    const tableData = data.students.map((s, idx) => [idx + 1, s.roll_number, s.name, s.ta, s.tc, `${s.percentage}%`, s.mentor_name]);
    autoTable(doc, { startY: 30, head: [["Sr No", "Roll No", "Student Name", "TA", "TC", "%", "Mentor"]], body: tableData, theme: "grid"});
    doc.save(`Full_Class_Report_${data.class_info.year_level}.pdf`);
  };

  /* ---------------- RENDERING ---------------- */
  if (!activeAcademicYear || loading) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  if (!data?.is_class_teacher) {
    return (
      <div className="assignments-container fade-in">
        <motion.div className="empty-state glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: "3rem", padding: "4rem 2rem", borderRadius: "16px" }}>
          <Presentation size={64} className="text-muted opacity-20 mb-4" />
          <h2>Not Assigned</h2>
          <p className="text-muted">You are not assigned as a Class Teacher for {activeAcademicYear.name}.</p>
        </motion.div>
      </div>
    );
  }

  const { class_info, stats, students } = data;
  const uniqueSubjects = [...new Set((students || []).flatMap(s => s.subject_marks?.map(sm => sm.name) || []))];

  const interactiveChartData = [
    { name: "Safe (≥80%)", rawStatus: "Safe", value: stats.safe_count, fill: "#10b981" },
    { name: "At Risk (75-79%)", rawStatus: "At Risk", value: stats.risk_count, fill: "#f59e0b" },
    { name: "Defaulters (<75%)", rawStatus: "Defaulter", value: stats.defaulter_count, fill: "#ef4444" }
  ];

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter ? s.status === activeFilter : true;
    return matchesSearch && matchesFilter;
  });

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="assignments-container fade-in">
      {/* HEADER SECTION */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "1.8rem" }}>My Class Dashboard</h1>
          <p className="page-subtitle">{class_info.year_level} • {class_info.department} ({activeTerm} Term)</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary premium-btn" onClick={downloadSubjectWisePDF} style={{ background: "#4f46e5", color: "white" }}><Download size={16} /> Marks Report</button>
          <button className="btn-secondary premium-btn" onClick={downloadFullReportPDF}><Download size={16} /> Full Report</button>
          <button className="btn-danger premium-btn-danger" onClick={downloadDefaultersPDF}><Download size={16} /> Defaulters PDF</button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="tabs-container" style={{ marginBottom: "1.5rem" }}>
        <button className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`} onClick={() => { setActiveTab("attendance"); setSearch(""); }}>
          <Activity size={18} /> Attendance Overview
        </button>
        <button className={`tab-btn ${activeTab === "marks" ? "active" : ""}`} onClick={() => { setActiveTab("marks"); setSearch(""); }}>
          <BookOpen size={18} /> Internal Test Marks
        </button>
      </div>

      {/* ---------------- ATTENDANCE TAB ---------------- */}
      {activeTab === "attendance" && (
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <div className="metrics-grid" style={{ marginBottom: "2rem" }}>
            <motion.div className="metric-card glass-panel" variants={itemVariants}><div className="metric-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}><Users size={22} /></div><div><p className="metric-label">Total Students</p><h3 className="metric-value">{stats.total_students}</h3></div></motion.div>
            <motion.div className="metric-card glass-panel" variants={itemVariants}><div className="metric-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}><CheckCircle size={22} /></div><div><p className="metric-label">Safe (≥80%)</p><h3 className="metric-value">{stats.safe_count}</h3></div></motion.div>
            <motion.div className="metric-card glass-panel" variants={itemVariants}><div className="metric-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}><AlertTriangle size={22} /></div><div><p className="metric-label">At Risk (75-79%)</p><h3 className="metric-value">{stats.risk_count}</h3></div></motion.div>
            <motion.div className="metric-card glass-panel" variants={itemVariants}><div className="metric-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}><ShieldAlert size={22} /></div><div><p className="metric-label">Defaulters (&lt;75%)</p><h3 className="metric-value">{stats.defaulter_count}</h3></div></motion.div>
          </div>

          <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "1.5rem" }}>
            <motion.div className="glass-panel premium-panel" variants={itemVariants}>
              <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                <h3>Class Health Radar</h3>
                <p className="text-muted text-sm">Click slice to filter</p>
              </div>
              <div style={{ height: "250px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={interactiveChartData} innerRadius="55%" outerRadius="80%" paddingAngle={4} dataKey="value" onClick={(entry) => setActiveFilter(prev => prev === entry.payload.rawStatus ? null : entry.payload.rawStatus)} style={{ cursor: "pointer", outline: "none" }}>
                      {interactiveChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} opacity={activeFilter === null || activeFilter === entry.rawStatus ? 1 : 0.25} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="glass-panel premium-panel" variants={itemVariants}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3>Attendance Roster</h3>
                <div className="search-bar premium-search" style={{ maxWidth: "250px" }}>
                  <Search size={16} className="text-muted" /><input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "300px", overflowY: "auto", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <table className="data-table">
                  <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)" }}>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th className="text-center">TA</th>
                      <th className="text-center">TC</th>
                      <th className="text-center">%</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => (
                      <tr key={s.id} onClick={() => setSelectedStudent(s)} style={{ cursor: "pointer" }}>
                        <td className="text-muted">{s.roll_number}</td>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-center">{s.ta}</td>
                        <td className="text-center">{s.tc}</td>
                        <td className="text-center font-bold" style={{ color: s.percentage < 75 ? "#ef4444" : "#10b981" }}>{s.percentage}%</td>
                        <td>
                          <span className="badge" style={{ background: (s.status === "Defaulter" || s.status === "At Risk") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: (s.status === "Defaulter" || s.status === "At Risk") ? "#ef4444" : "#10b981" }}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ---------------- INTERNAL MARKS TAB ---------------- */}
      {activeTab === "marks" && (
        <motion.div className="glass-panel premium-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ minHeight: "500px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
              <BookOpen size={20} className="text-primary" /> Academic Performance
            </h3>
            <div className="search-bar premium-search" style={{ maxWidth: "300px" }}>
              <Search size={16} className="text-muted" />
              <input type="text" placeholder="Search by name or roll no..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          
          <div className="scrollable-table-container premium-scroll" style={{ flex: 1, overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <table className="data-table" style={{ minWidth: "800px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <tr>
                  <th style={{ padding: "1rem" }}>Roll No</th>
                  <th style={{ padding: "1rem" }}>Name</th>
                  {uniqueSubjects.map(sub => <th key={sub} style={{ textAlign: "center", padding: "1rem" }}>{sub}</th>)}
                  <th style={{ textAlign: "center", padding: "1rem" }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const isFailing = s.subject_marks?.some(m => m.marks !== null && m.marks < 10);
                  return (
                    <tr key={`marks-${s.id}`}>
                      <td className="text-muted" style={{ padding: "1rem" }}>{s.roll_number}</td>
                      <td className="font-medium" style={{ padding: "1rem" }}>{s.name}</td>
                      {uniqueSubjects.map(subName => {
                        const markObj = s.subject_marks?.find(m => m.name === subName);
                        const markValue = markObj && markObj.marks !== null ? markObj.marks : null;
                        return (
                          <td key={subName} style={{ textAlign: "center", fontWeight: "600", color: markValue !== null && markValue < 10 ? "#dc2626" : "#059669", padding: "1rem" }}>
                            {markValue !== null ? markValue : "-"}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center", padding: "1rem" }}>
                        <span className="badge" style={{ background: isFailing ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: isFailing ? "#ef4444" : "#10b981", padding: "6px 12px" }}>
                          {isFailing ? "FAILING" : "CLEAR"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={uniqueSubjects.length + 3} className="text-center text-muted" style={{ padding: "4rem" }}>
                      No students found or no marks entered for this term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* STUDENT DRILLDOWN MODAL */}
      <AnimatePresence>
        {selectedStudent && <StudentDrilldownModal student={selectedStudent} ayId={activeAcademicYear.id} onClose={() => setSelectedStudent(null)} />}
      </AnimatePresence>
    </div>
  );
};

const StudentDrilldownModal = ({ student, ayId, onClose }) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assignmentService.getMenteeSubjectAttendance(student.id, ayId)
      .then(res => { setSubjects(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [student, ayId]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <motion.div className="modal-content premium-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between" }}>
          <div><h3 style={{ margin: 0 }}>{student.name}</h3><p className="text-muted" style={{ margin: 0 }}>{student.roll_number}</p></div>
          <button onClick={onClose} className="close-btn" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "12px", alignItems: "center" }}>
           <Activity size={32} color={student.percentage < 75 ? "#ef4444" : "#10b981"} />
           <div><p className="text-muted text-sm" style={{ margin: 0 }}>Overall Attendance</p><h2 style={{ margin: 0 }}>{student.percentage}%</h2></div>
        </div>
        <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "300px", overflowY: "auto" }}>
          {loading ? <p className="text-center text-muted">Loading subjects...</p> : (
            <table className="data-table" style={{ width: "100%" }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--bg-card)" }}>
                <tr><th style={{ textAlign: "left" }}>Subject</th><th>TA</th><th>TC</th><th>%</th></tr>
              </thead>
              <tbody>
                {subjects.map(sub => (
                  <tr key={sub.code}>
                    <td>{sub.name}</td>
                    <td style={{ textAlign: "center" }}>{sub.ta}</td>
                    <td style={{ textAlign: "center" }}>{sub.tc}</td>
                    <td style={{ textAlign: "center", fontWeight: "bold", color: sub.percentage < 75 ? "#ef4444" : "#10b981" }}>{sub.percentage}%</td>
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

export default MyClassDashboard;