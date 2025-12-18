/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  UserCircle,
  ArrowRight,
  CheckCircle2,
  School,
  GraduationCap,
  BookOpen,
  Briefcase,
  Monitor,
  UserCog,
  Crown,
  UserCheck,
  Users,
  Landmark,
} from "lucide-react";
import "./SetupWizard.css";
import { useAuth } from "../context/AuthContext";

const SetupWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    orgName: "",
    orgType: "College", // Default set to College
    designation: "Principal",
    customDesignation: "",
  });

  const instituteTypes = [
    { id: "School", icon: School, label: "School" },
    { id: "College", icon: Landmark, label: "College" }, // Added College Option
    { id: "University", icon: GraduationCap, label: "University" },
    { id: "Coaching", icon: BookOpen, label: "Coaching" },
  ];

  const roleOptions = [
    { id: "Principal", icon: Crown, label: "Principal" },
    { id: "Director", icon: Briefcase, label: "Director" },
    { id: "Vice Principal", icon: UserCheck, label: "Vice Principal" },
    { id: "HOD", icon: Users, label: "HOD" },
    { id: "Administrator", icon: UserCog, label: "Admin" },
    { id: "IT Head", icon: Monitor, label: "IT Head" },
    { id: "Other", icon: UserCircle, label: "Other" },
  ];

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const finalDesignation =
        formData.designation === "Other"
          ? formData.customDesignation
          : formData.designation;

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/setup-organization/`,
        {
          name: formData.orgName,
          type: formData.orgType,
          designation: finalDesignation,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = "/";
    } catch (error) {
      console.error("Setup failed", error);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // --- WELCOME SCREEN ---
  if (step === 0) {
    return (
      <div className="setup-container">
        <div className="welcome-card">
          <div className="step-content-wrapper" key="welcome">
            <div className="logo-badge">E</div>
            <h1>Welcome to EduSphere</h1>
            <p>
              You are about to set up a comprehensive digital ecosystem for your
              institute.
              <br /> Let's get your campus online in less than 2 minutes.
            </p>

            <div className="feature-list">
              <div className="feature-item">
                <CheckCircle2 size={18} className="text-green" />
                <span>Centralized Data</span>
              </div>
              <div className="feature-item">
                <CheckCircle2 size={18} className="text-green" />
                <span>Smart Fee Management</span>
              </div>
              <div className="feature-item">
                <CheckCircle2 size={18} className="text-green" />
                <span>Role-based Access</span>
              </div>
            </div>

            <button className="primary-btn big" onClick={handleNext}>
              Get Started <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- WIZARD STEPS ---
  return (
    <div className="setup-container">
      <div className="wizard-card">
        {/* Progress Stepper */}
        <div className="stepper">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>1</div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
        </div>

        {/* Content Wrapper with Key for Animation */}
        <div className="step-content-wrapper" key={step}>
          {step === 1 && (
            <>
              <div className="step-header">
                <Building2 size={32} className="step-icon" />
                <h2>Institute Identity</h2>
                <p>Tell us about your organization.</p>
              </div>
              <div className="form-group">
                <label>Organization Name</label>
                <input
                  type="text"
                  placeholder="e.g. St. Xavier's College"
                  value={formData.orgName}
                  onChange={(e) =>
                    setFormData({ ...formData, orgName: e.target.value })
                  }
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Institute Type</label>
                <div className="type-grid">
                  {instituteTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`type-card ${
                        formData.orgType === type.id ? "selected" : ""
                      }`}
                      onClick={() =>
                        setFormData({ ...formData, orgType: type.id })
                      }
                    >
                      <type.icon size={24} />
                      <span>{type.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wizard-actions">
                <button className="text-btn" onClick={handleBack}>
                  Back
                </button>
                <button
                  className="primary-btn"
                  onClick={handleNext}
                  disabled={!formData.orgName}
                >
                  Next Step
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="step-header">
                <UserCircle size={32} className="step-icon" />
                <h2>Your Role</h2>
                <p>How should the system address you?</p>
              </div>
              <div className="form-group">
                <label>Select Designation</label>
                <div className="type-grid role-grid">
                  {roleOptions.map((role) => (
                    <div
                      key={role.id}
                      className={`type-card ${
                        formData.designation === role.id ? "selected" : ""
                      }`}
                      onClick={() =>
                        setFormData({ ...formData, designation: role.id })
                      }
                    >
                      <role.icon size={20} />
                      <span style={{ fontSize: "0.85rem" }}>{role.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {formData.designation === "Other" && (
                <div
                  className="form-group"
                  style={{ marginTop: "1rem", animation: "slideIn 0.3s ease" }}
                >
                  <label>Type Custom Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Trustee"
                    value={formData.customDesignation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customDesignation: e.target.value,
                      })
                    }
                    autoFocus
                  />
                </div>
              )}
              <div className="wizard-actions">
                <button className="text-btn" onClick={handleBack}>
                  Back
                </button>
                <button
                  className="primary-btn"
                  onClick={handleSubmit}
                  disabled={
                    (formData.designation === "Other" &&
                      !formData.customDesignation) ||
                    loading
                  }
                >
                  {loading ? "Setting up..." : "Finish Setup"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
