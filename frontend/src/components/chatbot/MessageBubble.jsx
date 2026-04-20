import React from "react";
import "./ChatBot.css";

// 🚀 NEW: A simple parser to turn **text** into bold HTML
const formatText = (text) => {
  if (!text) return null;
  
  // Split the text by the ** delimiters
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      // Remove the ** and wrap in a <strong> tag
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
};

const MessageBubble = ({ message }) => {
  const isBot = message.role === "bot";

  return (
    <div className={`mb-row ${isBot ? "mb-bot" : "mb-user"}`}>
      <div className="mb-bubble">
        <span style={{ whiteSpace: "pre-wrap" }}>
          {formatText(message.text)}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;