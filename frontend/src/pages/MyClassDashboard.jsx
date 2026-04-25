import React, { useState, useEffect } from "react";
import { useAcademic } from "../context/AcademicContext";
import { assignmentService } from "../services/api";
import { Users, AlertTriangle, CheckCircle, ShieldAlert, Search, Presentation, Download, X, Activity, BookOpen, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./MyClassDashboard.css";
import { evaluateMarks, getStatusColor } from "./InternalAssessment";

const getAbbreviation = (name) => {
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  const words = cleanName.split(/[\s-]+/);
  if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase();
};

const MyClassDashboard = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  const [activeTab, setActiveTab] = useState("attendance"); 
  const [search, setSearch] = useState("");
  
  const [activeAttFilter, setActiveAttFilter] = useState(null);
  const [activeMarksFilter, setActiveMarksFilter] = useState(null);
  
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedMarksStudent, setSelectedMarksStudent] = useState(null);

  useEffect(() => {
    if (activeAcademicYear && activeTerm) fetchDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeTerm]);

  const fetchDashboard = async () => {
    setLoading(true);
    setSelectedStudent(null); 
    setSelectedMarksStudent(null);
    try {
      const res = await assignmentService.getMyClassDashboard(activeAcademicYear.id, activeTerm);
      const rawStudents = res.data.students || [];

      const processedStudents = rawStudents.map(s => {
        const ta = parseInt(s.ta) || 0;
        const tc = parseInt(s.tc) || 0;
        const realPercentage = tc > 0 ? (ta / tc) * 100 : 0;
        let status = "Safe";
        if (realPercentage < 75) status = "Defaulter";
        else if (realPercentage < 80) status = "At Risk";

        let s_fail = false; let s_risk = false; let s_pending = true; let s_on_track = false;
        let s_total_score = 0; let s_subjects = 0;

        s.subject_marks?.forEach(m => {
           const evalRes = evaluateMarks(m.it1, m.it2, m.it3);
           m.detailedStatus = evalRes.status;
           m.target = evalRes.req;
           m.final_score = evalRes.final_score;
           m.conducted = evalRes.conducted;

           if (evalRes.conducted > 0) {
               s_pending = false;
               s_total_score += evalRes.final_score;
               s_subjects++;
               
              
if (["FAILING", "FAILED"].includes(evalRes.status)) s_fail = true;
               else if (["NEEDS EFFORT", "CRITICAL"].includes(evalRes.status)) s_risk = true;
               else if (evalRes.status === "ON TRACK") s_on_track = true;
           } else {
               s_on_track = true;
           }
        });

        const overall_avg = s_subjects > 0 ? Number((s_total_score / s_subjects).toFixed(2)) : 0;
        
        let overall_mark_status = "All Clear";
        if (s_pending) overall_mark_status = "Pending";
        else if (s_fail) overall_mark_status = "Failing";
        else if (s_risk) overall_mark_status = "At Risk";
        else if (s_on_track) overall_mark_status = "On Track";

        return { ...s, ta, tc, percentage: realPercentage.toFixed(1), status, overall_avg, overall_mark_status };
      });

      const newStats = {
        total_students: processedStudents.length,
        safe_count: processedStudents.filter(s => s.status === "Safe").length,
        risk_count: processedStudents.filter(s => s.status === "At Risk").length,
        defaulter_count: processedStudents.filter(s => s.status === "Defaulter").length,
      };

      setData({ ...res.data, students: processedStudents, stats: newStats });
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

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
    doc.setTextColor(0, 0, 0); 
    doc.text("Class Academic Report - Comprehensive Internal Marks", 14, 15);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Class: ${data.class_info.year_level} ${data.class_info.department} (${activeTerm} Term)`, 14, 22);
    doc.text(`Academic Year: ${activeAcademicYear.name}`, 14, 28);

    const uniqueSubjects = [...new Set((data.students || []).flatMap(s => s.subject_marks?.map(sm => sm.name) || []))];
    
    const headRow1 = [
      { content: 'Roll No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Name', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ];
    
    const headRow2 = [];

    uniqueSubjects.forEach(sub => {
      headRow1.push({ content: getAbbreviation(sub), colSpan: 4, styles: { halign: 'center' } });
      headRow2.push('IT1', 'IT2', 'IT3', 'Avg');
    });

    const tableRows = data.students.map(s => {
      const row = [s.roll_number, s.name];
      
      uniqueSubjects.forEach(subName => {
        const markObj = s.subject_marks?.find(m => m.name === subName);
        
        row.push(markObj && markObj.it1 !== null ? markObj.it1 : "-");
        row.push(markObj && markObj.it2 !== null ? markObj.it2 : "-");
        row.push(markObj && markObj.it3 !== null ? markObj.it3 : "-");
        row.push(markObj && markObj.conducted > 0 ? markObj.final_score : "-");
      });
      
      return row;
    });

    autoTable(doc, { 
      startY: 35, 
      head: [headRow1, headRow2], 
      body: tableRows, 
      theme: 'grid', 
      headStyles: { 
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],       
        lineColor: [0, 0, 0],       
        lineWidth: 0.1 
      }, 
      styles: { 
        fontSize: 8,                
        cellPadding: 2.5,           
        halign: 'center',
        textColor: [0, 0, 0],       
        lineColor: [0, 0, 0],       
        lineWidth: 0.1
      }, 
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 }, 
        1: { halign: 'left', cellWidth: 45 },   
      }
    });

    doc.save(`Comprehensive_Marks_${data.class_info.year_level}.pdf`);
  };

  const downloadFullReportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`Full Class Attendance Report - ${activeTerm} Term`, 14, 20);
    
    const tableData = data.students.map((s, idx) => [idx + 1, s.roll_number, s.name, s.ta, s.tc, `${s.percentage}%`, s.mentor_name]);
    
    autoTable(doc, { 
      startY: 30, 
      head: [["Sr No", "Roll No", "Student Name", "TA", "TC", "%", "Mentor"]], 
      body: tableData, 
      theme: "grid"
    });
    
    doc.save(`Full_Class_Attendance_Report_${data.class_info.year_level}.pdf`);
  };

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

  const attChartData = [
    { name: "Safe (≥80%)", rawStatus: "Safe", value: stats.safe_count, fill: "#10b981" },
    { name: "At Risk (75-79%)", rawStatus: "At Risk", value: stats.risk_count, fill: "#f59e0b" },
    { name: "Defaulters (<75%)", rawStatus: "Defaulter", value: stats.defaulter_count, fill: "#ef4444" }
  ];

  const filteredAttStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeAttFilter ? s.status === activeAttFilter : true;
    return matchesSearch && matchesFilter;
  });

  let mSafe = 0; let mRisk = 0; let mFail = 0; let mPending = 0; let mTrack = 0;
  students.forEach(s => {
    if (s.overall_mark_status === "Pending") mPending++;
    else if (s.overall_mark_status === "Failing") mFail++;
    else if (s.overall_mark_status === "At Risk") mRisk++;
    else if (s.overall_mark_status === "On Track") mTrack++; 
    else mSafe++;
  });

  const marksPieData = [
    { name: "All Clear", rawStatus: "All Clear", value: mSafe, fill: "#10b981" },
    { name: "On Track", rawStatus: "On Track", value: mTrack, fill: "#3b82f6" },
    { name: "Needs Focus", rawStatus: "At Risk", value: mRisk, fill: "#f59e0b" },
    { name: "Failing", rawStatus: "Failing", value: mFail, fill: "#ef4444" },
    { name: "Pending", rawStatus: "Pending", value: mPending, fill: "#9ca3af" }
  ];

  const subjectAverages = uniqueSubjects.map(subName => {
    let total = 0; let count = 0;
    students.forEach(s => {
      const mark = s.subject_marks?.find(m => m.name === subName);
      if (mark && mark.conducted > 0) { total += mark.final_score; count++; }
    });
    return { name: getAbbreviation(subName), fullName: subName, avg: count > 0 ? Number((total / count).toFixed(1)) : 0 };
  });

  const filteredMarksStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeMarksFilter ? s.overall_mark_status === activeMarksFilter : true;
    return matchesSearch && matchesFilter;
  });

  const topPerformers = [...students]
    .filter(s => s.overall_mark_status !== "Pending")
    .sort((a,b) => b.overall_avg - a.overall_avg)
    .slice(0, 5);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="assignments-container fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "1.8rem" }}>My Class Dashboard</h1>
          <p className="page-subtitle">{class_info.year_level} • {class_info.department} ({activeTerm} Term)</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {activeTab === "marks" ? (
            <button className="btn-secondary premium-btn" onClick={downloadSubjectWisePDF} style={{ background: "#4f46e5", color: "white" }}><Download size={16} /> Marks Report</button>
          ) : (
            <>
              <button className="btn-secondary premium-btn" onClick={downloadFullReportPDF}><Download size={16} /> Full Report</button>
              <button className="btn-danger premium-btn-danger" onClick={downloadDefaultersPDF}><Download size={16} /> Defaulters PDF</button>
            </>
          )}
        </div>
      </div>

      <div className="tabs-container" style={{ marginBottom: "1.5rem" }}>
        {/* --- DESKTOP TABS --- */}
        <div className="desktop-tabs" style={{ display: "flex", gap: "10px" }}>
          <button className={`tab-btn ${activeTab === "attendance" ? "active" : ""}`} onClick={() => { setActiveTab("attendance"); setSearch(""); }}>
            <Activity size={18} /> Attendance Overview
          </button>
          <button className={`tab-btn ${activeTab === "marks" ? "active" : ""}`} onClick={() => { setActiveTab("marks"); setSearch(""); }}>
            <BookOpen size={18} /> Internal Test Marks
          </button>
        </div>

        {/* --- MOBILE DROPDOWN TAB --- */}
        <div className="mobile-tabs">
          <select 
            className="premium-select mobile-tab-select" 
            value={activeTab} 
            onChange={(e) => { setActiveTab(e.target.value); setSearch(""); }}
          >
            <option value="attendance">📊 View: Attendance Overview</option>
            <option value="marks">📝 View: Internal Test Marks</option>
          </select>
        </div>
      </div>

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
              <div style={{ textAlign: "center", marginBottom: "0.5rem" }}><h3>Class Health Radar</h3><p className="text-muted text-sm">Click slice to filter table</p></div>
              <div className="chart-wrapper" style={{ height: "280px", position: "relative", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={attChartData} innerRadius="50%" outerRadius="70%" paddingAngle={3} dataKey="value" onClick={(entry) => {const status = entry.payload?.rawStatus || entry.rawStatus;
                         setActiveAttFilter(prev => prev === status ? null : status);
                      }} style={{ cursor: "pointer", outline: "none" }}>
                      {attChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} opacity={activeAttFilter === null || activeAttFilter === entry.rawStatus ? 1 : 0.25} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div className="glass-panel premium-panel" variants={itemVariants}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h3 style={{ margin: 0 }}>Attendance Roster</h3>
                  {activeAttFilter && (
                    <span className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }} onClick={() => setActiveAttFilter(null)} title="Clear Filter">
                      {activeAttFilter} <X size={14} />
                    </span>
                  )}
                </div>
                <div className="search-bar premium-search" style={{ maxWidth: "250px" }}>
                  <Search size={16} className="text-muted" /><input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
              <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "300px", overflowY: "auto", borderRadius: "8px", border: "1px solid var(--border-color)" }}><table className="data-table">
                  <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)" }}>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th className="text-center">%</th>
                      <th>Status</th>
                      <th>Mentor</th> 
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttStudents.map(s => (
                      <tr key={s.id} onClick={() => setSelectedStudent(s)} style={{ cursor: "pointer" }}>
                        <td className="text-muted">{s.roll_number}</td>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-center font-bold" style={{ color: s.percentage < 75 ? "#ef4444" : "#10b981" }}>{s.percentage}%</td>
                        <td>
                          {s.status !== "Safe" && (
                            <span className="badge" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>{s.status}</span>
                          )}
                        </td>
                        <td className="text-muted text-sm">{s.mentor_name || "Unassigned"}</td> 
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
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            
            {/* Top Performers Card */}
            <motion.div className="glass-panel premium-panel" variants={itemVariants}>
              <h3 className="text-center" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><Trophy size={20} color="#f59e0b" /> Top 5 Performers</h3>
              <div style={{ marginTop: "1rem" }}>
                {topPerformers.length > 0 ? topPerformers.map((p, i) => (
                   <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)"}}>
                     <div style={{ display: "flex", gap: "12px" }}>
                       <span style={{ fontWeight: "bold", color: "var(--primary-color)" }}>#{i+1}</span>
                       <span className="font-medium">{p.name.split(' ')[0]} {p.name.split(' ').pop()}</span>
                     </div>
                     <span style={{ fontWeight: "bold", color: "#10b981" }}>{p.overall_avg} Avg</span>
                   </div>
                )) : <p className="text-muted text-center mt-6">Tests are pending.</p>}
              </div>
            </motion.div>

            {/* Subject Averages */}
            <motion.div className="glass-panel premium-panel" variants={itemVariants}>
              <h3 className="text-center">Subject Averages</h3>
              <div className="chart-wrapper" style={{ height: "260px", position: "relative", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectAverages} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{fontSize: 11}} />
                    <YAxis domain={[0, 25]} tick={{fontSize: 11}} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(value, name, props) => [value, props.payload.fullName]} />
                    <Bar dataKey="avg" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Overall Class Performance */}
            <motion.div className="glass-panel premium-panel" variants={itemVariants}>
              <h3 className="text-center">Overall Class Status</h3>
              <p className="text-muted text-sm text-center" style={{marginTop: "-5px", marginBottom: "5px"}}>Click slice to filter table</p>
              <div className="chart-wrapper" style={{ height: "280px", position: "relative", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={marksPieData} innerRadius="50%" outerRadius="70%" paddingAngle={4} dataKey="value" onClick={(entry) => {const status = entry.payload?.rawStatus || entry.rawStatus;
                         setActiveMarksFilter(prev => prev === status ? null : status);
                      }} style={{ cursor: "pointer", outline: "none" }}>
                      {marksPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} opacity={activeMarksFilter === null || activeMarksFilter === entry.rawStatus ? 1 : 0.25} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <motion.div className="glass-panel premium-panel" variants={itemVariants}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
                  <BookOpen size={20} className="text-primary" /> Detailed Academic Roster
                </h3>
                {activeMarksFilter && (
                  <span className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }} onClick={() => setActiveMarksFilter(null)} title="Clear Filter">
                    {activeMarksFilter} <X size={14} />
                  </span>
                )}
              </div>
              <div className="search-bar premium-search" style={{ maxWidth: "300px" }}>
                <Search size={16} className="text-muted" />
                <input type="text" placeholder="Search by name or roll no..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            
            <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
            <div className="scrollable-table-container premium-scroll" style={{ overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border-color)" }}><table className="data-table" style={{ minWidth: "800px" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-card)", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                  <tr>
                    <th style={{ padding: "1rem" }}>Roll No</th>
                    <th style={{ padding: "1rem" }}>Name</th>
                    {uniqueSubjects.map(sub => <th key={sub} title={sub} style={{ textAlign: "center", padding: "1rem", cursor: "help" }}>{getAbbreviation(sub)}</th>)}
                    <th style={{ textAlign: "center", padding: "1rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarksStudents.map(s => {
                    const badgeStyle = getStatusColor(s.overall_mark_status);
                    return (
                      <tr key={`marks-${s.id}`} onClick={() => setSelectedMarksStudent(s)} style={{ cursor: "pointer" }} className="premium-row">
                        <td className="text-muted" style={{ padding: "1rem" }}>{s.roll_number}</td>
                        <td className="font-medium" style={{ padding: "1rem" }}>{s.name}</td>
                        {uniqueSubjects.map(subName => {
                          const markObj = s.subject_marks?.find(m => m.name === subName);
                          const cellStyle = markObj ? getStatusColor(markObj.detailedStatus) : { text: "#9ca3af" };
                          return (
                            <td key={subName} title={`Target: ${markObj?.target || "-"}`} style={{ textAlign: "center", fontWeight: "600", color: cellStyle.text, padding: "1rem" }}>
                              {markObj && markObj.conducted > 0 ? markObj.final_score : "-"}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", padding: "1rem" }}>
                          <span className="badge" style={{ background: badgeStyle.bg, color: badgeStyle.text, padding: "6px 12px" }}>
                            {s.overall_mark_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMarksStudents.length === 0 && (
                    <tr>
                      <td colSpan={uniqueSubjects.length + 3} className="text-center text-muted" style={{ padding: "4rem" }}>
                        No students found matching this criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {selectedStudent && <StudentDrilldownModal student={selectedStudent} ayId={activeAcademicYear.id} onClose={() => setSelectedStudent(null)} />}
        {selectedMarksStudent && <StudentMarksModal student={selectedMarksStudent} onClose={() => setSelectedMarksStudent(null)} />}
      </AnimatePresence>
    </div>
  );
};

// --- INTERNAL MARKS DRILLDOWN MODAL ---
const StudentMarksModal = ({ student, onClose }) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <motion.div className="modal-content premium-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <div className="modal-header" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between" }}>
          <div><h3 style={{ margin: 0 }}>{student.name}</h3><p className="text-muted" style={{ margin: 0 }}>{student.roll_number}</p></div>
          <button onClick={onClose} className="close-btn" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={24} /></button>
        </div>
        <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
        <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "400px", overflowY: "auto" }}><table className="data-table" style={{ width: "100%" }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--bg-card)" }}>
              <tr>
                <th style={{ textAlign: "left" }}>Subject</th>
                <th style={{ textAlign: "center" }}>IT 1</th>
                <th style={{ textAlign: "center" }}>IT 2</th>
                <th style={{ textAlign: "center" }}>IT 3</th>
                <th style={{ textAlign: "center" }}>Target</th>
                <th style={{ textAlign: "center" }}>Final</th>
                <th style={{ textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {student.subject_marks?.map(sub => {
                const badgeStyle = getStatusColor(sub.detailedStatus);
                return (
                  <tr key={sub.code}>
                    <td className="font-medium">{sub.name}</td>
                    <td style={{ textAlign: "center" }}>{sub.it1 !== null ? sub.it1 : "-"}</td>
                    <td style={{ textAlign: "center" }}>{sub.it2 !== null ? sub.it2 : "-"}</td>
                    <td style={{ textAlign: "center" }}>{sub.it3 !== null ? sub.it3 : "-"}</td>
                    <td style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                      {sub.target}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "1.1rem" }}>
                      {sub.conducted > 0 ? sub.final_score : "-"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="badge" style={{ background: badgeStyle.bg, color: badgeStyle.text }}>
                        {sub.detailedStatus}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

// --- ATTENDANCE DRILLDOWN MODAL ---
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
        <div className="mobile-swipe-hint"><span>← Swipe table to view all columns →</span></div>
        <div className="scrollable-table-container premium-scroll" style={{ maxHeight: "300px", overflowY: "auto" }}>{loading ? <p className="text-center text-muted">Loading subjects...</p> : (
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