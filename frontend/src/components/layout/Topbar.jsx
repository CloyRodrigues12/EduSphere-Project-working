import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sun, Moon, Bell, Search, Menu } from "lucide-react";
import "./Topbar.css";

const Topbar = ({ title, onMenuClick }) => {
  const [theme, setTheme] = useState("light");

  // State for user details
  const [user, setUser] = useState({
    name: "Loading...",
    role: "",
    avatarUrl: "",
  });

  // 1. Toggle Theme Logic
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // 2. Fetch User Data Logic
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return; // If not logged in, don't fetch

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/user/me/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const userData = response.data;
        setUser({
          name: userData.name,
          role: userData.role,
          // Generate a dynamic avatar using their name
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            userData.name
          )}&background=6366f1&color=fff&bold=true`,
        });
      } catch (error) {
        console.error("Failed to fetch user profile", error);
        setUser({ name: "Guest", role: "Visitor", avatarUrl: "" });
      }
    };

    fetchUserData();
  }, []);

  return (
    <header className="topbar glass-panel">
      {/* Left: Menu & Title */}
      <div className="topbar-left">
        <button className="icon-btn menu-trigger" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <h1 className="page-title">{title}</h1>
      </div>

      {/* Right: Actions & Profile */}
      <div className="topbar-right">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>

        <button className="icon-btn" onClick={toggleTheme}>
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button className="icon-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        {/* Dynamic Profile Chip */}
        <div className="profile-chip">
          <img
            src={
              user.avatarUrl ||
              "https://ui-avatars.com/api/?name=User&background=random"
            }
            alt="Profile"
          />
          <div className="profile-info">
            <span className="name">{user.name}</span>
            <span className="role">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
