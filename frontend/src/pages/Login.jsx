import React from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const Login = () => {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  // The Google Hook
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log("Google Responded:", tokenResponse);

      // Call our backend logic
      const result = await googleLogin(tokenResponse);

      if (result.success) {
        navigate("/"); // Redirect to Dashboard on success
      } else {
        alert("Login failed. Check console for details.");
      }
    },
    onError: () => console.log("Google Login Failed"),
  });

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon-large">E</div>
          <h2>Welcome Back</h2>
          <p>Enter your credentials to access the workspace</p>
        </div>

        {/* Attach the function to your custom button */}
        <button className="google-btn" onClick={() => loginWithGoogle()}>
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
            className="google-icon"
          />
          <span>Continue with Google</span>
        </button>

        <div className="divider">
          <span>or sign in with email</span>
        </div>

        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="principal@school.edu" required />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" required />
          </div>

          <button type="submit" className="submit-btn">
            Sign In to Account
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
