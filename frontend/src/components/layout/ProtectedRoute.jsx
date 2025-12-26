// frontend/src/components/layout/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingScreen from "../common/LoadingScreen";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1. Still checking token? Show Loading Screen.
  if (loading) {
    return <LoadingScreen />;
  }

  // 2. No User? Redirect to Login (and remember where they were trying to go)
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. User Exists? Render the Page!
  return children;
};

export default ProtectedRoute;
