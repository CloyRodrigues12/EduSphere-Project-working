import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/global.css";

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

    // 1. Basic Match Check
    if (password !== confirmPassword) {
      setMsg({ text: "Passwords do not match!", type: "error" });
      return;
    }

    setLoading(true);

    // 2. Call AuthContext
    const result = await resetPasswordConfirm(uid, token, password);

    setLoading(false);

    if (result.success) {
      setMsg({
        text: "Password reset successful! Redirecting...",
        type: "success",
      });
      setTimeout(() => navigate("/login"), 3000);
    } else {
      // 3. Display the Specific Backend Error
      setMsg({ text: result.error, type: "error" });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "var(--bg-main)",
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: "3rem",
          width: "100%",
          maxWidth: "400px",
          borderRadius: "20px",
        }}
      >
        <h2
          style={{
            marginBottom: "1.5rem",
            color: "var(--text-primary)",
            textAlign: "center",
          }}
        >
          Set New Password
        </h2>

        {msg.text && (
          <div
            className={`status-msg ${msg.type}`}
            style={{ marginBottom: "1rem" }}
          >
            {msg.text}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div className="input-group">
            <label>New Password</label>
            <input
              type="password"
              placeholder="Min 8 chars"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="glass-input"
            />
          </div>
          <div className="input-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="glass-input"
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
