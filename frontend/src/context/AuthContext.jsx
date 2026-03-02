/* eslint-disable react-hooks/exhaustive-deps */
import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import LoadingScreen from "../components/common/LoadingScreen";
import { getErrorMessage } from "../utils/errorHandler";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State to tell the Login page if we need to show the "Set Password" screen
  const [requiresGoogleSetup, setRequiresGoogleSetup] = useState(false); 

  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("edusphere_saved_dept");
    localStorage.removeItem("edusphere_saved_year");
    setUser(null);
    setRequiresGoogleSetup(false);
    navigate("/login");
  };

  // --- AXIOS INTERCEPTORS ---
  useEffect(() => {
    const reqInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("access_token");
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => Promise.reject(error),
    );

    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          localStorage.getItem("refresh_token") &&
          !originalRequest.url.includes("token/refresh") // Prevents infinite loop
        ) {
          originalRequest._retry = true;
          try {
            const refreshToken = localStorage.getItem("refresh_token");
            const res = await axios.post(
              `${import.meta.env.VITE_API_URL}/api/auth/token/refresh/`,
              { refresh: refreshToken },
            );
            const newAccess = res.data.access;
            localStorage.setItem("access_token", newAccess);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return axios(originalRequest);
          } catch (refreshError) {
            console.error("Session expired completely.", refreshError);
            logout();
            return Promise.reject(refreshError);
          }
        }
        
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, [navigate]);

  // --- ROUTING LOGIC ---
  const handleRedirect = (userData) => {
    if (!userData) return;

    // If they need a password setup, stop here and tell the UI
    if (userData.requires_password_setup) {
      setRequiresGoogleSetup(true);
      if (location.pathname !== "/login") navigate("/login");
      return;
    }

    if (!userData.is_setup_complete) {
      if (location.pathname !== "/setup") navigate("/setup");
      return;
    }

    const hasSeenWelcome = localStorage.getItem(`has_seen_welcome_${userData.id}`);
    if (!hasSeenWelcome) {
      localStorage.setItem(`has_seen_welcome_${userData.id}`, "true");
      if (location.pathname !== "/welcome") navigate("/welcome");
    } else if (location.pathname === "/login" || location.pathname === "/setup") {
      navigate("/");
    }
  };

  // --- INITIAL AUTH CHECK ---
  useEffect(() => {
    const checkLoggedIn = async () => {
      const performAuthCheck = async () => {
        const token = localStorage.getItem("access_token");
        if (token) {
          try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/me/`);
            setUser(res.data);
            handleRedirect(res.data);
          } catch (error) {
            logout();
          }
        }
      };

      if (loading) {
        await Promise.all([performAuthCheck(), new Promise((r) => setTimeout(r, 1000))]);
        setLoading(false);
      } else {
        await performAuthCheck();
      }
    };
    checkLoggedIn();
  }, [location.pathname]);

  const handleAuthResponse = (res) => {
    const { access, refresh, user: userData } = res.data;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    setUser(userData);
    handleRedirect(userData);
  };

  // ==========================================
  // AUTHENTICATION METHODS
  // ==========================================

  const googleLogin = async (googleData) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/google/`, { 
        access_token: googleData.access_token 
      });
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Google login failed." };
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login/`, { email, password });
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  // --- SIGN UP WITH OTP ---
  const requestSignUpOTP = async (email) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register/request-otp/`, { email });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const verifySignUpOTP = async (name, email, password, otp) => {
    try {
      // 1. Splitting the Name (Restored Logic)
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register/verify-otp/`, {
        email, 
        otp, 
        password, 
        first_name: firstName, 
        last_name: lastName
      });
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  // --- JOIN TEAM FLOW ---
  const requestJoinTeamOTP = async (email) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/join-team/request-otp/`, { email });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const completeJoinTeam = async (email, otp, password) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/join-team/complete/`, {
        email, otp, password
      });
      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  // --- GOOGLE SET PASSWORD ---
  const setFirstTimePassword = async (password) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/set-google-password/`, { password });
      setRequiresGoogleSetup(false);
      handleRedirect({...user, requires_password_setup: false});
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  // --- PASSWORD RESET FLOW (Restored) ---
  const resetPassword = async (email) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/password/reset/`, { email });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
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
        },
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        requiresGoogleSetup,
        googleLogin,
        login,
        requestSignUpOTP,
        verifySignUpOTP,
        requestJoinTeamOTP,
        completeJoinTeam,
        setFirstTimePassword,
        resetPassword,
        resetPasswordConfirm, 
        logout,
      }}
    >
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);