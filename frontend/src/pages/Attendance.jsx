import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { attendanceService, academicService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useAcademic } from "../context/AcademicContext";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Users,
  CheckCircle,
  XCircle,
  Save,
  BookOpen,
  Star,
  Search,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
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
  const [sessions, setSessions] = useState([]); // Used for both global and specific classes
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search & View Modes
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [newSessionData, setNewSessionData] = useState({
    date: new Date().toISOString().split("T")[0],
    lecture_count: 1,
    topics_covered: "",
  });

  useEffect(() => {
    if (!allocationId) {
      if (activeAcademicYear) {
        fetchClasses();
        fetchGlobalSessions();
      }
    } else {
      fetchSessions();
    }
  }, [allocationId, activeAcademicYear]);

  const fetchClasses = async () => {
    try {
      if (
        user?.role_code === "ORG_ADMIN" ||
        user?.role_code === "SUPER_ADMIN"
      ) {
        const res = await academicService.getAllocations(activeAcademicYear.id);
        const myUserId = user?.pk || user?.id;
        const sortedClasses = res.data
          .map((alloc) => ({
            ...alloc,
            isMine: alloc.faculty_user_id === myUserId,
          }))
          .sort((a, b) => (a.isMine === b.isMine ? 0 : a.isMine ? -1 : 1));
        setMyClasses(sortedClasses);
      } else {
        const res = await academicService.getMyClasses();
        setMyClasses(res.data.map((alloc) => ({ ...alloc, isMine: true })));
      }
    } catch (err) {
      console.error("Failed to load classes", err);
    }
  };

  const fetchGlobalSessions = async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getSessions();
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load global sessions", err);
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

  const handleDeleteSession = async () => {
    try {
      await attendanceService.deleteSession(sessionToDelete);
      setSessions(sessions.filter((s) => s.id !== sessionToDelete));
      setSessionToDelete(null);
    } catch (err) {
      alert("Failed to delete session.");
    }
  };

  const handleBulkStatusChange = (newStatus) => {
    const updatedRecords = activeSession.records.map((r) => ({
      ...r,
      status: newStatus,
    }));
    setActiveSession({ ...activeSession, records: updatedRecords });
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
      if (!allocationId) fetchGlobalSessions();
      else fetchSessions();
    } catch (err) {
      alert("Failed to save attendance.");
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const term = searchTerm.toLowerCase();
    const dateStr = new Date(session.date)
      .toLocaleDateString("en-GB")
      .toLowerCase();
    const topicStr = (session.topics_covered || "").toLowerCase();
    const subStr = (session.subject_name || "").toLowerCase();
    return (
      dateStr.includes(term) || topicStr.includes(term) || subStr.includes(term)
    );
  });

  const renderCalendar = (sessionsToUse) => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const allCells = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
      <div className="att-calendar-wrapper glass-panel fade-in">
        <div className="att-cal-header">
          <button
            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
            className="att-icon-btn"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 style={{ margin: 0 }}>
            {calendarDate.toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </h3>
          <button
            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
            className="att-icon-btn"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="att-cal-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="att-cal-day-label">
              {d}
            </div>
          ))}
          {allCells.map((day, idx) => {
            if (!day)
              return (
                <div key={`blank-${idx}`} className="att-cal-cell empty"></div>
              );

            const cellDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const daySessions = sessionsToUse.filter(
              (s) => s.date === cellDateStr,
            );
            const hasSessions = daySessions.length > 0;
            const isSelected = selectedCalendarDate === cellDateStr;

            return (
              <div
                key={`day-${day}`}
                className={`att-cal-cell ${hasSessions ? "has-data" : ""} ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  if (hasSessions)
                    setSelectedCalendarDate(
                      cellDateStr === selectedCalendarDate ? null : cellDateStr,
                    );
                }}
              >
                <span className="att-cal-date-num">{day}</span>
                {hasSessions && (
                  <div className="att-cal-dot-indicator">
                    {daySessions.length} classes
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedCalendarDate && (
          <div className="att-cal-selected-sessions slide-up-fade">
            <h4
              style={{
                marginTop: "1.5rem",
                marginBottom: "1rem",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "0.5rem",
              }}
            >
              Sessions on{" "}
              {new Date(selectedCalendarDate).toLocaleDateString("en-GB")}
            </h4>
            <div className="att-session-list">
              {sessionsToUse
                .filter((s) => s.date === selectedCalendarDate)
                .map((session) => renderSessionCard(session, !allocationId))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSessionCard = (session, showSubjectName = false) => {
    const presentCount =
      session.records?.filter((r) =>
        [
          "PRESENT",
          "LATE",
          "DUTY_SPORTS",
          "DUTY_CULTURE",
          "DUTY_OTHER",
        ].includes(r.status),
      ).length || 0;
    const timeRecorded = session.updated_at
      ? new Date(session.updated_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "N/A";

    return (
      <div key={session.id} className="att-session-row">
        <div
          className="att-session-info"
          onClick={() => setActiveSession(session)}
          style={{ cursor: "pointer", flex: 1 }}
        >
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CalendarIcon size={16} className="text-primary" />
            {showSubjectName
              ? `${session.subject_name} (${session.group_name})`
              : new Date(session.date).toLocaleDateString("en-GB")}
          </h4>
          <span style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {showSubjectName && (
              <span>
                <CalendarIcon size={12} />{" "}
                {new Date(session.date).toLocaleDateString("en-GB")}
              </span>
            )}
            <span>
              <Clock size={12} /> {session.lecture_count} Hr
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              ⏱ Recorded at {timeRecorded}
            </span>
            {session.topics_covered && <span> • {session.topics_covered}</span>}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div className="att-stat-pill">
            <Users size={14} /> {presentCount} / {session.records?.length || 0}
          </div>

          {/* SAFEGUARD: Only show the delete button if we are inside a specific class (allocationId exists) */}
          {allocationId && (
            <button
              className="att-icon-btn delete-btn"
              title="Delete Session"
              onClick={(e) => {
                e.stopPropagation();
                setSessionToDelete(session.id);
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading)
    return <div className="spinner" style={{ margin: "5rem auto" }}></div>;

  // VIEW 1: LANDING PAGE (With Global Calendar)
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

        <div className="att-panel-toolbar glass-panel">
          <div className="att-view-toggle">
            <button
              className={viewMode === "list" ? "active" : ""}
              onClick={() => setViewMode("list")}
            >
              <BookOpen size={18} /> My Classes
            </button>
            <button
              className={viewMode === "calendar" ? "active" : ""}
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays size={18} /> Global Calendar
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
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

                {/* RESTORED FACULTY NAMES */}
                <div className="att-card-details">
                  <h3>{alloc.subject_name}</h3>
                  <p>
                    {alloc.group_name} • {alloc.subject_type?.replace("_", " ")}
                    <br />
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
                  Select Class
                </button>
              </motion.div>
            ))}
            {myClasses.length === 0 && (
              <div className="att-empty-state">
                No classes found for this academic year.
              </div>
            )}
          </div>
        ) : (
          renderCalendar(sessions)
        )}

        {activeSession && (
          <div className="att-modal-overlay">
            <div
              className="att-modal-content"
              style={{
                width: "95%",
                maxWidth: "800px",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div className="att-modal-header">
                <div>
                  <h3>{activeSession.subject_name}</h3>
                  <p>{activeSession.group_name}</p>
                </div>
                <button
                  onClick={() => setActiveSession(null)}
                  className="att-close-btn"
                >
                  &times;
                </button>
              </div>
              <RollCallGrid
                session={activeSession}
                onStatusChange={handleStatusChange}
                onBulkStatusChange={handleBulkStatusChange}
                onSave={handleSaveAttendance}
              />
            </div>
          </div>
        )}
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
          onBulkStatusChange={handleBulkStatusChange}
          onSave={handleSaveAttendance}
        />
      ) : (
        <div className="att-history-view slide-up-fade">
          <div className="att-panel-toolbar glass-panel">
            <div className="att-search-wrapper">
              <Search size={18} className="text-muted" />
              <input
                type="text"
                placeholder="Search by date or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="att-toolbar-actions">
              <div className="att-view-toggle">
                <button
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  <List size={18} />
                </button>
                <button
                  className={viewMode === "calendar" ? "active" : ""}
                  onClick={() => setViewMode("calendar")}
                >
                  <CalendarDays size={18} />
                </button>
              </div>
              <button
                className="att-btn att-btn-primary"
                onClick={() => setShowNewModal(true)}
              >
                <Plus size={18} /> Record New Session
              </button>
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="att-session-list">
              {filteredSessions.map((session) => renderSessionCard(session))}
              {filteredSessions.length === 0 && (
                <div className="att-empty-state">
                  No matching attendance records found.
                </div>
              )}
            </div>
          ) : (
            renderCalendar(filteredSessions)
          )}
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {sessionToDelete && (
          <div className="att-modal-overlay">
            <motion.div
              className="att-modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div style={{ textAlign: "center" }}>
                <AlertTriangle
                  size={48}
                  color="#ef4444"
                  style={{ marginBottom: "1rem" }}
                />
                <h3>Delete Session?</h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  This will permanently remove the attendance record for this
                  entire class. This action cannot be undone.
                </p>
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "2rem" }}
                >
                  <button
                    className="att-btn att-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setSessionToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="att-btn"
                    style={{
                      flex: 1,
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                    }}
                    onClick={handleDeleteSession}
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

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
const RollCallGrid = ({
  session,
  onStatusChange,
  onBulkStatusChange,
  onSave,
}) => (
  <div className="att-roll-call slide-up-fade">
    <div
      className="att-panel-header"
      style={{ flexDirection: "column", alignItems: "stretch", gap: "1rem" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
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
      <div
        style={{
          display: "flex",
          gap: "10px",
          borderTop: "1px dashed var(--border-color)",
          paddingTop: "1rem",
        }}
      >
        <button
          className="att-btn att-btn-secondary"
          style={{ flex: 1, color: "#10b981", borderColor: "#10b981" }}
          onClick={() => onBulkStatusChange("PRESENT")}
        >
          <CheckCircle size={18} /> Mark All Present
        </button>
        <button
          className="att-btn att-btn-secondary"
          style={{ flex: 1, color: "#ef4444", borderColor: "#ef4444" }}
          onClick={() => onBulkStatusChange("ABSENT")}
        >
          <XCircle size={18} /> Mark All Absent
        </button>
      </div>
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
