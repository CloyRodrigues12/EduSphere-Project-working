/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const Login = () => {
  const { googleLogin, login, register, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // login | register | forgot

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [msg, setMsg] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  // Clear errors when switching modes
  const switchMode = (newMode) => {
    setMode(newMode);
    setMsg({});
    setLoading(false);
  };

  const handleGoogle = useGoogleLogin({
    onSuccess: async (res) => {
      const result = await googleLogin(res);
      if (!result.success) setMsg({ text: result.error, type: "error" });
    },
    onError: () => setMsg({ text: "Google Login Failed", type: "error" }),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({});
    setLoading(true);

    let res;

    if (mode === "login") {
      res = await login(email, password);
    } else if (mode === "register") {
      // 1. Trim and split by spaces
      const nameParts = fullName.trim().split(/\s+/);

      // 2. Strict Check: Must be exactly 2 parts
      if (nameParts.length !== 2) {
        setMsg({
          text: "Please enter exactly two words (First Name and Last Name).",
          type: "error",
        });
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setMsg({ text: "Passwords do not match!", type: "error" });
        setLoading(false);
        return;
      }

      res = await register(fullName, email, password);
    } else if (mode === "forgot") {
      res = await resetPassword(email);
      if (res.success) {
        setMsg({ text: "Reset link sent to your email!", type: "success" });
        setLoading(false);
        return;
      }
    }
    setLoading(false);

    if (res && !res.success) {
      setMsg({ text: res.error, type: "error" });
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon-large">E</div>
          <h2>
            {mode === "login" && "Welcome Back"}
            {mode === "register" && "Join EduSphere"}
            {mode === "forgot" && "Reset Password"}
          </h2>
          <p>
            {mode === "login" && "Enter credentials to access workspace."}
            {mode === "register" && "Start your digital campus journey."}
            {mode === "forgot" && "Enter email to receive reset link."}
          </p>
        </div>

        {/* --- TABS --- */}
        {mode !== "forgot" && (
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* --- FORM --- */}
        <form className="login-form" onSubmit={handleSubmit}>
          {msg.text && (
            <div className={`status-msg ${msg.type}`}>{msg.text}</div>
          )}

          {/* Full Name (Only for Register) */}
          {mode === "register" && (
            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="user@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          {/* Confirm Password (Only for Register) */}
          {mode === "register" && (
            <div className="input-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {/* Links */}
          {mode === "login" && (
            <div className="forgot-link" onClick={() => switchMode("forgot")}>
              Forgot Password?
            </div>
          )}
          {mode === "forgot" && (
            <div className="forgot-link" onClick={() => switchMode("login")}>
              Back to Sign In
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading
              ? "Processing..."
              : mode === "login"
              ? "Sign In"
              : mode === "register"
              ? "Create Account"
              : "Send Link"}
          </button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="divider">
              <span>or continue with</span>
            </div>
            <button className="google-btn" onClick={() => handleGoogle()}>
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="google-icon"
              />
              <span>Google</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
