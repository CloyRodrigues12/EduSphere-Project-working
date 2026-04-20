import React, { useState } from "react";
import ChatWindow from "./ChatWindow";
import { MessageCircle, X } from "lucide-react";
import "./ChatBot.css";

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="chatbot-wrapper">
      <ChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
      
      <button className="chatbot-fab" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
};

export default ChatBot;