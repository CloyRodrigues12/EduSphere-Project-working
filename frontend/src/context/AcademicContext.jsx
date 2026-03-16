/* eslint-disable  */
import React, { createContext, useState, useEffect, useContext } from "react";
import { academicService, staffService } from "../services/api";
import { useAuth } from "./AuthContext";

const AcademicContext = createContext();

export const AcademicProvider = ({ children }) => {
  const { user } = useAuth();

  // Academic Year State
  const [academicYears, setAcademicYears] = useState([]);
  const [activeAcademicYearState, setActiveAcademicYearState] = useState(null);

  // Department State
  const [departments, setDepartments] = useState([]);
  const [activeDepartmentState, setActiveDepartmentState] = useState(null);

  // --- NEW: TERM STATE ---
  const [activeTermState, setActiveTermState] = useState(localStorage.getItem("edusphere_saved_term") || "ODD");

  const [loading, setLoading] = useState(true);

  // --- MEMORY WRAPPERS ---
  // These wrappers update the state AND save the choice to the browser's memory
  const setActiveDepartment = (dept) => {
    setActiveDepartmentState(dept);
    if (dept) {
      localStorage.setItem("edusphere_saved_dept", dept.id);
    } else {
      localStorage.setItem("edusphere_saved_dept", "ALL");
    }
  };

  const setActiveAcademicYear = (year) => {
    setActiveAcademicYearState(year);
    if (year) {
      localStorage.setItem("edusphere_saved_year", year.id);
    }
  };

  // --- NEW: TERM WRAPPER ---
  const setActiveTerm = (term) => {
    setActiveTermState(term);
    localStorage.setItem("edusphere_saved_term", term);
  };

  const fetchGlobalContext = async () => {
    if (!user || !user.is_setup_complete) {
        setLoading(false);
        return;
    }
    
    try {
      // Fetch both Years and Departments simultaneously
      const [yearsRes, deptsRes] = await Promise.all([
        academicService.getAcademicYears(),
        staffService.getDepartments(),
      ]);

      // 1. Handle Academic Years
      if (yearsRes.data && yearsRes.data.length > 0) {
        setAcademicYears(yearsRes.data);

        // Check Memory First
        const savedYearId = localStorage.getItem("edusphere_saved_year");
        let initialYear = null;

        if (savedYearId) {
          initialYear = yearsRes.data.find(
            (y) => String(y.id) === String(savedYearId),
          );
        }

        // Fallback to active year if memory is empty or invalid
        if (!initialYear) {
          initialYear =
            yearsRes.data.find((ay) => ay.is_active) || yearsRes.data[0];
        }
        setActiveAcademicYear(initialYear);
      } else {
        setAcademicYears([]);
        setActiveAcademicYearState(null);
      }

      // 2. Handle Departments
      if (deptsRes.data && deptsRes.data.length > 0) {
        setDepartments(deptsRes.data);

        // Support both user.role_code and user.role just to be safe
        const isOrgAdmin = ["SUPER_ADMIN", "ORG_ADMIN"].includes(user?.role_code || user?.role);

        // Check Memory First
        const savedDeptId = localStorage.getItem("edusphere_saved_dept");
        let initialDept = null;

        if (savedDeptId) {
          if (savedDeptId === "ALL" && isOrgAdmin) {
            initialDept = { id: "ALL", name: "All Departments" };
          } else {
            initialDept = deptsRes.data.find((d) => String(d.id) === String(savedDeptId));
          }
        }

        // Fallback to default logic if memory is empty
        if (!initialDept) {
          if (isOrgAdmin) {
            initialDept = { id: "ALL", name: "All Departments" };
          } else {
            // MATCH BY EXACT ID from the backend
            initialDept = deptsRes.data.find((d) => d.id === user.department_id) || deptsRes.data[0];
          }
        }
        setActiveDepartment(initialDept);
      } else {
        setDepartments([]);
        setActiveDepartmentState(null);
      }
    } catch (error) {
      console.error("Failed to load global context", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <AcademicContext.Provider
      value={{
        // Year Data
        academicYears,
        activeAcademicYear: activeAcademicYearState,
        setActiveAcademicYear, 

        // Department Data
        departments,
        activeDepartment: activeDepartmentState,
        setActiveDepartment, 

        // --- NEW: Term Data ---
        activeTerm: activeTermState,
        setActiveTerm,

        refreshContext: fetchGlobalContext,
        refreshAcademicData: fetchGlobalContext, // Alias to ensure compatibility with other components
        loading,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademic = () => useContext(AcademicContext);