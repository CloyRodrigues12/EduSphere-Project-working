import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { attendanceService, academicService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useAcademic } from "../context/AcademicContext";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Users,
  CheckCircle,
  XCircle,
  Save,
  BookOpen,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Attendance.css";

const Attendance = () => {
  const { allocationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const { activeAcademicYear } = useAcademic();

  const { subjectName, groupName } = location.state || {
    subjectName: "Class Details",
    groupName: "Batch",
  };

  const [myClasses, setMyClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    date: new Date().toISOString().split("T")[0],
    lecture_count: 1,
    topics_covered: "",
  });

  useEffect(() => {
    if (!allocationId) {
      if (activeAcademicYear) fetchClasses();
    } else {
      fetchSessions();
    }
  }, [allocationId, activeAcademicYear]);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      if (
        user?.role_code === "ORG_ADMIN" ||
        user?.role_code === "SUPER_ADMIN"
      ) {
        const res = await academicService.getAllocations(activeAcademicYear.id);

        // BULLETPROOF "MY CLASS" LOGIC (Matches by ID)
        const myUserId = user?.pk || user?.id;

        const sortedClasses = res.data
          .map((alloc) => {
            const isMine = alloc.faculty_user_id === myUserId;
            return { ...alloc, isMine };
          })
          .sort((a, b) => (a.isMine === b.isMine ? 0 : a.isMine ? -1 : 1));

        setMyClasses(sortedClasses);
      } else {
        const res = await academicService.getMyClasses();
        setMyClasses(res.data.map((alloc) => ({ ...alloc, isMine: true })));
      }
    } catch (err) {
      console.error("Failed to load classes", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getSessions(allocationId);
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const res = await attendanceService.createSession({
        allocation_id: allocationId,
        ...newSessionData,
      });
      setSessions([res.data, ...sessions]);
      setShowNewModal(false);
      setActiveSession(res.data);
    } catch (err) {
      alert("Failed to create session.");
    }
  };

  const handleStatusChange = (recordId, newStatus) => {
    const updatedRecords = activeSession.records.map((r) =>
      r.id === recordId ? { ...r, status: newStatus } : r,
    );
    setActiveSession({ ...activeSession, records: updatedRecords });
  };

  const handleSaveAttendance = async () => {
    try {
      await attendanceService.updateAttendance(activeSession.records);
      setActiveSession(null);
      fetchSessions();
    } catch (err) {
      alert("Failed to save attendance.");
    }
  };

  if (loading)
    return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  // VIEW 1: LANDING PAGE
  if (!allocationId) {
    return (
      <div id="attendance-engine-root" className="fade-in">
        <div className="att-header-section">
          <h1 className="att-title">Attendance Management</h1>
          <p className="att-subtitle">
            {user?.role_code === "ORG_ADMIN"
              ? "College-wide class directory"
              : "Select a class to record or view attendance"}
          </p>
        </div>

        <div className="att-grid-layout mt-4">
          {myClasses.map((alloc) => (
            <motion.div
              key={alloc.id}
              className={`att-card ${alloc.isMine ? "att-card-mine" : ""}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {alloc.isMine && (
                <div className="att-ribbon">
                  <Star size={12} fill="currentColor" /> My Class
                </div>
              )}

              <div className="att-card-icon">
                <BookOpen size={24} />
              </div>
              <div className="att-card-details">
                <h3>{alloc.subject_name}</h3>
                <p>
                  {alloc.group_name} • {alloc.subject_type?.replace("_", " ")}
                  <br />
                  {/* FIX: Removed !alloc.isMine so the badge ALWAYS shows for Admins */}
                  {(user?.role_code === "ORG_ADMIN" ||
                    user?.role_code === "SUPER_ADMIN") && (
                    <span className="att-prof-badge">
                      👨‍🏫 Prof. {alloc.faculty_name}
                    </span>
                  )}
                </p>
              </div>
              <button
                className={`att-btn ${alloc.isMine ? "att-btn-primary" : "att-btn-secondary"}`}
                onClick={() =>
                  navigate(`/attendance/${alloc.id}`, {
                    state: {
                      subjectName: alloc.subject_name,
                      groupName: alloc.group_name,
                    },
                  })
                }
              >
                {alloc.isMine ? "Take Attendance" : "Audit Attendance"}
              </button>
            </motion.div>
          ))}
          {myClasses.length === 0 && (
            <div className="att-empty-state">
              No classes found for this academic year.
            </div>
          )}
        </div>
      </div>
    );
  }

  // VIEW 2: SPECIFIC CLASS VIEW
  return (
    <div id="attendance-engine-root" className="fade-in">
      <div className="att-header-section with-back">
        <button
          className="att-back-btn"
          onClick={() =>
            activeSession ? setActiveSession(null) : navigate("/attendance")
          }
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="att-title">{subjectName}</h1>
          <p className="att-subtitle">{groupName} • Attendance & Grading</p>
        </div>
      </div>

      {activeSession ? (
        <RollCallGrid
          session={activeSession}
          onStatusChange={handleStatusChange}
          onSave={handleSaveAttendance}
        />
      ) : (
        <div className="att-history-view slide-up-fade">
          <div className="att-panel-header">
            <div>
              <h3>Attendance Log</h3>
              <p>{sessions.length} sessions recorded</p>
            </div>
            <button
              className="att-btn att-btn-primary"
              onClick={() => setShowNewModal(true)}
            >
              <Plus size={18} /> Record New Session
            </button>
          </div>

          <div className="att-session-list">
            {sessions.map((session) => {
              const presentCount = session.records.filter((r) =>
                [
                  "PRESENT",
                  "LATE",
                  "DUTY_SPORTS",
                  "DUTY_CULTURE",
                  "DUTY_OTHER",
                ].includes(r.status),
              ).length;
              return (
                <div
                  key={session.id}
                  className="att-session-row"
                  onClick={() => setActiveSession(session)}
                >
                  <div className="att-session-info">
                    <h4>
                      <Calendar size={16} />{" "}
                      {new Date(session.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </h4>
                    <span>
                      <Clock size={14} /> {session.lecture_count} Hour
                      {session.lecture_count > 1 ? "s" : ""}{" "}
                      {session.topics_covered && ` • ${session.topics_covered}`}
                    </span>
                  </div>
                  <div className="att-session-stats">
                    <div className="att-stat-pill">
                      <Users size={14} /> {presentCount} /{" "}
                      {session.records.length} Present
                    </div>
                  </div>
                </div>
              );
            })}
            {sessions.length === 0 && (
              <div className="att-empty-state">No attendance recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* NEW SESSION MODAL */}
      <AnimatePresence>
        {showNewModal && (
          <div className="att-modal-overlay">
            <motion.div
              className="att-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <div className="att-modal-header">
                <div>
                  <h3>Record New Session</h3>
                  <p>Auto-filled for today's class.</p>
                </div>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="att-close-btn"
                >
                  &times;
                </button>
              </div>
              <form onSubmit={handleCreateSession} className="att-form">
                <div className="att-input-group">
                  <label>Date</label>
                  <input
                    type="date"
                    required
                    value={newSessionData.date}
                    onChange={(e) =>
                      setNewSessionData({
                        ...newSessionData,
                        date: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="att-input-group">
                  <label>Duration (Multiplier)</label>
                  <select
                    value={newSessionData.lecture_count}
                    onChange={(e) =>
                      setNewSessionData({
                        ...newSessionData,
                        lecture_count: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value={1}>1 Hour (Standard)</option>
                    <option value={2}>2 Hours (Lab/Extended)</option>
                    <option value={3}>3 Hours (Workshop)</option>
                  </select>
                </div>
                <div className="att-input-group">
                  <label>Topics Covered (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Normalization, B-Trees"
                    value={newSessionData.topics_covered}
                    onChange={(e) =>
                      setNewSessionData({
                        ...newSessionData,
                        topics_covered: e.target.value,
                      })
                    }
                  />
                </div>
                <div style={{ marginTop: "2rem" }}>
                  <button
                    type="submit"
                    className="att-btn att-btn-primary"
                    style={{ width: "100%" }}
                  >
                    Proceed to Roll Call ➔
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ROLL CALL GRID
const RollCallGrid = ({ session, onStatusChange, onSave }) => (
  <div className="att-roll-call slide-up-fade">
    <div className="att-panel-header">
      <div>
        <h3 style={{ margin: "0 0 4px 0" }}>
          Date: {new Date(session.date).toLocaleDateString("en-GB")}
        </h3>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Tap a student's status to change it.
        </p>
      </div>
      <button className="att-btn att-btn-primary" onClick={onSave}>
        <Save size={18} /> Save Attendance
      </button>
    </div>

    <div className="att-student-list">
      {session.records.map((record) => (
        <div
          key={record.id}
          className={`att-student-row att-status-${record.status.toLowerCase()}`}
        >
          <div className="att-student-identity">
            <span className="att-roll">{record.roll_number}</span>
            <span className="att-name">{record.student_name}</span>
          </div>
          <div className="att-actions">
            <button
              className={`att-tap present ${record.status === "PRESENT" ? "active" : ""}`}
              onClick={() => onStatusChange(record.id, "PRESENT")}
            >
              <CheckCircle size={18} /> Present
            </button>
            <button
              className={`att-tap absent ${record.status === "ABSENT" ? "active" : ""}`}
              onClick={() => onStatusChange(record.id, "ABSENT")}
            >
              <XCircle size={18} /> Absent
            </button>
            <select
              className={`att-tap duty ${record.status.startsWith("DUTY") || record.status === "LATE" ? "active" : ""}`}
              value={
                record.status.startsWith("DUTY") || record.status === "LATE"
                  ? record.status
                  : "DEFAULT"
              }
              onChange={(e) => onStatusChange(record.id, e.target.value)}
            >
              <option value="DEFAULT" disabled>
                Duty/Late...
              </option>
              <option value="LATE">Late</option>
              <option value="DUTY_SPORTS">Duty - Sports</option>
              <option value="DUTY_CULTURE">Duty - Cultural</option>
              <option value="DUTY_OTHER">Duty - Other</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Attendance;
