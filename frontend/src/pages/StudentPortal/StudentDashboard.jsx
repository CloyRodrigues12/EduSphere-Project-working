import React, { useState, useEffect } from "react";
import { useAcademic } from "../../context/AcademicContext";
import { 
  Award, HeartHandshake, AlertTriangle, BookOpen, Activity, Target, ShieldCheck, CheckCircle, TrendingUp, Users
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import "./StudentDashboard.css";

// IMPORT THE MATH ENGINE TO CALCULATE TARGETS
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
  const [insightCounter, setInsightCounter] = useState(0);

  useEffect(() => {
    if (activeAcademicYear && activeTerm) fetchDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeTerm]);

  useEffect(() => {
    const interval = setInterval(() => {
      setInsightCounter((prev) => prev + 1); 
    }, 4500); 
    return () => clearInterval(interval);
  }, []);

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

  const mergedSubjects = [];
  const attMap = new Map();
  attendance_subjects.forEach(sub => attMap.set(sub.subject_code, sub));
  
  const marksMap = new Map();
  marks_subjects.forEach(sub => {
      const evalRes = evaluateMarks(sub.it1, sub.it2, sub.it3);
      marksMap.set(sub.subject_code, { ...sub, ...evalRes, rank: sub.rank });
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
          else if (["ON TRACK", "CLEARED"].includes(mrk.status)) s_on_track = true;
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
          status: mrk.status || "PENDING",
          rank: mrk.rank || "-" 
      });
  });

  const overall_avg = validScoreCount > 0 ? (totalScore / validScoreCount).toFixed(1) : 0;
  let overall_mark_status = "All Clear";
  let statusColor = "#10b981";
  
  if (s_pending && validScoreCount === 0) { overall_mark_status = "Pending"; statusColor = "#9ca3af"; }
  else if (s_fail) { overall_mark_status = "Failing"; statusColor = "#ef4444"; }
  else if (s_risk) { overall_mark_status = "At Risk"; statusColor = "#f59e0b"; }
  else if (s_on_track) { overall_mark_status = "On Track"; statusColor = "#3b82f6"; }

  const generateInsights = () => {
    const insights = [];

    const failingSubs = mergedSubjects.filter(s => ["FAILING", "FAILED"].includes(s.status));
    const riskSubs = mergedSubjects.filter(s => ["NEEDS EFFORT", "CRITICAL"].includes(s.status));
    const lowAttSubs = mergedSubjects.filter(s => s.att_perc < 75);
    const pendingSubs = mergedSubjects.filter(s => s.conducted === 0);
    const excellentSubs = mergedSubjects.filter(s => s.conducted > 0 && s.final_score >= 18);
    const topRankSubs = mergedSubjects.filter(s => s.conducted > 0 && typeof s.rank === 'number' && s.rank <= 3);
    const top10Subs = mergedSubjects.filter(s => s.conducted > 0 && typeof s.rank === 'number' && s.rank > 3 && s.rank <= 10);

    // 1. Overall Attendance
    if (overall_attendance.percentage < 75) {
      insights.push({ icon: AlertTriangle, color: "#ef4444", rgb: "239, 68, 68", title: "Critical Attendance", desc: `Overall attendance is ${overall_attendance.percentage}%. You are at risk of debarment.` });
    } else if (overall_attendance.percentage < 80) {
      insights.push({ icon: Activity, color: "#f59e0b", rgb: "245, 158, 11", title: "Attendance Warning", desc: `Overall attendance is ${overall_attendance.percentage}%. You are close to the 75% limit.` });
    } else if (overall_attendance.percentage >= 95) {
      insights.push({ icon: ShieldCheck, color: "#10b981", rgb: "16, 185, 129", title: "Stellar Attendance 🌟", desc: `You have an incredible ${overall_attendance.percentage}% overall attendance. Great dedication!` });
    }

    // 2. Failing & Low Attendance Subjects
    if (failingSubs.length > 1) {
      insights.push({ icon: AlertTriangle, color: "#ef4444", rgb: "239, 68, 68", title: `Failing ${failingSubs.length} Subjects`, desc: `You are critically failing ${failingSubs.map(s => s.shortName).join(', ')}. Intervention required.` });
    } else if (failingSubs.length === 1) {
      insights.push({ icon: AlertTriangle, color: "#ef4444", rgb: "239, 68, 68", title: `Failing: ${failingSubs[0].shortName}`, desc: `You are critically failing ${failingSubs[0].name}. Immediate intervention required.` });
    }

    if (lowAttSubs.length > 1) {
      insights.push({ icon: Activity, color: "#f43f5e", rgb: "244, 63, 94", title: `Low Attendance in ${lowAttSubs.length} Subjects`, desc: `Attendance is below 75% in ${lowAttSubs.map(s => s.shortName).join(', ')}. Attend next classes.` });
    } else if (lowAttSubs.length === 1) {
      insights.push({ icon: Activity, color: "#f43f5e", rgb: "244, 63, 94", title: `Low Attendance: ${lowAttSubs[0].shortName}`, desc: `Your attendance in ${lowAttSubs[0].shortName} is ${lowAttSubs[0].att_perc}%. Attend the next class.` });
    }

    // 3. Targets / At Risk
    if (riskSubs.length > 0 && insights.length < 4) { 
       insights.push({ icon: Target, color: "#f59e0b", rgb: "245, 158, 11", title: `Needs Effort: ${riskSubs.length} Subject(s)`, desc: `You have high target requirements to pass ${riskSubs.map(s => s.shortName).join(', ')}.` });
    }

    // 4. Positive Reinforcements & Rankings
    if (failingSubs.length === 0 && lowAttSubs.length === 0) {
      if (topRankSubs.length > 0) {
         const best = topRankSubs.sort((a,b) => a.rank - b.rank)[0];
         insights.push({ icon: Award, color: "#eab308", rgb: "234, 179, 8", title: "Class Leaderboard 🏆", desc: `Incredible! You are Rank #${best.rank} in ${best.shortName} with ${best.final_score}/25.` });
      } else if (top10Subs.length > 0) {
         const best = top10Subs.sort((a,b) => a.rank - b.rank)[0];
         insights.push({ icon: TrendingUp, color: "#3b82f6", rgb: "59, 130, 246", title: "Top 10 Performer 🔥", desc: `You are Rank #${best.rank} in ${best.shortName}. Push a little harder to hit the Top 3!` });
      }
      
      if (excellentSubs.length > 0 && topRankSubs.length === 0) {
         insights.push({ icon: Award, color: "#8b5cf6", rgb: "139, 92, 246", title: "High Scorer ⭐", desc: `You scored an impressive ${excellentSubs[0].final_score}/25 in ${excellentSubs[0].shortName}!` });
      }

      if (validScoreCount > 0 && overall_avg >= 12 && topRankSubs.length === 0 && top10Subs.length === 0 && excellentSubs.length === 0) {
         insights.push({ icon: TrendingUp, color: "#3b82f6", rgb: "59, 130, 246", title: "Solid Progress 📈", desc: `You are maintaining a steady passing average of ${overall_avg}/25. Good start!` });
      }
    }

    // 5. Actionable Pending Tests
    if (pendingSubs.length > 0 && insights.length < 5) {
      insights.push({ icon: BookOpen, color: "#6366f1", rgb: "99, 102, 241", title: "Upcoming Tests 📝", desc: `You have ${pendingSubs.length} subject(s) with pending internal tests. Time to prepare!` });
    }

    // 6. Fallback
    if (insights.length === 0) {
      insights.push({ icon: ShieldCheck, color: "#10b981", rgb: "16, 185, 129", title: "You're All Clear! 🎉", desc: "Your attendance and marks are perfectly on track. Keep up the excellent work!" });
    }

    return insights.slice(0, 5); 
  };

  const activeInsights = generateInsights();
  const currentSafeIdx = activeInsights.length > 0 ? (insightCounter % activeInsights.length) : 0;
  const ActiveInsight = activeInsights[currentSafeIdx];
  const CurrentInsightIcon = ActiveInsight?.icon || CheckCircle;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="student-dashboard-container fade-in">
      
      {/* HEADER */}
      <div className="dashboard-header glass-panel">
        <div className="welcome-section">
          <h1>Welcome, <span>{student_info.name.split(' ')[0]}</span> 👋</h1>
          <p>{student_info.department} • Semester {student_info.semester} • {activeTerm} Term</p>
          <span className="badge mt-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
            Roll No: {student_info.roll_number}
            &nbsp;|&nbsp; Enrollment No: {student_info.enrollment_number}
            </span>
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
        
        {/* Attendance KPI (Strict Height) */}
        <motion.div 
          className="glass-panel premium-kpi-card" 
          variants={itemVariants}
          style={{ height: '190px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
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

        {/* Academic Marks KPI (Strict Height) */}
        <motion.div 
          className="glass-panel premium-kpi-card" 
          variants={itemVariants}
          style={{ height: '190px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
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

        {/* AUTO-FLIPPING SMART INSIGHTS CARD (Strict Height) */}
        <motion.div 
          className="glass-panel premium-kpi-card" 
          variants={itemVariants} 
          style={{ 
            height: '190px', 
            padding: 0, overflow: 'hidden', perspective: "1000px",
            border: `1px solid rgba(${ActiveInsight?.rgb}, 0.3)`,
            boxShadow: `0 10px 30px -10px rgba(${ActiveInsight?.rgb}, 0.2)`,
            transition: "all 0.5s ease"
          }}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={currentSafeIdx}
              initial={{ rotateX: -90, opacity: 0, zIndex: 0 }}
              animate={{ rotateX: 0, opacity: 1, zIndex: 1 }}
              exit={{ rotateX: 90, opacity: 0, zIndex: 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 120, damping: 15 }}
              style={{ 
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0, padding: "1.5rem",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                background: `linear-gradient(135deg, rgba(${ActiveInsight?.rgb}, 0.15) 0%, transparent 100%)`,
                backfaceVisibility: "hidden"
              }}
            >
              <div className="kpi-header">
                <div 
                  className="kpi-icon-circle pulse" 
                  style={{ background: `rgba(${ActiveInsight?.rgb}, 0.25)`, color: ActiveInsight?.color, "--pulse-color": ActiveInsight?.rgb }}
                >
                  <CurrentInsightIcon size={24} />
                </div>
                {activeInsights.length > 1 && (
                  <span className="badge" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: `1px solid rgba(${ActiveInsight?.rgb}, 0.3)` }}>
                    Insight {currentSafeIdx + 1}/{activeInsights.length}
                  </span>
                )}
              </div>
              <div className="kpi-body">
                <h3 style={{ fontSize: '1.15rem', marginBottom: '6px', color: ActiveInsight?.color, fontWeight: 700 }}>
                  {ActiveInsight?.title}
                </h3>
                <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4', margin: 0 }}>
                  {ActiveInsight?.desc}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
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
          <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
            <thead style={{ background: 'var(--bg-card)' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Subject</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Faculty</th>
                <th style={{ padding: '1rem', textAlign: 'center', background: 'rgba(99, 102, 241, 0.05)' }} colSpan={3}>Attendance</th>
                <th style={{ padding: '1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)' }} colSpan={6}>Internal Assessment (/ 25)</th>
              </tr>
              <tr style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}></th>
                <th style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)' }}></th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>TA</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>TC</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>%</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Tests</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Final Avg</th>
                <th style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', background: 'rgba(16, 185, 129, 0.05)' }}>Rank</th>
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
                    
                    <td style={{ textAlign: 'center', padding: '1rem', background: 'rgba(16, 185, 129, 0.02)', fontWeight: 'bold', color: typeof sub.rank === 'number' && sub.rank <= 3 ? '#eab308' : 'var(--text-secondary)' }}>
                      {sub.rank !== "-" ? `#${sub.rank}` : "-"}
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