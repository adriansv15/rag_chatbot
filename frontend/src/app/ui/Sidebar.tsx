import Link from "next/link";
import { useEffect, useState } from "react";

// components/Sidebar.tsx
interface SidebarProps {
  onNewChat: () => void;
  onClearChat: () => void;
  onSelectSession: (id: string) => void;
  currentSessionId: string | null;
}

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Sidebar({ onNewChat, onClearChat, onSelectSession, currentSessionId }: SidebarProps) {
  const [sessionList, setSessionList] = useState<string[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/sessions`);
      const data = await res.json();
      setSessionList(data.sessions);
    };
    fetchSessions();
  }, [currentSessionId]); // Refresh list when session changes

  return (
    <aside className="w-[260px] bg-[#171717] h-full flex flex-col p-3 text-white">
      <button onClick={onNewChat} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 mb-4">
        + New Chat
      </button>

      <button onClick={onClearChat} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 mb-4">
        - Delete Current Chat
      </button>

       
        {/* Navigation Link to Dashboard */}
        <Link 
          href="/manage-rag" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2f2f2f] transition"
        >
          <span className="text-lg">🗄️</span> 
          <span>Knowledge Base</span>
        </Link>

      <div className="flex-1 overflow-y-auto space-y-1">
        <p className="text-xs text-gray-500 font-bold px-3 mt-4 mb-2">Past Conversations</p>
        {sessionList?.map((id) => (
          <div 
            key={id} 
            onClick={() => onSelectSession(id)}
            className={`px-3 py-2 rounded-lg cursor-pointer truncate text-sm transition ${
              id === currentSessionId ? "bg-[#2c2c2c] border-l-2 border-emerald-500" : "hover:bg-[#2c2c2c]"
            }`}
          >
            {/* Displaying the ID as a link; you could store 'titles' in metadata later */}
            Chat: {id.slice(0, 8)}...
          </div>
        ))}
      </div>
      
    </aside>
  );
}
