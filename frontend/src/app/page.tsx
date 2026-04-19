"use client";
import { useState, useEffect } from "react";
import Sidebar from "./ui/sidebar"; // Assuming your sidebar is a component
import Chat, { Message } from "./ui/chat"; 

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 1. Logic to start a fresh session
  const startNewChat = async () => {
    const res = await fetch(`${NEXT_PUBLIC_API_URL}/new-session`);
    const data = await res.json();
    localStorage.setItem("chat_session_id", data.session_id);
    setSessionId(data.session_id);
    setMessages([]);
  };

  // 2. Logic to clear current session history
  const clearCurrentChat = async () => {
    if (!sessionId) return;
    await fetch(`${NEXT_PUBLIC_API_URL}/clear-history/${sessionId}`, { method: "DELETE" });
    setMessages([]);
  };

  const loadSession = async (id: string) => {
    setSessionId(id);
    localStorage.setItem("chat_session_id", id);
    
    // Fetch the history for this specific ID
    const res = await fetch(`${NEXT_PUBLIC_API_URL}/history/${id}`);
    const data = await res.json();
    setMessages(data.history || []);
  };

  // Initial Load Logic
  useEffect(() => {
    const init = async () => {
      let id = localStorage.getItem("chat_session_id");
      if (id) {
        const res = await fetch(`${NEXT_PUBLIC_API_URL}/history/${id}`);
        const data = await res.json();
        setMessages(data.history || []);
        setSessionId(id);
      } else {
        startNewChat();
      }
    };
    init();
  }, []);

  return (
    <div className="flex h-screen w-full">
      {/* Pass the functions as props to the Sidebar */}
      <Sidebar 
        onNewChat={startNewChat} 
        onClearChat={clearCurrentChat} 
        onSelectSession={loadSession} // NEW PROP
        currentSessionId={sessionId}

      />

      {/* Pass messages and session info to the Chat area */}
      <Chat
        messages={messages} 
        setMessages={setMessages} 
        sessionId={sessionId} 
      />
    </div>
  );
}
