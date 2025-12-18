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
} from "lucide-react";
import "./SetupWizard.css";
import { useAuth } from "../context/AuthContext";

const SetupWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // 0 = Welcome, 1 = Identity, 2 = Admin
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    orgName: "",
    orgType: "School",
    designation: "Principal", // Default
    customDesignation: "", // For "Other"
  });

  const instituteTypes = [
    { id: "School", icon: School, label: "School" },
    { id: "University", icon: GraduationCap, label: "University" },
    { id: "Coaching", icon: BookOpen, label: "Coaching" },
  ];

  // Expanded Role Options
  const roleOptions = [
    { id: "Principal", icon: Crown, label: "Principal" },
    { id: "Director", icon: Briefcase, label: "Director" },
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

      // Use custom designation if "Other" is selected
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

  // 0. Welcome Screen
  if (step === 0) {
    return (
      <div className="setup-container">
        <div className="welcome-card">
          <div className="logo-badge">E</div>
          <h1>Welcome to EduSphere</h1>
          <p>
            You are about to set up a comprehensive digital ecosystem for your
            institute. Let's get your campus online in less than 2 minutes.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <CheckCircle2 size={18} className="text-green" />
              <span>Centralized Student Data</span>
            </div>
            <div className="feature-item">
              <CheckCircle2 size={18} className="text-green" />
              <span>Smart Fee Management</span>
            </div>
            <div className="feature-item">
              <CheckCircle2 size={18} className="text-green" />
              <span>Role-based Access Control</span>
            </div>
          </div>

          <button className="primary-btn big" onClick={handleNext}>
            Get Started <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Wizard Container for Steps 1 & 2
  return (
    <div className="setup-container">
      <div className="wizard-card">
        {/* Progress Stepper */}
        <div className="stepper">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>1</div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
        </div>

        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="step-content fade-in">
            <div className="step-header">
              <Building2 size={32} className="step-icon" />
              <h2>Institute Identity</h2>
              <p>Tell us about the organization you are managing.</p>
            </div>

            <div className="form-group">
              <label>Organization Name</label>
              <input
                type="text"
                placeholder="e.g. St. Xavier's High School"
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
          </div>
        )}

        {/* STEP 2: ADMIN PROFILE (UPDATED) */}
        {step === 2 && (
          <div className="step-content fade-in">
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
                    <role.icon size={22} />
                    <span>{role.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Show Text Input only if "Other" is selected */}
            {formData.designation === "Other" && (
              <div className="form-group slide-down">
                <label>Type Custom Role</label>
                <input
                  type="text"
                  placeholder="e.g. Trustee, Manager"
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

            <div className="info-box">
              <p>
                <strong>Note:</strong> As the creator, you will be assigned the{" "}
                <span>Super Admin</span> permissions regardless of your title.
              </p>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
