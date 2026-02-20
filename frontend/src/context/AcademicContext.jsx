import React, { createContext, useState, useEffect, useContext } from "react";
import { academicService } from "../services/api";
import { useAuth } from "./AuthContext";

const AcademicContext = createContext();

export const AcademicProvider = ({ children }) => {
  const { user } = useAuth();
  const [academicYears, setAcademicYears] = useState([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAcademicYears = async () => {
    if (!user) return;
    try {
      const res = await academicService.getAcademicYears();
      setAcademicYears(res.data);
      // Find the one marked "is_active = true" in the database
      const active = res.data.find((ay) => ay.is_active) || res.data[0];
      setActiveAcademicYear(active);
    } catch (error) {
      console.error("Failed to load academic years", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
  }, [user]);

  return (
    <AcademicContext.Provider
      value={{
        academicYears,
        activeAcademicYear,
        setActiveAcademicYear, // Allows Topbar to temporarily switch years to view history
        refreshAcademicData: fetchAcademicYears,
        loading,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademic = () => useContext(AcademicContext);
