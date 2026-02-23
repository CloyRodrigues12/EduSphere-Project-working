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
      if (res.data && res.data.length > 0) {
        setAcademicYears(res.data);
        const active = res.data.find((ay) => ay.is_active) || res.data[0];
        setActiveAcademicYear(active);
      } else {
        // BUG FIX: Gracefully handle empty databases
        setAcademicYears([]);
        setActiveAcademicYear(null);
      }
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
        setActiveAcademicYear,
        refreshAcademicData: fetchAcademicYears,
        loading,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademic = () => useContext(AcademicContext);
