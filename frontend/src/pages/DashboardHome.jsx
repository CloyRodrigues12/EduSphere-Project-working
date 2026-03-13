/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAcademic } from "../context/AcademicContext";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { 
  Users, BookOpen, UserCheck, Activity, Building, 
  X, PieChart as PieIcon, BarChart2, Filter, Search
} from "lucide-react";
import { 
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, 
  ComposedChart, RadialBarChart, RadialBar, Legend
} from "recharts";
import "./DashboardHome.css";

// --- PROFESSIONAL ENTERPRISE COLOR PALETTE ---
const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981'];

// --- CUSTOM RECHARTS TOOLTIP ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip glass-panel">
        <p className="label">{label || payload[0].payload.name || payload[0].name}</p>
        {payload.map((entry, index) => (
          <p key={index} className="value">
            {entry.name}: <span style={{ color: entry.payload.fill || COLORS[index] }}>{entry.value}</span>
          </p>
        ))}
        <div className="tooltip-hint">Click to view data list</div>
      </div>
    );
  }
  return null;
};

// --- RENDER CUSTOM PIE LABELS ---
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
  if (percent < 0.05) return null; 
  return (
    <text x={x} y={y} fill="var(--text-primary)" fontSize={11} fontWeight={600} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// --- SLEEK KPI CARD ---
const StatCard = ({ title, dataObj, icon: Icon, color, delay, onClick }) => (
  <motion.div
    className="sleek-stat-card glass-panel cursor-pointer"
    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}
    whileHover={{ y: -4, boxShadow: "0 15px 30px -10px rgba(0,0,0,0.15)" }}
    onClick={() => onClick(title, dataObj.value, dataObj.details)}
  >
    <div className="stat-icon-wrap" style={{ background: `${color}15`, color: color }}>
      <Icon size={24} strokeWidth={2.5} />
    </div>
    <div className="stat-info">
      <p className="stat-title">{title}</p>
      <h3 className="stat-value">{dataObj?.value || 0} {title.includes('Attendance') ? '%' : ''}</h3>
    </div>
  </motion.div>
);

