/* eslint-disable no-unused-vars */
import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, FileText, CreditCard } from "lucide-react";
import "./DashboardHome.css";

const StatCard = ({ title, value, subtext, icon: Icon, color, delay }) => (
  <motion.div
    className="stat-card glass-panel"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: delay }}
    whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
  >
    <div className="stat-icon" style={{ backgroundColor: color }}>
      <Icon size={24} color="#fff" />
    </div>
    <div className="stat-content">
      <h3>{value}</h3>
      <p>{title}</p>
      <span className="subtext">{subtext}</span>
    </div>
  </motion.div>
);

const DashboardHome = () => {
  return (
    <div className="dashboard-home">
      {/* Animated Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Students"
          value="12,450"
          subtext="+5% from last month"
          icon={Users}
          color="#4338ca"
          delay={0.1}
        />
        <StatCard
          title="Fees Collected"
          value="₹ 4.2 Cr"
          subtext="+12% vs last year"
          icon={CreditCard}
          color="#059669"
          delay={0.2}
        />
        <StatCard
          title="Research Papers"
          value="142"
          subtext="32 pending review"
          icon={FileText}
          color="#db2777"
          delay={0.3}
        />
        <StatCard
          title="Avg Attendance"
          value="88%"
          subtext="-2% this week"
          icon={TrendingUp}
          color="#d97706"
          delay={0.4}
        />
      </div>

      {/* Main Content Grid */}
      <div className="content-grid">
        <motion.div
          className="chart-section glass-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="card-header">
            <h3>Fee Collection Trends</h3>
            <button className="filter-btn">This Year</button>
          </div>
          <div className="placeholder-chart">
            <p>Chart Component Will Load Here</p>
          </div>
        </motion.div>

        <motion.div
          className="recent-activity glass-panel"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h3>Recent Uploads</h3>
          <ul className="activity-list">
            {[1, 2, 3, 4].map((item) => (
              <li key={item} className="activity-item">
                <div className="dot"></div>
                <div>
                  <p className="activity-text">New student list uploaded</p>
                  <span className="activity-time">2 hours ago</span>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardHome;
