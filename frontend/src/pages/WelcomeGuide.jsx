import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Layers,
  FileSearch,
  ShieldCheck,
  LayoutDashboard,
  ArrowRight,
  Zap,
  Database,
} from "lucide-react";
import "./WelcomeGuide.css";

const WelcomeGuide = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- ENTRANCE ANIMATION VARIANTS (No more fighting with CSS hovers) ---
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
  };

  const itemUp = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 120, damping: 15 },
    },
  };

  const slideRight = {
    hidden: { opacity: 0, x: -20 },
    show: {
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 100, damping: 15 },
    },
  };

  return (
    <div className="welcome-wrapper fade-in">
      <motion.div
        className="welcome-container"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* HERO SECTION */}
        <motion.div className="welcome-hero glass-panel" variants={itemUp}>
          <div className="hero-glow-blob top-left"></div>
          <div className="hero-glow-blob bottom-right"></div>

          <div className="hero-icon-wrapper">
            <Sparkles size={28} className="text-primary" />
          </div>

          <h1 className="welcome-title">
            Welcome to EduSphere,{" "}
            <span className="text-gradient">
              {user?.name?.split(" ")[0] || "User"}
            </span>
          </h1>
          <p className="welcome-subtitle">
            The Next-Generation Multi-Tenant Campus Management Ecosystem.
            Everything from intelligent document parsing to real-time academic
            analytics in one unified platform.
          </p>

          <button
            className="btn-primary start-btn pulse-btn"
            onClick={() => navigate("/")}
          >
            <LayoutDashboard size={18} /> Enter Workspace{" "}
            <ArrowRight size={18} />
          </button>
        </motion.div>

        {/* CORE MODULES */}
        <motion.div variants={itemUp} className="section-header">
          <h2>
            <Zap size={20} className="inline-icon text-warning" /> System
            Capabilities
          </h2>
          <p>The core engines powering your digital campus.</p>
        </motion.div>

        <motion.div className="features-grid" variants={containerVariants}>
          <motion.div className="feature-card glass-panel" variants={itemUp}>
            <div
              className="feature-icon"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              <Layers size={22} />
            </div>
            <h3>Smart Attendance & Radar</h3>
            <p>
              Frictionless roll calls with an intelligent radar that instantly
              categorizes students into Safe, At-Risk, and Defaulter zones.
            </p>
          </motion.div>

          <motion.div className="feature-card glass-panel" variants={itemUp}>
            <div
              className="feature-icon"
              style={{
                background: "rgba(139, 92, 246, 0.1)",
                color: "#8b5cf6",
                border: "1px solid rgba(139, 92, 246, 0.2)",
              }}
            >
              <FileSearch size={22} />
            </div>
            <h3>Data Upload</h3>
            <p>
              Upload raw Excel sheets of student lists. Our System automatically
              extracts, cleans, and structures the data into the database.
            </p>
          </motion.div>

          <motion.div className="feature-card glass-panel" variants={itemUp}>
            <div
              className="feature-icon"
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                color: "#f59e0b",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <h3>Enterprise Sandboxing</h3>
            <p>
              Total data privacy. Faculty and HODs are locked securely into
              their departments, while Super Admins command the global view.
            </p>
          </motion.div>
        </motion.div>

        {/* SETUP ARCHITECTURE */}
        <motion.div variants={itemUp} className="section-header mt-10">
          <h2>
            <Database size={20} className="inline-icon text-primary" />{" "}
            Architecture Flow
          </h2>
          <p>
            EduSphere is built on a strict hierarchical structure to maintain
            absolute data integrity.
          </p>
        </motion.div>

        <motion.div
          className="architecture-timeline"
          variants={containerVariants}
        >
          {[
            {
              num: 1,
              title: "The Foundation (Admins)",
              desc: "The Organization, active Academic Year, and Departments are established. This acts as the anchor for all future data.",
            },
            {
              num: 2,
              title: "The People (Admins & HODs)",
              desc: "Students are ingested via DocuSense, and Staff/Faculty are invited into the system and assigned to their respective departments.",
            },
            {
              num: 3,
              title: "The Framework (HODs)",
              desc: "Subjects are added to the Catalog, and Students are grouped into physical Batches (e.g., 'TE ECS - Batch A').",
            },
            {
              num: 4,
              title: "The Execution (Faculty)",
              desc: "Classes are officially allocated to teachers via the Allocation Matrix. Only then will classes appear on a teacher's dashboard.",
            },
          ].map((step, idx) => (
            <React.Fragment key={step.num}>
              <motion.div className="timeline-step" variants={slideRight}>
                <div className="step-number-wrapper">
                  <div className="step-number pulse-glow">{step.num}</div>
                </div>
                <div className="step-content glass-panel">
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              </motion.div>
              {idx < 3 && (
                <motion.div
                  className="timeline-connector"
                  initial={{ height: 0 }}
                  animate={{ height: 30 }}
                  transition={{ delay: 0.3 + idx * 0.15, duration: 0.4 }}
                />
              )}
            </React.Fragment>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default WelcomeGuide;
