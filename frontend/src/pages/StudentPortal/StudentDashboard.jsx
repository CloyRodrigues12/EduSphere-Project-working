import React, { useState, useEffect } from "react";
import { useAcademic } from "../../context/AcademicContext";
import { 
  Award, HeartHandshake, AlertTriangle, BookOpen, Activity 
} from "lucide-react";
import axios from "axios";
import { motion } from "framer-motion";
import "./StudentDashboard.css";

const StudentDashboard = () => {
  const { activeAcademicYear } = useAcademic();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeAcademicYear) fetchDashboard();
  }, [activeAcademicYear]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      // Direct call to the new Student Portal API
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/student-portal/dashboard/`, {
        params: { academic_year_id: activeAcademicYear.id }
      });
      setData(res.data);
    } catch (err) {
      console.error("Failed to load student data", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="spinner" style={{ margin: "5rem auto" }}></div>;
  if (!data) return <div className="error-state">Failed to load portal data.</div>;

  const { student_info, support_system, overall_attendance } = data;

  return (
    <div className="student-dashboard-container fade-in">
      <div className="welcome-section">
        <h1 className="page-title">Welcome, {student_info.name.split(' ')[0]}</h1>
        <p className="page-subtitle">Academic Year: {activeAcademicYear.name} • Semester {student_info.semester}</p>
      </div>

      <div className="student-grid">
        {/* SUPPORT SYSTEM */}
        <motion.div className="glass-panel support-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h3>Academic Mentorship</h3>
          <div className="support-item">
            <div className="icon-box primary"><Award size={20} /></div>
            <div>
              <p className="label">Class Teacher</p>
              <p className="value">{support_system.class_teacher}</p>
            </div>
          </div>
          <div className="support-item">
            <div className="icon-box secondary"><HeartHandshake size={20} /></div>
            <div>
              <p className="label">Assigned Mentor</p>
              <p className="value">{support_system.mentor}</p>
            </div>
          </div>
        </motion.div>

        {/* OVERALL ATTENDANCE */}
        <motion.div className="glass-panel radar-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3>Overall Attendance</h3>
          <div className="radar-content">
            <div className="percentage-display">
              <h2 style={{ color: overall_attendance.percentage < 75 ? "#ef4444" : overall_attendance.percentage < 80 ? "#f59e0b" : "#10b981" }}>
                {overall_attendance.percentage}%
              </h2>
              <span className={`status-pill ${overall_attendance.status.toLowerCase()}`}>{overall_attendance.status}</span>
            </div>
            <div className="mini-stats">
               <p className="label">Hours Attended: <strong>{overall_attendance.ta}</strong></p>
               <p className="label">Total Conducted: <strong>{overall_attendance.tc}</strong></p>
            </div>
          </div>
          {overall_attendance.percentage < 75 && (
            <div className="warning-banner">
              <AlertTriangle size={16} />
              <span>Low Attendance! Please consult your Mentor.</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* SUBJECT LIST PREVIEW */}
      <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Subject Breakdown</h3>
      <div className="subject-list">
        {data.subjects.map(sub => (
          <div key={sub.subject_code} className="glass-panel subject-item-row">
            <div className="sub-info">
              <span className="sub-code">{sub.subject_code}</span>
              <span className="sub-name">{sub.subject_name}</span>
            </div>
            <div className="sub-perc" style={{ color: sub.percentage < 75 ? "#ef4444" : "#10b981" }}>
              {sub.percentage}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentDashboard;