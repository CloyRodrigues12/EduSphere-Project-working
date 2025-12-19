/* eslint-disable */
import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleRedirect = (userData) => {
    if (!userData) return;
    if (!userData.is_setup_complete) {
      if (location.pathname !== "/setup") navigate("/setup");
    } else if (
      location.pathname === "/login" ||
      location.pathname === "/setup"
    ) {
      navigate("/");
    }
  };

  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/user/me/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setUser(res.data);
          handleRedirect(res.data);
        } catch (error) {
          logout();
        }
      }
      setLoading(false);
    };
    checkLoggedIn();
  }, [location.pathname]);

  // --- ACTIONS ---

  const handleAuthResponse = (res) => {
    const { access, refresh, user: userData } = res.data;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    setUser(userData);
    handleRedirect(userData);
  };

  const googleLogin = async (googleData) => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/google/`,
        { access_token: googleData.access_token }
      );
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Google login failed." };
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/login/`,
        { email, password }
      );
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error.response?.data?.non_field_errors?.[0] || "Invalid credentials.",
      };
    }
  };

  const register = async (email, password) => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/registration/`,
        { email, password }
      );
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      const emailError = error.response?.data?.email?.[0];
      const passError = error.response?.data?.password?.[0];
      return {
        success: false,
        error: emailError || passError || "Registration failed.",
      };
    }
  };

  const resetPassword = async (email) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/password/reset/`,
        { email }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to send reset email." };
    }
  };

  const resetPasswordConfirm = async (uid, token, newPassword) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/password/reset/confirm/`,
        {
          uid,
          token,
          new_password1: newPassword,
          new_password2: newPassword,
        }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: "Invalid or expired link." };
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        googleLogin,
        login,
        register,
        resetPassword,
        resetPasswordConfirm,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
