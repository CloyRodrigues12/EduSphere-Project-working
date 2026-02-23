/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  Building2,
  UserCircle,
  ArrowRight,
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
  MapPin,
  Loader2,
  Calendar,
} from "lucide-react";

import "./SetupWizard.css";
import { useAuth } from "../context/AuthContext";

const SetupWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    orgName: "",
    orgAddress: "",
    orgType: "College",
    departmentName: "", // NEW: Required for Multi-tenant
    academicYearName: "2025-2026", // NEW: Required for Multi-tenant
    designation: "Principal",
    customDesignation: "",
  });

  const instituteTypes = [
    { id: "School", icon: School, label: "School" },
    { id: "College", icon: Landmark, label: "College" },
    { id: "University", icon: GraduationCap, label: "University" },
    { id: "Coaching", icon: BookOpen, label: "Coaching" },
  ];

  const roleOptions = [
    { id: "Principal", icon: Crown, label: "Principal" },
    { id: "Director", icon: Briefcase, label: "Director" },
    { id: "Vice Principal", icon: UserCheck, label: "VP" },
    { id: "HOD", icon: Users, label: "HOD" },
    { id: "Administrator", icon: UserCog, label: "Admin" },
    { id: "IT Head", icon: Monitor, label: "IT Head" },
    { id: "Other", icon: UserCircle, label: "Other" },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setFormData({ ...formData, orgAddress: value });

    if (value.length > 2) {
      setIsSearching(true);
      try {
        const res = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${value}&addressdetails=1&limit=5`,
        );
        setSuggestions(res.data);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching locations", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectLocation = (item) => {
    const address = item.display_name.split(",").slice(0, 3).join(",");
    setFormData({ ...formData, orgAddress: address });
    setShowSuggestions(false);
  };

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

      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

      // Perfectly matching the new transactional backend
      await axios.post(
        `${API_URL}/api/setup-organization/`,
        {
          organization_name: formData.orgName,
          type: formData.orgType,
          address: formData.orgAddress,
          designation: finalDesignation,
          department_name: formData.departmentName, // Sends Dept
          academic_year_name: formData.academicYearName, // Sends Year
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Setup failed", error);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (step === 0) {
    return (
      <div className="setup-container">
        <div className="welcome-card">
          <div className="step-content-wrapper" key="welcome">
            <div className="logo-badge">E</div>
            <h1>Welcome to EduSphere</h1>
            <p>
              You are about to set up a comprehensive digital ecosystem for your
              institute. <br />
              Let's get your campus online in less than 2 minutes.
            </p>
            <button className="primary-btn big" onClick={handleNext}>
              Get Started <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container">
      <div className="wizard-card">
        {/* Expanded Stepper for 3 steps */}
        <div className="stepper">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>1</div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 3 ? "active" : ""}`}>3</div>
        </div>

        <div className="step-content-wrapper" key={step}>
          {/* STEP 1: INSTITUTE IDENTITY */}
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

              <div
                className="form-group"
                style={{ position: "relative" }}
                ref={dropdownRef}
              >
                <label>Location / City</label>
                <div className="input-with-icon">
                  <MapPin size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="Type to search city..."
                    value={formData.orgAddress}
                    onChange={handleAddressChange}
                    onFocus={() =>
                      formData.orgAddress.length > 2 && setShowSuggestions(true)
                    }
                  />
                  {isSearching && (
                    <Loader2 size={16} className="spinner input-right-icon" />
                  )}
                </div>

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="location-dropdown">
                    {suggestions.map((item) => (
                      <li
                        key={item.place_id}
                        onClick={() => selectLocation(item)}
                      >
                        <strong>
                          {item.name || item.address.city || item.address.town}
                        </strong>
                        <span>{item.display_name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-group">
                <label>Institute Type</label>
                <div className="type-grid">
                  {instituteTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`type-card ${formData.orgType === type.id ? "selected" : ""}`}
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
                  disabled={!formData.orgName || !formData.orgAddress}
                >
                  Next Step
                </button>
              </div>
            </>
          )}

          {/* STEP 2: ACADEMIC SETUP (NEW) */}
          {step === 2 && (
            <>
              <div className="step-header">
                <Calendar size={32} className="step-icon" />
                <h2>Academic Setup</h2>
                <p>Initialize your first department and academic session.</p>
              </div>

              <div className="form-group">
                <label>First Department Name</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Engineering"
                  value={formData.departmentName}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentName: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Current Academic Year</label>
                <input
                  type="text"
                  placeholder="e.g. 2025-2026"
                  value={formData.academicYearName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      academicYearName: e.target.value,
                    })
                  }
                />
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    marginTop: "6px",
                  }}
                >
                  All attendance and student records will be isolated to this
                  year.
                </p>
              </div>

              <div className="wizard-actions">
                <button className="text-btn" onClick={handleBack}>
                  Back
                </button>
                <button
                  className="primary-btn"
                  onClick={handleNext}
                  disabled={
                    !formData.departmentName || !formData.academicYearName
                  }
                >
                  Next Step
                </button>
              </div>
            </>
          )}

          {/* STEP 3: ROLE (Formerly Step 2) */}
          {step === 3 && (
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
                      className={`type-card ${formData.designation === role.id ? "selected" : ""}`}
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
                <div className="form-group" style={{ marginTop: "0.5rem" }}>
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
