import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="spinner" style={{ margin: "5rem auto" }}></div>;
  }

  // 1. Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Setup Incomplete Logic
  if (!user.is_setup_complete) {
    // Students MUST change password on Login screen
    if (user.role === "STUDENT" && location.pathname !== "/login") {
      return <Navigate to="/login" replace />;
    }
    // Staff/Admins MUST complete the Setup Wizard
    if (user.role !== "STUDENT" && location.pathname !== "/setup") {
      return <Navigate to="/setup" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;