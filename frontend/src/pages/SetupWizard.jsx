/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SetupWizard.css";

const SetupWizard = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    type: "College",
    address: "",
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");

      // Call the API we will create in Step 4
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/setup-organization/`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Success! Refresh page so AuthContext sees the new status and redirects to Dashboard
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      console.error("Setup failed", error);
      setLoading(false);
      alert("Setup failed. Please check the console.");
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        {/* Progress Dots */}
        <div className="progress-container">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>1</div>
          <div className={`step-line ${step >= 2 ? "active" : ""}`}></div>
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Name */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-content"
            >
              <div className="wizard-header">
                <h2>Name your Campus</h2>
                <p>What is the official name of your institution?</p>
              </div>

              <div className="input-wrapper">
                <Building2 className="input-icon" size={20} />
                <input
                  type="text"
                  placeholder="e.g. St. Xavier's College"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <button
                className="next-btn"
                disabled={!formData.name}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* STEP 2: Address & Type */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="wizard-content"
            >
              <div className="wizard-header">
                <h2>Final Details</h2>
                <p>Where is {formData.name} located?</p>
              </div>

              <div className="form-grid">
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={20} />
                  <input
                    type="text"
                    placeholder="City, State"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div className="type-selector">
                  {["School", "College", "University"].map((type) => (
                    <div
                      key={type}
                      className={`type-option ${
                        formData.type === type ? "selected" : ""
                      }`}
                      onClick={() => setFormData({ ...formData, type: type })}
                    >
                      <GraduationCap size={16} />
                      {type}
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="launch-btn"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Launching..." : "Launch Campus"}
                {!loading && <CheckCircle2 size={18} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SetupWizard;
