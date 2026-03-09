import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { assignmentService } from "../services/api";
import { Users, AlertTriangle, CheckCircle, ShieldAlert, Search, Presentation, Download, X, Filter, Activity, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./MyClassDashboard.css";

const MyClassDashboard = () => {
  const { activeAcademicYear } = useAcademic();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  
  const [activeFilter, setActiveFilter] = useState(null);
  
  // --- NEW: State for clicking a student to view drilldown ---
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (activeAcademicYear) fetchDashboard();
  }, [activeAcademicYear]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await assignmentService.getMyClassDashboard(activeAcademicYear.id);
      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const downloadDefaultersPDF = () => {
    if (!data || data.students.length === 0) return;
    
    const doc = new jsPDF();
    const defaulters = data.students.filter(s => s.percentage < 75);

    if (defaulters.length === 0) return alert("No defaulters found!");

    doc.setFontSize(18);
    doc.setTextColor(239, 68, 68);
    doc.text("Class Defaulters List (< 75%)", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Academic Year: ${activeAcademicYear.name}`, 14, 28);
    doc.text(`Class: ${data.class_info.year_level} ${data.class_info.division ? `Div ${data.class_info.division}` : ""}`, 14, 34);
    doc.text(`Department: ${data.class_info.department}`, 14, 40);
    doc.text(`Class Teacher: ${data.class_info.class_teacher_name}`, 14, 46);

    const tableColumns = ["Roll No.", "Student Name", "Attended (TA)", "Conducted (TC)", "Overall %", "Assigned Mentor"];
    const tableRows = [];
    let i = 0;

    // Sort defaulters by Mentor Name so identical mentors group together natively
    defaulters.sort((a, b) => (a.mentor_name || "").localeCompare(b.mentor_name || ""));

    // ALGORITHM: Group consecutive rows by Mentor Name
    while (i < defaulters.length) {
      const currentMentor = defaulters[i].mentor_name || "Unassigned";
      let span = 1;
      
      while (i + span < defaulters.length && (defaulters[i + span].mentor_name || "Unassigned") === currentMentor) {
        span++;
      }

      tableRows.push([
        defaulters[i].roll_number,
        defaulters[i].name,
        defaulters[i].ta,
        defaulters[i].tc,
        `${defaulters[i].percentage}%`,
        { 
          content: currentMentor, 
          rowSpan: span, 
          styles: { valign: "middle", halign: "center", fontStyle: "bold" } 
        }
      ]);

      for (let j = 1; j < span; j++) {
        tableRows.push([
          defaulters[i + j].roll_number,
          defaulters[i + j].name,
          defaulters[i + j].ta,
          defaulters[i + j].tc,
          `${defaulters[i + j].percentage}%`
        ]);
      }
      i += span; 
    }

    autoTable(doc, {
      startY: 52,
      head: [tableColumns],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 
        4: { fontStyle: "bold", textColor: [239, 68, 68] },
        5: { fillColor: [248, 250, 252] } 
      }
    });

    doc.save(`Defaulters_${data.class_info.year_level}_${data.class_info.division || 'ALL'}.pdf`);
  };

  const downloadFullReportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(59, 130, 246);
    doc.text("Class Attendance Master Report", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Academic Year: ${activeAcademicYear.name}`, 14, 28);
    doc.text(`Class: ${data.class_info.year_level} ${data.class_info.division ? `Div ${data.class_info.division}` : ""}`, 14, 34);
    doc.text(`Department: ${data.class_info.department}`, 14, 40);
    doc.text(`Class Teacher: ${data.class_info.class_teacher_name}`, 14, 46);

    const tableData = data.students.map((s, idx) => [
      idx + 1,
      s.roll_number,
      s.name,
      s.ta,
      s.tc,
      `${s.percentage}%`,
      s.status,
      s.mentor_name
    ]);

    autoTable(doc, {
      startY: 52,
      head: [["Sr No", "Roll No", "Student Name", "TA", "TC", "%", "Status", "Mentor"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      willDrawCell: function (data) {
          if (data.column.index === 6 && data.section === 'body') {
              if (data.cell.raw === 'Defaulter') data.cell.styles.textColor = [239, 68, 68];
              else if (data.cell.raw === 'At Risk') data.cell.styles.textColor = [245, 158, 11];
              else data.cell.styles.textColor = [16, 185, 129];
          }
      }
    });

    doc.save(`Class_Report_${data.class_info.year_level}_${data.class_info.division || 'ALL'}.pdf`);
  };

  if (!activeAcademicYear || loading) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  if (!data?.is_class_teacher) {
    return (
      <div className="assignments-container fade-in">
        <motion.div 
          className="empty-state glass-panel" 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: "3rem", padding: "4rem 2rem", borderRadius: "16px" }}
        >
          <Presentation size={64} className="text-muted opacity-20 mb-4" />
          <h2>Not Assigned</h2>
          <p className="text-muted">You are not currently assigned as a Class Teacher for the {activeAcademicYear.name} academic year.</p>
        </motion.div>
      </div>
    );
  }

  const { class_info, stats, chartData, students } = data;

  const interactiveChartData = [
    { name: "Safe (≥80%)", rawStatus: "Safe", value: stats.safe_count, fill: "#10b981" },
    { name: "At Risk (75-79%)", rawStatus: "At Risk", value: stats.risk_count, fill: "#f59e0b" },
    { name: "Defaulters (<75%)", rawStatus: "Defaulter", value: stats.defaulter_count, fill: "#ef4444" }
  ];

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.roll_number.toLowerCase().includes(search.toLowerCase()) ||
                          s.mentor_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter ? s.status === activeFilter : true;
    
    return matchesSearch && matchesFilter;
  });

  const handleChartClick = (entry) => {
    setActiveFilter(prev => prev === entry.rawStatus ? null : entry.rawStatus);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="assignments-container fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "1.8rem" }}>My Class Dashboard</h1>
          <p className="page-subtitle" style={{ fontSize: "0.95rem" }}>
            {class_info.year_level} {class_info.division ? `Div ${class_info.division}` : ""} • {class_info.department}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary premium-btn" onClick={downloadFullReportPDF}>
            <Download size={16} /> Full Report
          </button>
          <button className="btn-danger premium-btn-danger" onClick={downloadDefaultersPDF}>
            <Download size={16} /> Defaulters PDF
          </button>
        </div>
      </div>

      <motion.div className="metrics-grid" variants={containerVariants} initial="hidden" animate="show" style={{ marginBottom: "2rem", marginTop: "1rem" }}>
        <motion.div className="metric-card glass-panel" variants={itemVariants} whileHover={{ y: -5, scale: 1.02 }}>
          <div className="metric-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}><Users size={22} /></div>
          <div><p className="metric-label">Total Students</p><h3 className="metric-value">{stats.total_students}</h3></div>
        </motion.div>
        
        <motion.div className="metric-card glass-panel" variants={itemVariants} whileHover={{ y: -5, scale: 1.02 }}>
          <div className="metric-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}><CheckCircle size={22} /></div>
          <div><p className="metric-label">Safe (≥80%)</p><h3 className="metric-value">{stats.safe_count}</h3></div>
        </motion.div>

        <motion.div className="metric-card glass-panel" variants={itemVariants} whileHover={{ y: -5, scale: 1.02 }}>
          <div className="metric-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}><AlertTriangle size={22} /></div>
          <div><p className="metric-label">At Risk (75-79%)</p><h3 className="metric-value">{stats.risk_count}</h3></div>
        </motion.div>

        <motion.div className="metric-card glass-panel" variants={itemVariants} whileHover={{ y: -5, scale: 1.02 }}>
          <div className="metric-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}><ShieldAlert size={22} /></div>
          <div><p className="metric-label">Defaulters (&lt;75%)</p><h3 className="metric-value">{stats.defaulter_count}</h3></div>
        </motion.div>
      </motion.div>

      <motion.div className="dashboard-grid" variants={containerVariants} initial="hidden" animate="show">
        
        {/* INTERACTIVE RADAR CHART */}
        <motion.div className="glass-panel premium-panel" variants={itemVariants}>
          <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Class Health Radar</h3>
            <p className="text-muted text-sm" style={{ marginTop: "2px", fontSize: "0.8rem" }}>Click a slice to filter students</p>
          </div>
          <div style={{ width: "100%", height: "250px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={interactiveChartData} 
                  innerRadius="55%"  
                  outerRadius="80%"  
                  paddingAngle={4}
                  dataKey="value" 
                  stroke="none"
                  onClick={(entry) => handleChartClick(entry.payload)}
                  style={{ cursor: "pointer", outline: "none" }}
                >
                  {interactiveChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill} 
                      opacity={activeFilter === null || activeFilter === entry.rawStatus ? 1 : 0.25}
                      style={{ transition: "opacity 0.3s ease", outline: "none" }}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxShadow: '0 8px 20px rgba(0,0,0,0.08)', fontSize: '0.85rem' }}
                  itemStyle={{ color: 'var(--text-primary)', fontWeight: '600' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: "0.85rem", paddingTop: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* STUDENT ROSTER */}
        <motion.div className="glass-panel premium-panel" variants={itemVariants}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Student Roster</h3>
              
              <AnimatePresence>
                {activeFilter && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    className="filter-clear-badge"
                    onClick={() => setActiveFilter(null)}
                    title="Clear filter"
                  >
                    <Filter size={12} /> {activeFilter} Only <X size={14} style={{ marginLeft: "4px" }}/>
                  </motion.button>
                )}
              </AnimatePresence>

            </div>
            <div className="search-bar premium-search" style={{ flex: 1, maxWidth: "280px" }}>
              <Search size={16} className="text-muted" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: "0.9rem" }} />
            </div>
          </div>

          <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "380px", overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
            <table className="data-table" style={{ fontSize: "0.9rem" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)", backdropFilter: "blur(10px)" }}>
                <tr>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th style={{ textAlign: "center" }} title="Total Attended">TA</th>
                  <th style={{ textAlign: "center" }} title="Total Conducted">TC</th>
                  <th style={{ textAlign: "center" }}>Overall %</th>
                  <th>Mentor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredStudents.length > 0 ? filteredStudents.map(s => (
                    <motion.tr 
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="premium-row"
                      onClick={() => setSelectedStudent(s)} // <-- NEW: Click to view details
                      style={{ cursor: "pointer" }}         // <-- NEW: Pointer cursor
                      title="Click to view subject-wise attendance"
                    >
                      <td className="font-medium text-muted">{s.roll_number}</td>
                      <td className="font-medium">{s.name}</td>
                      <td style={{ textAlign: "center" }}>{s.ta}</td>
                      <td style={{ textAlign: "center" }}>{s.tc}</td>
                      <td style={{ textAlign: "center", fontWeight: "bold", color: s.percentage < 75 ? "#ef4444" : s.percentage < 80 ? "#f59e0b" : "#10b981" }}>
                        {s.percentage}%
                      </td>
                      <td><span className={`badge ${s.mentor_name === 'Unassigned' ? 'badge-role' : 'badge-designation'}`} style={{ fontSize: "0.75rem" }}>{s.mentor_name}</span></td>
                      <td>
                        <span className="badge premium-status-badge" style={{
                          background: s.status === "Defaulter" ? "rgba(239, 68, 68, 0.1)" : s.status === "At Risk" ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
                          color: s.status === "Defaulter" ? "#ef4444" : s.status === "At Risk" ? "#f59e0b" : "#10b981",
                          border: `1px solid ${s.status === "Defaulter" ? "rgba(239, 68, 68, 0.3)" : s.status === "At Risk" ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                        }}>
                          {s.status}
                        </span>
                      </td>
                    </motion.tr>
                  )) : (
                    <tr><td colSpan="7" className="text-center text-muted py-8">No students match the current filters.</td></tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>

      {/* --- NEW: Student Drilldown Modal --- */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDrilldownModal 
            student={selectedStudent} 
            ayId={activeAcademicYear.id} 
            onClose={() => setSelectedStudent(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};


// --- NEW: Reusable Component for Drilldown ---
const StudentDrilldownModal = ({ student, ayId, onClose }) => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We can reuse the exact same API endpoint that mentors use!
    assignmentService.getMenteeSubjectAttendance(student.id, ayId)
      .then(res => { setSubjects(res.data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [student, ayId]);

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <motion.div className="modal-content premium-panel" style={{ maxWidth: "800px", width: "90%" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.3rem" }}>{student.name}'s Attendance</h3>
            <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>{student.roll_number}</p>
          </div>
          <button onClick={onClose} className="close-btn" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><X size={24} /></button>
        </div>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-input)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem" }}>
            <Activity size={32} color={student.percentage < 75 ? "#ef4444" : "#10b981"} />
            <div>
              <p className="text-muted text-sm" style={{ margin: 0 }}>Total Academic Attendance</p>
              <h2 style={{ margin: 0, color: student.percentage < 75 ? "#ef4444" : "var(--text-primary)", fontSize: "1.8rem" }}>{student.percentage}%</h2>
            </div>
          </div>
          {student.percentage < 75 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "0.8rem", borderRadius: "8px" }}>
              <AlertTriangle size={24} />
              <span className="font-medium text-sm">Critical Warning: Student is a defaulter.</span>
            </div>
          )}
        </div>

        <h4 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-primary)" }}>
          <BookOpen size={18} /> Subject-wise Breakdown
        </h4>

        <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "350px", overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          {loading ? (
             <div className="spinner" style={{ margin: "3rem auto" }}></div>
          ) : subjects.length === 0 ? (
            <p className="text-center text-muted py-8">No attendance recorded yet for this academic year.</p>
          ) : (
            <table className="data-table" style={{ fontSize: "0.9rem", width: "100%", tableLayout: "fixed" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)" }}>
                <tr>
                  <th style={{ width: "40%" }}>Subject</th>
                  <th style={{ width: "30%" }}>Teacher</th>
                  <th style={{ textAlign: "center", width: "10%" }}>TA</th>
                  <th style={{ textAlign: "center", width: "10%" }}>TC</th>
                  <th style={{ textAlign: "center", width: "10%" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(sub => (
                  <tr key={sub.code} className="premium-row">
                    <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                      <div className="font-medium" style={{ color: "var(--text-primary)" }}>{sub.name}</div>
                      <div className="text-muted text-sm">{sub.code}</div>
                    </td>
                    <td className="text-muted" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{sub.teacher}</td>
                    <td style={{ textAlign: "center" }}>{sub.ta}</td>
                    <td style={{ textAlign: "center" }}>{sub.tc}</td>
                    <td style={{ textAlign: "center", fontWeight: "bold", color: sub.percentage < 75 ? "#ef4444" : sub.percentage < 80 ? "#f59e0b" : "#10b981" }}>
                      {sub.percentage}%
                    </td>
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