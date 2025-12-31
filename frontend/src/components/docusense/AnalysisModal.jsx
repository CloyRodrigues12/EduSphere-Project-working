// frontend/src/components/docusense/AnalysisModal.jsx
import React from "react";
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
  FileText,
  Activity,
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
} from "recharts";

const AnalysisModal = ({ doc, onClose }) => {
  if (!doc || !doc.analysis_data) return null;

  const data = doc.analysis_data;

  // Check if AI detected stats
  const stats = data.ai_stats || {};
  const hasStats = stats.total_students_detected > 0 || stats.pass_count > 0;

  // Prepare Chart Data
  const chartData = hasStats
    ? [
        { name: "Passed", value: stats.pass_count || 0, color: "#22c55e" },
        { name: "Failed", value: stats.fail_count || 0, color: "#ef4444" },
      ]
    : [];

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
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
                ? "📊 AI Result Analysis"
                : "📑 AI Document Analysis"}
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {/* --- SECTION 1: AI STATS (If Detected) --- */}
          {hasStats && (
            <>
              <div style={gridStyle}>
                <KpiCard
                  title="Total Students"
                  value={stats.total_students_detected || "N/A"}
                  icon={<Users size={20} color="#3b82f6" />}
                  bg="rgba(59, 130, 246, 0.1)"
                />
                <KpiCard
                  title="Pass Rate (Est.)"
                  value={`${stats.pass_percentage || 0}%`}
                  icon={<Percent size={20} color="#22c55e" />}
                  bg="rgba(34, 197, 94, 0.1)"
                />
                <KpiCard
                  title="Hardest Subject"
                  value={stats.hardest_subject || "None"}
                  icon={<AlertTriangle size={20} color="#f59e0b" />}
                  bg="rgba(245, 158, 11, 0.1)"
                  isText
                />
                <KpiCard
                  title="Top Performer"
                  value={stats.top_performer || "Unknown"}
                  icon={<Trophy size={20} color="#8b5cf6" />}
                  bg="rgba(139, 92, 246, 0.1)"
                  isText
                />
              </div>

              <div style={chartsSectionStyle}>
                <div style={cardStyle}>
                  <h4 style={cardTitleStyle}>Performance Estimate</h4>
                  <div style={{ height: "220px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--glass-border)"
                        />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" />
                        <YAxis stroke="var(--text-secondary)" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--glass-border)",
                            color: "var(--text-primary)",
                          }}
                        />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- SECTION 2: AI NARRATIVE (Always Shown) --- */}
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

            <div style={gridStyle}>
              <KpiCard
                title="Overall Tone"
                value={data.tone}
                icon={<Activity size={20} color="#3b82f6" />}
                bg="rgba(59, 130, 246, 0.1)"
                isText
              />
              <KpiCard
                title="Risk Level"
                value={data.risk_level}
                icon={
                  <AlertTriangle
                    size={20}
                    color={data.risk_level === "High" ? "#ef4444" : "#f59e0b"}
                  />
                }
                bg={
                  data.risk_level === "High"
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(245, 158, 11, 0.1)"
                }
                isText
              />
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
                  Action Items
                </h4>
                <ul style={listStyle}>
                  {data.action_items?.length > 0 ? (
                    data.action_items.map((item, i) => <li key={i}>{item}</li>)
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

// Styles
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
  maxWidth: "900px",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
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
const KpiCard = ({ title, value, icon, bg, isText }) => (
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
          fontSize: isText ? "1.1rem" : "1.5rem",
          color: "var(--text-primary)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </h4>
    </div>
  </div>
);

export default AnalysisModal;
