import React, { useState, useEffect } from "react";
import { useAcademic } from "../../context/AcademicContext";
import { 
  Award, HeartHandshake, AlertTriangle, BookOpen, Activity, Target, ShieldCheck, CheckCircle, Users
} from "lucide-react";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import "./StudentDashboard.css";

// 🚨 IMPORT THE MATH ENGINE TO CALCULATE TARGETS
import { evaluateMarks, getStatusColor } from "../InternalAssessment";

const getAbbreviation = (name) => {
  if (!name) return "";
  const cleanName = name.replace(/\([^)]*\)/g, '').trim();
  const words = cleanName.split(/[\s-]+/);
  if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase();
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel" style={{ padding: '10px', fontSize: '0.85rem' }}>
        <p style={{ margin: '0 0 5px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{payload[0].payload.fullName || label}</p>
        <p style={{ margin: 0, color: payload[0].fill }}>
          {payload[0].name}: {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const StudentDashboard = () => {
  const { activeAcademicYear, activeTerm } = useAcademic();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeAcademicYear && activeTerm) fetchDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeTerm]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/student-portal/dashboard/`, {
        params: { academic_year_id: activeAcademicYear.id, term: activeTerm },
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      setData(res.data);
    } catch (err) {
      console.error("Failed to load student data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  const { student_info, support_system, overall_attendance, attendance_subjects, marks_subjects } = data;

  // --- DATA PROCESSING & MERGING ---
  const mergedSubjects = [];
  const attMap = new Map();
  attendance_subjects.forEach(sub => attMap.set(sub.subject_code, sub));
  
  const marksMap = new Map();
  marks_subjects.forEach(sub => {
      const evalRes = evaluateMarks(sub.it1, sub.it2, sub.it3);
      marksMap.set(sub.subject_code, { ...sub, ...evalRes });
  });

  const allSubjectCodes = new Set([...attMap.keys(), ...marksMap.keys()]);
  
  let totalScore = 0;
  let validScoreCount = 0;
  let s_fail = false; let s_risk = false; let s_pending = true; let s_on_track = false;

  allSubjectCodes.forEach(code => {
      const att = attMap.get(code) || {};
      const mrk = marksMap.get(code) || {};
      
      if (mrk.conducted > 0) {
          s_pending = false;
          totalScore += mrk.final_score;
          validScoreCount++;
          if (["FAILING", "FAILED"].includes(mrk.status)) s_fail = true;
          else if (["NEEDS EFFORT", "CRITICAL"].includes(mrk.status)) s_risk = true;
          else if (mrk.status === "ON TRACK") s_on_track = true;
      } else {
          if (code) s_on_track = true; 
      }

      mergedSubjects.push({
          code,
          name: att.subject_name || mrk.subject_name || code,
          shortName: getAbbreviation(att.subject_name || mrk.subject_name || code),
          faculty: att.faculty_name || "Unassigned",
          ta: att.ta || 0,
          tc: att.tc || 0,
          att_perc: att.percentage || 0,
          it1: mrk.it1,
          it2: mrk.it2,
          it3: mrk.it3,
          final_score: mrk.final_score || 0,
          conducted: mrk.conducted || 0,
          target: mrk.req || "-",
          status: mrk.status || "PENDING"
      });
  });

  const overall_avg = validScoreCount > 0 ? (totalScore / validScoreCount).toFixed(1) : 0;
  let overall_mark_status = "All Clear";
  let statusColor = "#10b981";
  
  if (s_pending && validScoreCount === 0) { overall_mark_status = "Pending"; statusColor = "#9ca3af"; }
  else if (s_fail) { overall_mark_status = "Failing"; statusColor = "#ef4444"; }
  else if (s_risk) { overall_mark_status = "At Risk"; statusColor = "#f59e0b"; }
  else if (s_on_track) { overall_mark_status = "On Track"; statusColor = "#3b82f6"; }

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="student-dashboard-container fade-in">
      
      {/* HEADER */}
      <div className="dashboard-header glass-panel">
        <div className="welcome-section">
          <h1>Welcome, <span>{student_info.name.split(' ')[0]}</span> 👋</h1>
          <p>{student_info.department} • Semester {student_info.semester} • {activeTerm} Term</p>
          <span className="badge mt-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Roll No: {student_info.roll_number}</span>
        </div>
        <div className="support-box">
          <div className="support-item">
            <div className="icon-box primary"><HeartHandshake size={20} /></div>
            <div>
              <p className="label">Your Mentor</p>
              <p className="value">{support_system.mentor}</p>
            </div>
          </div>
          <div className="support-item" style={{ marginBottom: 0 }}>
            <div className="icon-box secondary"><Users size={20} /></div>
            <div>
              <p className="label">Class Teacher</p>
              <p className="value">{support_system.class_teacher}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <motion.div className="kpi-grid" variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Attendance KPI */}
        <motion.div className="glass-panel premium-kpi-card" variants={itemVariants}>
          <div className="kpi-header">
            <div className="kpi-icon-circle" style={{ background: overall_attendance.percentage < 75 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: overall_attendance.percentage < 75 ? "#ef4444" : "#10b981" }}>
              <Activity size={24} />
            </div>
            <span className={`status-pill ${overall_attendance.status.toLowerCase()}`}>{overall_attendance.status}</span>
          </div>
          <div className="kpi-body">
            <h2 style={{ color: overall_attendance.percentage < 75 ? "#ef4444" : "var(--text-primary)" }}>{overall_attendance.percentage}%</h2>
            <p className="text-muted">Overall Attendance ({overall_attendance.ta} / {overall_attendance.tc} hrs)</p>
          </div>
        </motion.div>

        {/* Academic Marks KPI */}
        <motion.div className="glass-panel premium-kpi-card" variants={itemVariants}>
          <div className="kpi-header">
            <div className="kpi-icon-circle" style={{ background: `${statusColor}20`, color: statusColor }}>
              <Award size={24} />
            </div>
            <span className="status-pill" style={{ background: `${statusColor}20`, color: statusColor }}>{overall_mark_status}</span>
          </div>
          <div className="kpi-body">
            <h2 style={{ color: "var(--text-primary)" }}>{overall_avg} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ 25</span></h2>
            <p className="text-muted">Average Internal Score</p>
          </div>
        </motion.div>

        {/* Safe Check KPI */}
        <motion.div className="glass-panel premium-kpi-card" variants={itemVariants} style={{ background: "linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)", border: "1px solid rgba(79, 70, 229, 0.2)" }}>
          <div className="kpi-header">
            <div className="kpi-icon-circle" style={{ background: "rgba(79, 70, 229, 0.1)", color: "#4f46e5" }}>
              {overall_attendance.percentage >= 75 && overall_mark_status === "All Clear" ? <CheckCircle size={24} /> : <Target size={24} />}
            </div>
          </div>
          <div className="kpi-body">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
              {overall_attendance.percentage >= 75 && overall_mark_status === "All Clear" ? "You're all clear! 🎉" : "Action Required"}
            </h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
              Check the detailed roster below to see the exact marks you need in your upcoming tests.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* CHARTS GRID */}
      <motion.div className="chart-grid" variants={containerVariants} initial="hidden" animate="show">
        <motion.div className="glass-panel" variants={itemVariants}>
          <h3>Attendance per Subject</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mergedSubjects} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="shortName" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-input)' }} />
              <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '75%', fill: '#ef4444', fontSize: 10 }} />
              <Bar dataKey="att_perc" name="Attendance %" radius={[4, 4, 0, 0]}>
                {mergedSubjects.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.att_perc < 75 ? "#ef4444" : "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="glass-panel" variants={itemVariants}>
          <h3>Internal Marks per Subject</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mergedSubjects} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="shortName" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-input)' }} />
              <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'Pass (10)', fill: '#f59e0b', fontSize: 10 }} />
              <Bar dataKey="final_score" name="Marks / 25" radius={[4, 4, 0, 0]}>
                {mergedSubjects.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.final_score < 10 && entry.conducted > 1 ? "#ef4444" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>

      {/* COMPREHENSIVE UNIFIED ROSTER */}
      <motion.div className="glass-panel" variants={itemVariants} initial="hidden" animate="show" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <BookOpen size={20} className="text-primary" />
          <h3 style={{ margin: 0 }}>Detailed Academic Progress</h3>
        </div>
        
        <div className="premium-table-wrapper" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '900px' }}>
            <thead style={{ background: 'var(--bg-card)' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Subject</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Faculty</th>
                <th style={{ padding: '1rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.05)' }} colSpan={3}>Attendance</th>
                <th style={{ padding: '1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)' }} colSpan={5}>Internal Assessment (/ 25)</th>
              </tr>
              <tr style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}></th>
                <th style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}></th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>TA</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>TC</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>%</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Tests</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Final Avg</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Target</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {mergedSubjects.map((sub, idx) => {
                const badgeStyle = getStatusColor(sub.status);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', ':hover': { background: 'var(--bg-input)' } }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sub.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sub.code}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{sub.faculty}</td>
                    
                    {/* Attendance Columns */}
                    <td style={{ textAlign: 'center', padding: '1rem', background: 'rgba(99, 102, 241, 0.02)' }}>{sub.ta}</td>
                    <td style={{ textAlign: 'center', padding: '1rem', background: 'rgba(99, 102, 241, 0.02)' }}>{sub.tc}</td>
                    <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 'bold', background: 'rgba(99, 102, 241, 0.02)', color: sub.att_perc < 75 ? '#ef4444' : 'var(--text-primary)' }}>
                      {sub.att_perc}%
                    </td>

                    {/* Marks Columns */}
                    <td style={{ textAlign: 'center', padding: '1rem', background: 'rgba(16, 185, 129, 0.02)' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <span style={{ padding: '2px 6px', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>{sub.it1 ?? '-'}</span>
                        <span style={{ padding: '2px 6px', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>{sub.it2 ?? '-'}</span>
                        <span style={{ padding: '2px 6px', background: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>{sub.it3 ?? '-'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 'bold', fontSize: '1.1rem', background: 'rgba(16, 185, 129, 0.02)' }}>
                      {sub.conducted > 0 ? sub.final_score : '-'}
                    </td>
                    <td style={{ textAlign: 'center', padding: '1rem', background: 'rgba(16, 185, 129, 0.02)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {sub.target}
                    </td>
                    <td style={{ textAlign: 'center', padding: '1rem', background: 'rgba(16, 185, 129, 0.02)' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.bg}` }}>
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default StudentDashboard;