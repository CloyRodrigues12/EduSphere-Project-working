// frontend/src/pages/PasswordResetConfirm.jsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const PasswordResetConfirm = () => {
  const { uid, token } = useParams();
  const { resetPasswordConfirm } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await resetPasswordConfirm(uid, token, password);
    setLoading(false);

    if (res.success) {
      alert("Password Reset Successful! Please Login.");
      navigate("/login");
    } else {
      setMsg(res.error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon-large">E</div>
          <h2>Set New Password</h2>
          <p>Please enter your new password below.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {msg && <div className="status-msg error">{msg}</div>}
          <div className="input-group">
            <label>New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Updating..." : "Confirm Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetConfirm;