// --- BENTO CHART WRAPPER ---
const BentoChart = ({ title, spanClass, data, children, delay, icon: Icon }) => {
  const hasData = data && data.length > 0;
  return (
    <motion.div className={`bento-card glass-panel ${spanClass} ${!hasData ? 'empty-widget' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}>
      <div className="card-header">
        <h3>{title}</h3>
        {Icon && <Icon size={18} className="text-muted" />}
      </div>
      <div className="chart-wrapper">
        {hasData ? children : (
          <div className="no-data-overlay">
            <Filter size={32} opacity={0.2} />
            <p>No data to visualize</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const DashboardHome = () => {
  const { user } = useAuth();
  const { activeAcademicYear, activeDepartment } = useAcademic();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [studyYearFilter, setStudyYearFilter] = useState("ALL");
  const [defaulterView, setDefaulterView] = useState("class");
  
  // Drill Down State & Search
  const [drillDown, setDrillDown] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (activeAcademicYear) fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAcademicYear, activeDepartment, studyYearFilter]);

  // Reset search query when modal opens
  useEffect(() => { if (drillDown) setSearchQuery(""); }, [drillDown]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/advanced/?year=${studyYearFilter}`, {
        headers: {
          'X-Academic-Year-Id': activeAcademicYear?.id || '',
          'X-Department-Id': activeDepartment?.id || 'ALL'
        }
      });
      setData(res.data);
    } catch (error) {
      console.error("Dashboard error", error);
    } finally {
      setLoading(false);
    }
  };

  const openDrillDown = (title, value, details) => {
    if (!details || details.length === 0) return;
    setDrillDown({ title, value, details });
  };

  const handleChartClick = (chartName, payload) => {
    if (!payload || !payload.details) return;
    openDrillDown(`${payload.name || payload.class} - ${chartName}`, payload.value || payload.defaulters || payload.attendance || payload.Load, payload.details);
  };

  if (loading) return <div className="spinner-container"><div className="spinner"></div></div>;
  if (!data) return null;
  const { kpis, charts, user_name } = data;

  // Filter Drill Down Data based on Search
  const filteredDrillDown = drillDown?.details.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(item.value).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add colors to Top Classes for Radial Chart
  const topClassesData = charts.top_classes?.map((item, index) => ({
    ...item, fill: COLORS[index % COLORS.length]
  })) || [];

  return (
    <div className="dashboard-home fade-in">
      
      {/* HEADER & FILTERS */}
      <div className="dashboard-header glass-panel">
        <div className="welcome-section">
          <h1>Welcome back, <span>{user_name}</span> 👋</h1>
          <p>Here's a breakdown of your institution's real-time performance.</p>
        </div>
        <div className="global-filters">
          <select className="premium-select" value={studyYearFilter} onChange={(e) => setStudyYearFilter(e.target.value)}>
            <option value="ALL">All Study Years</option>
            <option value="FE">First Year (FE)</option>
            <option value="SE">Second Year (SE)</option>
            <option value="TE">Third Year (TE)</option>
            <option value="BE">Final Year (BE)</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        {user?.role_code !== 'FACULTY' && <StatCard title="Departments" dataObj={kpis.total_departments} icon={Building} color={COLORS[4]} delay={0.1} onClick={openDrillDown} />}
        <StatCard title="Active Students" dataObj={kpis.total_students} icon={Users} color={COLORS[0]} delay={0.2} onClick={openDrillDown} />
        <StatCard title="Avg Attendance" dataObj={kpis.overall_attendance} icon={Activity} color={COLORS[1]} delay={0.3} onClick={openDrillDown} />
        <StatCard title="Active Courses" dataObj={kpis.active_courses} icon={BookOpen} color={COLORS[2]} delay={0.4} onClick={openDrillDown} />
        {user?.role_code !== 'STUDENT' && <StatCard title="Faculty Staff" dataObj={kpis.total_faculty} icon={UserCheck} color={COLORS[3]} delay={0.5} onClick={openDrillDown} />}
      </div>

      {/* ADVANCED BENTO GRID */}
      <div className="bento-grid">
        
        {/* ATTENDANCE TREND (ComposedChart ensures 100% clickability via invisible bars) */}
        <BentoChart title="Attendance Trend (Last 7 Days)" spanClass="col-span-8" data={charts.attendance_trend} delay={0.6}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={charts.attendance_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(e) => { if (e?.activePayload) handleChartClick('Trend Date', e.activePayload[0].payload); }} style={{ cursor: 'pointer' }}>
              <defs><linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.4}/><stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
              {/* Force text-secondary for dark mode */}
              <XAxis dataKey="date" tick={{ fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} fontSize={12} />
              <YAxis tick={{ fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} fontSize={12} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-input)', opacity: 0.4 }} />
              <Area type="monotone" dataKey="attendance" stroke={COLORS[0]} strokeWidth={3} fill="url(#colorAtt)" activeDot={{ r: 6, fill: COLORS[0], strokeWidth: 0 }} />
              {/* Invisible bar to catch clicks over the entire column */}
              <Bar dataKey="attendance" fill="transparent" />
            </ComposedChart>
          </ResponsiveContainer>
        </BentoChart>

        <BentoChart title="Defaulters Alert (<75%)" spanClass="col-span-4" data={charts.defaulters_matrix} delay={0.65}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.defaulters_matrix} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
              <XAxis dataKey="class" tick={{ fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} fontSize={12} />
              <YAxis tick={{ fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} fontSize={12} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-input)' }} />
              <Bar dataKey="defaulters" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(data) => handleChartClick('Defaulters', data.payload)}>
                {charts.defaulters_matrix?.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.defaulters > 10 ? COLORS[3] : '#f87171'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BentoChart>

        {/* DEMOGRAPHICS (PIE) */}
        <BentoChart title="Student Demographics" spanClass="col-span-4" data={charts.demographics} icon={PieIcon} delay={0.7}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={charts.demographics} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} cursor="pointer" onClick={(data) => handleChartClick('Students', data.payload)}>
                {charts.demographics?.map((e, i) => <Cell key={i} fill={e.color || COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </BentoChart>

        <BentoChart title="Faculty Roles" spanClass="col-span-4" data={charts.faculty_demographics} icon={PieIcon} delay={0.75}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={charts.faculty_demographics} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} cursor="pointer" onClick={(data) => handleChartClick('Faculty', data.payload)}>
                {charts.faculty_demographics?.map((e, i) => <Cell key={i} fill={COLORS[(i+2) % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </BentoChart>

        <BentoChart title="Subject Distribution" spanClass="col-span-4" data={charts.subject_distribution} icon={PieIcon} delay={0.8}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={charts.subject_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} cursor="pointer" onClick={(data) => handleChartClick('Subjects', data.payload)}>
                {charts.subject_distribution?.map((e, i) => <Cell key={i} fill={COLORS[(i+4) % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </BentoChart>

        {/* TOP PERFORMING CLASSES (Beautiful RadialBar) */}
        <BentoChart title="Top Performing Classes" spanClass="col-span-6" data={topClassesData} icon={Activity} delay={0.85}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="40%" cy="50%" innerRadius="20%" outerRadius="100%" barSize={16} data={topClassesData}>
              <RadialBar minAngle={15} background={{ fill: 'var(--bg-input)' }} clockWise dataKey="attendance" cornerRadius={10} cursor="pointer" onClick={(data) => handleChartClick('Top Class', data.payload)} />
              <Legend iconSize={12} layout="vertical" verticalAlign="middle" wrapperStyle={{ right: 0, color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }} />
              <Tooltip content={<CustomTooltip />} />
            </RadialBarChart>
          </ResponsiveContainer>
        </BentoChart>

        {/* FACULTY WORKLOAD (Stylized Bar with Background Track) */}
        <BentoChart title="Faculty Workload (Allocations)" spanClass="col-span-6" data={charts.workload} icon={BarChart2} delay={0.9}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={charts.workload} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: "var(--text-primary)", fontWeight: 600, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="Load" barSize={14} radius={[10, 10, 10, 10]} background={{ fill: 'var(--bg-input)', radius: 10 }} cursor="pointer" onClick={(data) => handleChartClick('Workload', data.payload)}>
                {charts.workload?.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BentoChart>

      </div>

      {/* DRILL DOWN MODAL WITH SEARCH */}
      <AnimatePresence>
        {drillDown && (
          <div className="modal-overlay" onClick={() => setDrillDown(null)}>
            <motion.div className="drill-down-modal glass-panel" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <button className="close-btn" onClick={() => setDrillDown(null)}><X size={20} /></button>
              
              <div className="drill-header">
                <h2>{drillDown.title}</h2>
                <span className="badge">Detailed List View</span>
              </div>
              
              <div className="drill-stat-box">
                <h3>{filteredDrillDown.length}</h3>
                <p>Results Found</p>
              </div>

              {/* SEARCH BAR */}
              <div className="drill-search-bar">
                <Search size={18} className="text-muted" />
                <input 
                  type="text" 
                  placeholder="Search list..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>

              <div className="drill-list-container">
                <ul className="drill-list">
                  {filteredDrillDown.length > 0 ? (
                    filteredDrillDown.map((item, idx) => (
                      <li key={idx}>
                        <span className="item-name">{item.name}</span>
                        <span className="item-value">{item.value}</span>
                      </li>
                    ))
                  ) : (
                    <li className="no-results">No matches found for "{searchQuery}"</li>
                  )}
                </ul>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default DashboardHome;