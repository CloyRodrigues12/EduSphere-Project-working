import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useGoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import "./Login.css";

const Login = () => {
  const {
    user,
    login,
    googleLogin,
    requestSignUpOTP,
    verifySignUpOTP,
    requestJoinTeamOTP,
    completeJoinTeam,
    setFirstTimePassword,
    resetPassword,
    requiresGoogleSetup,
  } = useAuth();

  const [view, setView] = useState("login"); 
  const [pendingAction, setPendingAction] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Detect if a Student needs to change their default password ---
  const needsStudentSetup = user && user.role_code === 'STUDENT' && !user.is_setup_complete;
  
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");
      setIsLoading(true);
      const res = await googleLogin(tokenResponse);
      if (!res.success) setError(res.error);
      setIsLoading(false);
    },
    onError: () => setError("Google login failed."),
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setSuccessMsg("");
  };

  const otpRefs = useRef([]);
  const handleOtpChange = (index, val) => {
    if (isNaN(val)) return;
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);
    if (val !== "" && index < 5) otpRefs.current[index + 1].focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && index > 0 && otp[index] === "") otpRefs.current[index - 1].focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (view === "signup" && formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }
    
    setIsLoading(true);

    if (view === "login") {
      const res = await login(formData.email, formData.password);
      if (!res.success) setError(res.error);
    } else if (view === "forgot") {
      const res = await resetPassword(formData.email);
      if (res.success) setSuccessMsg("Reset link sent to your email!");
      else setError(res.error);
    } else if (view === "signup") {
      const res = await requestSignUpOTP(formData.email);
      if (res.success) { setPendingAction("signup"); setView("otp-verify"); }
      else setError(res.error);
    } else if (view === "join") {
      const res = await requestJoinTeamOTP(formData.email);
      if (res.success) { setPendingAction("join"); setView("otp-verify"); }
      else setError(res.error);
    }
    
    setIsLoading(false);
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (pendingAction === "join" && formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }
    setIsLoading(true);
    const otpString = otp.join("");
    
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits.");
      setIsLoading(false);
      return;
    }

    if (pendingAction === "signup") {
      const res = await verifySignUpOTP(formData.name, formData.email, formData.password, otpString);
      if (!res.success) setError(res.error);
    } else if (pendingAction === "join") {
      const res = await completeJoinTeam(formData.email, otpString, formData.password);
      if (!res.success) setError(res.error);
    }
    setIsLoading(false);
  };

  // --- REUSED FOR GOOGLE LOGIN AND FIRST TIME STUDENT SETUP ---
  const handleSetGooglePassword = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return setError("Passwords do not match.");
    }
    setIsLoading(true);
    const res = await setFirstTimePassword(formData.password);
    if (!res.success) setError(res.error);
    setIsLoading(false);
  };

  const renderHeader = (title, sub) => (
    <div className="login-header">
      <div className="logo-icon-large">E</div>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        {requiresGoogleSetup || needsStudentSetup ? (
          <form className="login-form" onSubmit={handleSetGooglePassword}>
            {renderHeader(
              needsStudentSetup ? "Welcome Student!" : "Secure Account", 
              needsStudentSetup 
                ? "Please change your default password to continue." 
                : "Create a secure password for your account."
            )}
            <div className="input-group">
              <label>New Password</label>
              <div className="input-wrapper">
                <input type={showPass ? "text" : "password"} name="password" onChange={handleChange} required />
                <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <div className="input-wrapper">
                <input type={showConfirmPass ? "text" : "password"} name="confirmPassword" onChange={handleChange} required />
                <button type="button" className="eye-btn" onClick={() => setShowConfirmPass(!showConfirmPass)}>
                  {showConfirmPass ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>
            {error && <div className="status-msg error">{error}</div>}
            <button type="submit" className="submit-btn" disabled={isLoading}>{isLoading ? "Saving..." : "Save Password & Enter"}</button>
          </form>
        ) : view === "otp-verify" ? (
          <form className="login-form" onSubmit={handleOtpSubmit}>
            {renderHeader("Verify Email", `Code sent to ${formData.email}`)}
            <div className="otp-container">
              {otp.map((d, i) => <input key={i} ref={el => otpRefs.current[i] = el} className="otp-box" maxLength="1" value={d} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} />)}
            </div>
            {pendingAction === "join" && (
               <>
                 <div className="input-group">
                   <label>Set Password</label>
                   <div className="input-wrapper">
                     <input type={showPass ? "text" : "password"} name="password" onChange={handleChange} required />
                     <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                   </div>
                 </div>
                 <div className="input-group">
                   <label>Confirm Password</label>
                   <div className="input-wrapper">
                     <input type={showConfirmPass ? "text" : "password"} name="confirmPassword" onChange={handleChange} required />
                     <button type="button" className="eye-btn" onClick={() => setShowConfirmPass(!showConfirmPass)}>{showConfirmPass ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                   </div>
                 </div>
               </>
            )}
            {error && <div className="status-msg error">{error}</div>}
            <button type="submit" className="submit-btn" disabled={isLoading}>{isLoading ? "Verifying..." : "Verify Account"}</button>
            <button type="button" className="text-link mt-4" onClick={() => { setView(pendingAction); setOtp(["", "", "", "", "", ""]); }}>&larr; Back</button>
          </form>
        ) : view === "forgot" ? (
          <form className="login-form" onSubmit={handleSubmit}>
            {renderHeader("Reset Password", "Enter email to receive a reset link.")}
            <div className="input-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <input type="email" name="email" onChange={handleChange} required />
              </div>
            </div>
            {error && <div className="status-msg error">{error}</div>}
            {successMsg && <div className="status-msg success">{successMsg}</div>}
            <button type="submit" className="submit-btn" disabled={isLoading}>{isLoading ? "Sending..." : "Send Reset Link"}</button>
            <div className="forgot-link" style={{textAlign: "center", marginTop: "10px"}} onClick={() => { setView("login"); setError(""); setSuccessMsg(""); }}>&larr; Back to Sign In</div>
          </form>
        ) : (
          <>
            <div className="auth-tabs">
              {["login", "signup", "join"].map(v => (
                <button key={v} className={view === v ? "active" : ""} onClick={() => { setView(v); setError(""); setSuccessMsg(""); }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.form key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="login-form" onSubmit={handleSubmit}>
                {renderHeader(view === "login" ? "Welcome Back" : "Start Journey", "Access your institutional workspace.")}
                {view === "signup" && (
                  <div className="input-group">
                    <label>Full Name</label>
                    <div className="input-wrapper"><input type="text" name="name" onChange={handleChange} required /></div>
                  </div>
                )}
                <div className="input-group">
                  <label>Email Address</label>
                  <div className="input-wrapper"><input type="email" name="email" onChange={handleChange} required /></div>
                </div>
                {view !== "join" && (
                  <div className="input-group">
                    <label>Password</label>
                    <div className="input-wrapper">
                      <input type={showPass ? "text" : "password"} name="password" onChange={handleChange} required />
                      <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                    </div>
                    {view === "login" && (
                      <div className="forgot-link" onClick={() => { setView("forgot"); setError(""); }}>Forgot Password?</div>
                    )}
                  </div>
                )}
                {view === "signup" && (
                  <div className="input-group">
                    <label>Confirm Password</label>
                    <div className="input-wrapper">
                      <input type={showConfirmPass ? "text" : "password"} name="confirmPassword" onChange={handleChange} required />
                      <button type="button" className="eye-btn" onClick={() => setShowConfirmPass(!showConfirmPass)}>{showConfirmPass ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                    </div>
                  </div>
                )}
                {error && <div className="status-msg error">{error}</div>}
                <button type="submit" className="submit-btn" disabled={isLoading}>{isLoading ? "Processing..." : "Continue"}</button>
                {view === "login" && (
                  <>
                    <div className="divider"><span>or continue with</span></div>
                    <div className="google-btn" onClick={() => handleGoogleLogin()}>
                       <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="google-icon" alt="G" />
                       Sign in with Google
                    </div>
                  </>
                )}
              </motion.form>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;