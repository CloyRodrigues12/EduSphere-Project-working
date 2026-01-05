// frontend/src/components/docusense/AnalysisModal.jsx
import React from "react";
import axios from "axios"; // <--- Import Axios
import {
  X,
  Trophy,
  Users,
  Percent,
  TrendingUp,
  BrainCircuit,
  AlertTriangle,
  CheckCircle,
  List,
  Download, // <--- Import Download
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const AnalysisModal = ({ doc, onClose }) => {
  if (!doc || !doc.analysis_data) return null;

  const data = doc.analysis_data;
  const stats = data.batch_stats || data.ai_stats || {};
  const totalStudents =
    stats.total_students || stats.total_students_detected || 0;
  const passRate = stats.overall_pass_percentage || stats.pass_percentage || 0;
  const hasStats = totalStudents > 0;

  // --- NEW: Download Logic inside Modal ---
  const handleDownload = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/docusense/download/${doc.id}/`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `DocuSense_Report_${doc.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed", error);
      alert("Failed to download report.");
    }
  };

  // --- Charts Data Prep ---
  const gradeData = data.grade_distribution
    ? Object.keys(data.grade_distribution)
        .filter((key) => data.grade_distribution[key] > 0)
        .map((key) => ({ name: key, value: data.grade_distribution[key] }))
    : [];

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
  ];

  const subjectData = data.subject_performance
    ? data.subject_performance.map((sub) => ({
        name: sub.subject_code || sub.subject_name?.substring(0, 10),
        marks: sub.average_marks || 0,
        full_name: sub.subject_name,
      }))
    : [];

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "1.5rem",
                color: "var(--text-primary)",
              }}
            >
              {doc.filename}
            </h3>
            <p style={{ margin: "5px 0 0", color: "var(--text-secondary)" }}>
              {data.doc_type === "RESULT"
                ? "📊 University Result Analysis"
                : "📑 Document Analysis"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            {/* Download Button */}
            <button onClick={handleDownload} style={downloadBtnStyle}>
              <Download size={18} /> Download PDF
            </button>
            <button onClick={onClose} style={closeBtnStyle}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={contentStyle}>
          {/* ... (Keep existing layout for KPIs, Charts, Tables) ... */}

          {hasStats && (
            <div style={gridStyle}>
              <KpiCard
                title="Total Students"
                value={totalStudents}
                icon={<Users size={20} color="#3b82f6" />}
                bg="rgba(59, 130, 246, 0.1)"
              />
              <KpiCard
                title="Pass Percentage"
                value={`${passRate}%`}
                icon={
                  <Percent
                    size={20}
                    color={passRate > 70 ? "#22c55e" : "#f59e0b"}
                  />
                }
                bg={
                  passRate > 70
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(245, 158, 11, 0.1)"
                }
              />
              <KpiCard
                title="Average SGPA"
                value={stats.average_sgpa || "N/A"}
                icon={<TrendingUp size={20} color="#8b5cf6" />}
                bg="rgba(139, 92, 246, 0.1)"
              />
              <KpiCard
                title="Fail Count"
                value={stats.fail_count || 0}
                icon={<AlertTriangle size={20} color="#ef4444" />}
                bg="rgba(239, 68, 68, 0.1)"
              />
            </div>
          )}

          {hasStats && (
            <div style={chartsSectionStyle}>
              {gradeData.length > 0 && (
                <div style={cardStyle}>
                  <h4 style={cardTitleStyle}>Grade Distribution</h4>
                  <div style={{ height: "250px", width: "100%" }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={gradeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {gradeData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {subjectData.length > 0 && (
                <div style={cardStyle}>
                  <h4 style={cardTitleStyle}>
                    Subject Performance (Avg Marks)
                  </h4>
                  <div style={{ height: "250px", width: "100%" }}>
                    <ResponsiveContainer>
                      <BarChart data={subjectData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="var(--text-secondary)"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="var(--text-secondary)"
                          fontSize={12}
                          domain={[0, 100]}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="marks"
                          fill="#8884d8"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rank List Table */}
          {data.overall_rank_list && data.overall_rank_list.length > 0 && (
            <div style={{ marginTop: "2rem" }}>
              <h4
                style={{
                  ...cardTitleStyle,
                  fontSize: "1.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <Trophy size={20} color="#f59e0b" /> Top Performers
                (Leaderboard)
              </h4>
              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Rank</th>
                      <th style={thStyle}>Student Name</th>
                      <th style={thStyle}>Score / SGPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overall_rank_list.map((student, idx) => (
                      <tr key={idx} style={trStyle}>
                        <td style={tdStyle}>#{student.rank}</td>
                        <td style={tdStyle}>
                          <b>{student.name}</b>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "#22c55e",
                            fontWeight: "bold",
                          }}
                        >
                          {student.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI Narrative */}
          <div style={{ marginTop: "2rem" }}>
            <div
              style={{
                ...cardStyle,
                marginBottom: "1.5rem",
                borderLeft: "4px solid var(--primary)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <BrainCircuit size={24} color="var(--primary)" />
                <h4 style={{ margin: 0, color: "var(--text-primary)" }}>
                  AI Executive Summary
                </h4>
              </div>
              <p
                style={{
                  color: "var(--text-secondary)",
                  lineHeight: "1.6",
                  fontSize: "1.05rem",
                }}
              >
                {data.summary}
              </p>
            </div>

            <div style={chartsSectionStyle}>
              <div style={cardStyle}>
                <h4 style={cardTitleStyle}>
                  <List
                    size={18}
                    style={{ display: "inline", marginRight: "8px" }}
                  />{" "}
                  Key Insights
                </h4>
                <ul style={listStyle}>
                  {data.key_points?.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
              <div style={cardStyle}>
                <h4 style={cardTitleStyle}>
                  <CheckCircle
                    size={18}
                    style={{ display: "inline", marginRight: "8px" }}
                  />{" "}
                  Recommended Actions
                </h4>
                <ul style={listStyle}>
                  {data.recommendations?.length > 0 ? (
                    data.recommendations.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))
                  ) : (
                    <li>No urgent actions detected.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- STYLES ---
const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalStyle = {
  width: "90%",
  maxWidth: "1000px",
  maxHeight: "90vh",
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--glass-border)",
  borderRadius: "24px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--shadow-lg)",
};
const headerStyle = {
  padding: "1.5rem 2rem",
  borderBottom: "1px solid var(--glass-border)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const contentStyle = { padding: "2rem", overflowY: "auto" };
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1.5rem",
  marginBottom: "2rem",
};
const chartsSectionStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
  gap: "1.5rem",
};
const cardStyle = {
  backgroundColor: "var(--bg-main)",
  padding: "1.5rem",
  borderRadius: "16px",
  border: "1px solid var(--glass-border)",
};
const cardTitleStyle = {
  margin: "0 0 1rem 0",
  color: "var(--text-primary)",
  fontSize: "1rem",
};
const listStyle = {
  paddingLeft: "1.2rem",
  color: "var(--text-secondary)",
  lineHeight: "1.8",
};
const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  cursor: "pointer",
  padding: "0.5rem",
};
const downloadBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
};
const tableContainerStyle = {
  overflowX: "auto",
  borderRadius: "12px",
  border: "1px solid var(--glass-border)",
};
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  backgroundColor: "var(--bg-main)",
};
const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  borderBottom: "1px solid var(--glass-border)",
  color: "var(--text-secondary)",
  fontSize: "0.9rem",
};
const trStyle = { borderBottom: "1px solid var(--glass-border)" };
const tdStyle = {
  padding: "12px 16px",
  color: "var(--text-primary)",
  fontSize: "0.95rem",
};

const KpiCard = ({ title, value, icon, bg }) => (
  <div
    style={{ ...cardStyle, display: "flex", alignItems: "center", gap: "1rem" }}
  >
    <div style={{ padding: "12px", borderRadius: "12px", background: bg }}>
      {icon}
    </div>
    <div>
      <p
        style={{
          margin: 0,
          fontSize: "0.85rem",
          color: "var(--text-secondary)",
        }}
      >
        {title}
      </p>
      <h4
        style={{
          margin: "4px 0 0",
          fontSize: "1.5rem",
          color: "var(--text-primary)",
        }}
      >
        {value}
      </h4>
    </div>
  </div>
);

export default AnalysisModal;
