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
          !originalRequest.url.includes("token/refresh")
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

    // 1. Explicitly check the Database Flag for password status (Google Login first-timers)
    if (userData.has_usable_password === false) {
      setRequiresGoogleSetup(true);
      if (location.pathname !== "/login") navigate("/login");
      return;
    } else {
      setRequiresGoogleSetup(false);
    }

    // 2. Setup Profile check
    if (!userData.is_setup_complete) {
      if (userData.role_code === "STUDENT") {
        // Keep students on the login page so they can change their default password
        if (location.pathname !== "/login") navigate("/login");
        return;
      } else {
        // Staff and Admins go to the organization setup wizard
        if (location.pathname !== "/setup") {
          navigate("/setup");
        }
        return;
      }
    }

    // 3. Welcome screen check
    // This ensures users see the WelcomeGuide once before entering the main dashboard
    const hasSeenWelcome = localStorage.getItem(`has_seen_welcome_${userData.id}`);
    
    if (!hasSeenWelcome) {
      localStorage.setItem(`has_seen_welcome_${userData.id}`, "true");
      if (location.pathname !== "/welcome") navigate("/welcome");
    } 
    // Final redirect to dashboard if they are on an auth page but fully set up
    else if (location.pathname === "/login" || location.pathname === "/setup") {
      navigate("/");
    }
  };

  // --- CRITICAL FIX: Fetch Fresh Profile on Login ---
  const handleAuthResponse = async (res) => {
    const { access, refresh } = res.data;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    
    try {
      // Always fetch the true CurrentUser payload which includes our custom flags
      const userRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/me/`, {
        headers: { Authorization: `Bearer ${access}` }
      });
      setUser(userRes.data);
      handleRedirect(userRes.data);
    } catch (err) {
      console.error("Failed to sync profile context", err);
      // Fallback if the profile fetch fails
      if (res.data.user) {
        setUser(res.data.user);
        handleRedirect(res.data.user);
      }
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


  // ==========================================
  // AUTHENTICATION METHODS
  // ==========================================

  const googleLogin = async (googleData) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/google/`, { 
        access_token: googleData.access_token 
      });
      await handleAuthResponse(res); 
      return { success: true };
    } catch (error) {
      return { success: false, error: "Google login failed." };
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login/`, { email, password });
      await handleAuthResponse(res);
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
      await handleAuthResponse(res);
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
      await handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  // --- GOOGLE SET PASSWORD & STUDENT FIRST LOGIN ---
  const setFirstTimePassword = async (password) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/set-google-password/`, { password });
      setRequiresGoogleSetup(false);
      
      // ---> FIX: Explicitly update the local state so the router lets them into the Dashboard
      const updatedUser = { ...user, has_usable_password: true, is_setup_complete: true };
      setUser(updatedUser);
      handleRedirect(updatedUser); 
      
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  // --- PASSWORD RESET FLOW ---
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