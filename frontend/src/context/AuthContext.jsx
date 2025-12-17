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

  // --- THE GATEKEEPER LOGIC ---
  const handleRedirect = (userData) => {
    if (!userData) return;

    // 1. If Setup is NOT complete, FORCE them to Wizard
    if (!userData.is_setup_complete) {
      // Prevent infinite loop if already on setup page
      if (location.pathname !== "/setup") {
        navigate("/setup");
      }
    }
    // 2. If Setup IS complete, send to Dashboard (if they are stuck on login/setup)
    else if (location.pathname === "/login" || location.pathname === "/setup") {
      navigate("/");
    }
  };

  // 1. Check Login on App Load
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          // Get fresh user data (now includes is_setup_complete!)
          const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/auth/user/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const userData = res.data;
          setUser(userData);
          handleRedirect(userData);
        } catch (error) {
          console.error("Session expired or invalid");
          logout();
        }
      }
      setLoading(false);
    };
    checkLoggedIn();
  }, [location.pathname]); // Re-run check on route change

  // 2. Google Login Action
  const googleLogin = async (googleData) => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/google/`,
        { access_token: googleData.access_token }
      );

      const { access, refresh, user: userData } = res.data;

      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);

      setUser(userData);
      handleRedirect(userData);

      return { success: true };
    } catch (error) {
      console.error("Login Failed:", error);
      return { success: false, error: error.response?.data };
    }
  };

  // 3. Logout
  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleLogin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
