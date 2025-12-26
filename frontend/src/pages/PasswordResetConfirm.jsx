import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./PasswordResetConfirm.css";

const PasswordResetConfirm = () => {
  const { uid, token } = useParams();
  const { resetPasswordConfirm } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({});

    // 1. Frontend Validation (Fast Feedback)
    if (password.length < 8) {
      setMsg({
        text: "Password must be at least 8 characters long.",
        type: "error",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMsg({ text: "Passwords do not match.", type: "error" });
      return;
    }

    setLoading(true);

    // 2. Call Backend
    const result = await resetPasswordConfirm(uid, token, password);

    setLoading(false);

    if (result.success) {
      setMsg({
        text: "Success! Redirecting to login...",
        type: "success",
      });
      // Clear inputs to prevent double submission
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate("/login"), 3000);
    } else {
      // 3. Show Backend Error (Now accurate thanks to AuthContext fix)
      setMsg({ text: result.error, type: "error" });
    }
  };

  return (
    <div className="reset-container">
      <div className="reset-card">
        <div className="logo-icon-large" style={{ marginBottom: "1rem" }}>
          🔒
        </div>
        <h2>Set New Password</h2>
        <p>
          Your new password must be different from previously used passwords.
        </p>

        {msg.text && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>New Password</label>
            <input
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Retype password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetConfirm;
