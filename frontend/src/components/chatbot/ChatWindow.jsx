import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import MessageBubble from "./MessageBubble";
import { getBotResponse, WELCOME_MESSAGE, INITIAL_QUICK_REPLIES } from "./chatResponses";
import "./ChatBot.css";

const ChatWindow = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    { 
      ...WELCOME_MESSAGE, 
      quickReplies: INITIAL_QUICK_REPLIES,
      repliesUsed: false 
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const processMessage = async (userText) => {
    // 1. Disable previous quick replies
    setMessages(prev => {
      const newMsgs = [...prev];
      if (newMsgs.length > 0) newMsgs[newMsgs.length - 1].repliesUsed = true;
      return [...newMsgs, { role: "user", text: userText }];
    });
    
    setInput("");
    setIsTyping(true);

    // 2. 🚀 HYBRID LOGIC: Check teammate's Rule-Based KB First
    const kbResponse = getBotResponse(userText);

    if (!kbResponse.isFallback) {
      // It's a perfect match! Reply instantly without hitting the AI backend.
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: "bot", 
          text: kbResponse.text,
          quickReplies: kbResponse.quickReplies || [],
          repliesUsed: false
        }]);
        setIsTyping(false);
      }, 600); // Tiny delay to make it feel natural
      return;
    }

    // 3. Fallback: Ask the AI Backend
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/chatbot/converse/`,
        { message: userText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages(prev => [...prev, { role: "bot", text: res.data.reply }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "bot", text: "⚠️ Connection Error: Ensure Django and Ollama are running." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) processMessage(input.trim());
  };

  return (
    <div className={`chatwindow-container ${isOpen ? "open" : "closed"}`}>
      <div className="chatwindow-header">
        <div className="chatwindow-title">
          <h3>EduBot AI</h3>
          <span className="chatwindow-status">● Hybrid AI Active</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}>✖</button>
      </div>

      <div className="chatwindow-body premium-scroll" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <MessageBubble message={msg} />
            
            {/* Render Quick Replies if they exist */}
            {msg.role === "bot" && msg.quickReplies && msg.quickReplies.length > 0 && (
              <div className="qr-container">
                {msg.quickReplies.map((qr, idx) => (
                  <button 
                    key={idx} 
                    className="qr-btn" 
                    onClick={() => processMessage(qr.value)}
                    disabled={msg.repliesUsed || isTyping}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="mb-row mb-bot">
            <div className="mb-bubble typing-dots"><span></span><span></span><span></span></div>
          </div>
        )}
      </div>

      <div className="chatwindow-input-area">
        <form onSubmit={handleSend} className="chatwindow-form">
          <input
            type="text"
            className="chatwindow-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={isTyping}
          />
          <button type="submit" className="chatwindow-send-btn" disabled={!input.trim() || isTyping}>➤</button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;