import React, { useState } from "react";
import { X, Trophy, Users, TrendingUp, Filter } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AnalysisModal = ({ doc, onClose }) => {
  const [filterSubject, setFilterSubject] = useState(null);

  if (!doc?.analysis_data) return null;
  const { batch_stats, overall_rank_list, subject_analytics, full_data } =
    doc.analysis_data;

  // Transform Data for Charts
  const subjectChartData = (subject_analytics || []).map((s) => ({
    name: s.subject_id.replace("Col_", "Sub "),
    pass: s.pass,
    fail: s.fail,
    full_id: s.subject_id,
  }));

  const displayList = filterSubject
    ? full_data.filter((s) =>
        s.subjects.some((sub) => sub.col === filterSubject),
      )
    : overall_rank_list;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: "1.4rem", color: "var(--text-primary)" }}>
              Analysis Report
            </h2>
            <span style={{ color: "var(--primary)", fontFamily: "monospace" }}>
              {doc.filename}
            </span>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <Users size={32} color="#6366f1" />
              <div>
                <h3>Total Students</h3>
                <p>{batch_stats?.total_students || 0}</p>
              </div>
            </div>
            <div className="kpi-card">
              <TrendingUp size={32} color="#10b981" />
              <div>
                <h3>Batch Average</h3>
                <p>{batch_stats?.average_sgpa || 0}</p>
              </div>
            </div>
            <div className="kpi-card">
              <Trophy size={32} color="#f59e0b" />
              <div>
                <h3>Top Score</h3>
                <p>{overall_rank_list?.[0]?.sgpa || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* CHART */}
          <div className="chart-container">
            <h3 style={{ marginBottom: "1rem", color: "var(--text-primary)" }}>
              Subject Performance (Pass/Fail)
            </h3>
            <div style={{ height: 300, width: "100%" }}>
              <ResponsiveContainer>
                <BarChart
                  data={subjectChartData}
                  onClick={(data) => {
                    if (data?.activePayload)
                      setFilterSubject(data.activePayload[0].payload.full_id);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Bar
                    dataKey="pass"
                    stackId="a"
                    fill="#10b981"
                    name="Passed"
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar
                    dataKey="fail"
                    stackId="a"
                    fill="#ef4444"
                    name="Failed"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p
              style={{
                textAlign: "center",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                marginTop: "10px",
              }}
            >
              * Click on any bar to filter the student list below
            </p>
          </div>

          {/* LIST */}
          <div className="list-container">
            <div className="list-header-row">
              <h3 style={{ margin: 0, color: "var(--text-primary)" }}>
                {filterSubject
                  ? `Students in ${filterSubject}`
                  : "🏆 Top Performers"}
              </h3>
              {filterSubject && (
                <button
                  onClick={() => setFilterSubject(null)}
                  className="upload-btn"
                  style={{
                    width: "auto",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    marginTop: 0,
                  }}
                >
                  <Filter size={14} /> Clear Filter
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th width="80">Rank</th>
                    <th>Seat Number</th>
                    <th>{filterSubject ? "Grade / Marks" : "Overall SGPA"}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.slice(0, 100).map((s, i) => (
                    <tr key={i}>
                      <td>#{s.rank || i + 1}</td>
                      <td>
                        <div style={{ fontWeight: "bold" }}>{s.seat_no}</div>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                          {s.name || "Unknown"}
                        </div>{" "}
                        {/* Added Name */}
                      </td>
                      <td>
                        {filterSubject ? (
                          <span style={{ fontWeight: "bold" }}>
                            {s.subjects.find((sub) =>
                              sub.name.includes(filterSubject),
                            )?.val || "-"}
                          </span>
                        ) : (
                          <span
                            style={{ color: "#f59e0b", fontWeight: "bold" }}
                          >
                            {s.sgpa}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
