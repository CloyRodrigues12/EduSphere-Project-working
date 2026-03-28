import React from 'react';
import { CalendarClock, Hammer } from 'lucide-react';

export default function TimetableManager() {
  return (
    <div style={{ padding: "2rem", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div 
        className="glass-panel" 
        style={{ 
          padding: "4rem", 
          borderRadius: "20px", 
          textAlign: "center",
          maxWidth: "600px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem"
        }}
      >
        <div style={{ display: "flex", gap: "1rem", color: "var(--purple)", marginBottom: "1rem" }}>
          <CalendarClock size={48} />
          <Hammer size={48} />
        </div>
        
        <h2 style={{ color: "var(--text-primary)", fontSize: "2rem", margin: 0 }}>
          Timetable Manager
        </h2>
        
        <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", lineHeight: "1.6" }}>
          This module is currently under development. Soon, you will be able to seamlessly drag-and-drop teaching allocations into an interactive grid and automatically generate Excel-ready timetables.
        </p>

    
      </div>
    </div>
  );
}