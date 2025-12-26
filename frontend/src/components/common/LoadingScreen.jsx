import React from "react";
import "../../styles/global.css";

const LoadingScreen = ({ message = "Initializing EduSphere..." }) => {
  return (
    <div className="loading-container">
      <div className="content-wrapper">
        {/* Tech Spinner */}
        <div className="tech-spinner">
          <div className="ring ring-1"></div>
          <div className="ring ring-2"></div>
          <div className="core"></div>
        </div>
        {/* Text */}
        <h3 className="loading-text">{message}</h3>
      </div>

      <style>{`
        /* --- FROSTED GLASS CONTAINER --- */
        .loading-container {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          
          /* 1. TRANSPARENT Background (White/Black with low opacity) */
          background-color: rgba(255, 255, 255, 0.1); 
          
          /* 2. BLUR EFFECT (Frosted Look) */
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px); /* Safari support */
          
          transition: all 0.4s ease;
        }

        /* Dark Mode Adjustment for Transparency */
        [data-theme="dark"] .loading-container {
          background-color: rgba(0, 0, 0, 0.2); /* Darker tint for dark mode */
        }

        .content-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        /* --- TECH SPINNER (Clean & Minimal) --- */
        .tech-spinner {
          position: relative;
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ring {
          position: absolute;
          border-radius: 50%;
          border: 3px solid transparent;
        }

        .ring-1 {
          width: 100%;
          height: 100%;
          border-top-color: var(--primary);
          border-left-color: var(--primary-glow);
          animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }

        .ring-2 {
          width: 70%;
          height: 70%;
          border-bottom-color: var(--primary);
          border-right-color: transparent;
          opacity: 0.5;
          animation: spin 1s linear infinite reverse;
        }

        .core {
          width: 15%;
          height: 15%;
          background-color: var(--primary);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--primary);
          animation: pulse 1.5s ease-in-out infinite;
        }

        .loading-text {
          color: var(--text-primary); /* Uses main text color */
          font-weight: 500;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
          margin: 0;
          text-shadow: 0 2px 10px rgba(0,0,0,0.1); /* Subtle shadow for readability */
          animation: fade 2s ease-in-out infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }
        @keyframes fade { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
