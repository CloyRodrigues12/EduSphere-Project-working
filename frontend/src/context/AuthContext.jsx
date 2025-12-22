/* eslint-disable  */
import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // --- AXIOS INTERCEPTOR (The Fix for Token Expiry) ---
  useEffect(() => {
    // 1. Request Interceptor: Attach Token
    const reqInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("access_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 2. Response Interceptor: Handle 401 Token Expiry
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If error is 401 (Unauthorized) and we haven't retried yet
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          localStorage.getItem("refresh_token")
        ) {
          originalRequest._retry = true;

          try {
            // Attempt to refresh token
            const refreshToken = localStorage.getItem("refresh_token");
            const res = await axios.post(
              `${import.meta.env.VITE_API_URL}/api/auth/token/refresh/`,
              { refresh: refreshToken }
            );

            // Save new tokens
            const newAccess = res.data.access;
            localStorage.setItem("access_token", newAccess);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return axios(originalRequest);
          } catch (refreshError) {
            console.error("Session expired completely.", refreshError);
            logout(); // If refresh fails, force logout
          }
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, [navigate]); // Depend on navigate to allow logout

  // --- EXISTING LOGIC ---

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
            `${import.meta.env.VITE_API_URL}/api/user/me/`
            // Header is handled by interceptor now, but keeping it explicit is safe
            // { headers: { Authorization: `Bearer ${token}` } }
          );
          setUser(res.data);
          handleRedirect(res.data);
        } catch (error) {
          // Let the interceptor handle 401s, but if it fails completely:
          if (!localStorage.getItem("access_token")) logout();
        }
      }
      setLoading(false);
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

  // ... inside AuthProvider ...

  // 4. Register (Fixed to match Backend requirements)
  const register = async (name, email, password) => {
    try {
      // Split Name
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/registration/`,
        {
          username: email, // 1. Send email as username to satisfy the requirement
          email: email,
          password1: password, // 2. Backend expects 'password1'
          password2: password, // 3. Backend expects 'password2' (confirmation)
          first_name: firstName,
          last_name: lastName,
        }
      );

      handleAuthResponse(res);
      return { success: true };
    } catch (error) {
      const usernameError = error.response?.data?.username?.[0];
      const emailError = error.response?.data?.email?.[0];
      const passwordError = error.response?.data?.password1?.[0]; // Check password1 error

      return {
        success: false,
        error:
          usernameError ||
          emailError ||
          passwordError ||
          "Registration failed.",
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
