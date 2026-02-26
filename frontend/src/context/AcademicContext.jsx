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

  const [loading, setLoading] = useState(true);

  // --- MEMORY WRAPPERS ---
  // These wrappers update the state AND save the choice to the browser's memory
  const setActiveDepartment = (dept) => {
    setActiveDepartmentState(dept);
    if (dept) {
      localStorage.setItem("edusphere_saved_dept", dept.id);
    }
  };

  const setActiveAcademicYear = (year) => {
    setActiveAcademicYearState(year);
    if (year) {
      localStorage.setItem("edusphere_saved_year", year.id);
    }
  };

  const fetchGlobalContext = async () => {
    if (!user) return;
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

        const isAdmin =
          user?.role_code === "SUPER_ADMIN" ||
          user?.role_code === "ORG_ADMIN" ||
          user?.role === "ORG_ADMIN" ||
          user?.role === "Super Admin" ||
          user?.role === "Principal/HOD";

        // Check Memory First
        const savedDeptId = localStorage.getItem("edusphere_saved_dept");
        let initialDept = null;

        if (savedDeptId) {
          if (savedDeptId === "ALL" && isAdmin) {
            initialDept = { id: "ALL", name: "All Departments" };
          } else {
            initialDept = deptsRes.data.find(
              (d) => String(d.id) === String(savedDeptId),
            );
          }
        }

        // Fallback to default logic if memory is empty
        if (!initialDept) {
          if (isAdmin) {
            initialDept = { id: "ALL", name: "All Departments" };
          } else {
            initialDept =
              deptsRes.data.find((d) => d.name === user.department) ||
              deptsRes.data[0];
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
  }, [user]);

  return (
    <AcademicContext.Provider
      value={{
        // Year Data
        academicYears,
        activeAcademicYear: activeAcademicYearState,
        setActiveAcademicYear, // Passes our memory wrapper

        // Department Data
        departments,
        activeDepartment: activeDepartmentState,
        setActiveDepartment, // Passes our memory wrapper

        refreshContext: fetchGlobalContext,
        loading,
      }}
    >
      {children}
    </AcademicContext.Provider>
  );
};

export const useAcademic = () => useContext(AcademicContext);
