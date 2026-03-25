"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sessionId: string | null;
}

export default function Chat({ messages, setMessages, sessionId }: ChatProps) {
    const [input, setInput] = useState("");
    const [file, setFile] = useState<File | null>(null); // State for selected file
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const handleSend = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!input.trim() && !file) return;

        // 1. Add User Message
         // 1. Prepare UI Message (Show filename if exists)
        const displayContent = file ? `${input}\n\n📎 Attached: ${file.name}` : input;
        const userMsg: Message = { role: "user", content: displayContent };
        setMessages(prev => [...prev, userMsg]);
        setInput("");

        
        // 2. Prepare Multipart Form Data
        const formData = new FormData();
        formData.append("message", input);
        formData.append("session_id", sessionId || "");
        if (file) {
          const fileText = await file.text();
          if (fileText.length > 10000) { // Approx 2,500 tokens
            alert("File is too large for the AI context. Please use a shorter text file.");
            return;
          }
          formData.append("file", file);
        }

        // 2. Add Assistant Placeholder
        const assistantMsg: Message = { role: "assistant", content: "" };
        setMessages(prev => [...prev, assistantMsg]);

        

        const response = await fetch("http://localhost:8000/chat", {
            method: "POST",
            body: formData,
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true }); // Use stream: true for partial chunks

                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    // Ensure we only append if it's the assistant's placeholder
                    if (lastMessage.role === "assistant") {
                        newMessages[newMessages.length - 1] = {
                            ...lastMessage,
                            content: lastMessage.content + chunk
                        };
                    }
                    return newMessages;
                });
            }

        }
        };
    
        // 1. Add a clear function to reset both state and DOM
    const clearFile = () => {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Crucial: Resets the actual HTML element
      }
    };

    // 2. Add a function to ingest the file into your RAG DB
    const handleSaveToRAG = async () => {
      if (!file) return alert("Please select a file first");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        alert("File saved to RAG database!");
        clearFile();
      }
    };
      return (
    <div className="flex flex-col h-full w-full">
      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`w-full py-8 flex justify-center ${msg.role === "assistant" ? "bg-gray-50 dark:bg-[#2f2f2f]" : "bg-white dark:bg-[#212121]"}`}>
            <div className="max-w-3xl w-full px-6 flex gap-6">
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 font-bold text-sm ${msg.role === "assistant" ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"}`}>
                    {msg.role === "assistant" ? "AI" : "U"}
                </div>
                {/* Text Content */}
                <div className="flex-1 text-base leading-7 text-gray-800 dark:text-gray-200 overflow-hidden">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                    // This styles code blocks (like ChatGPT)
                    code({ node, inline, className, children, ...props }: any) {
                        return inline ? (
                        <code className="bg-gray-200 dark:bg-gray-800 rounded px-1 py-0.5" {...props}>
                            {children}
                        </code>
                        ) : (
                        <div className="overflow-auto w-full my-4 rounded-lg bg-black p-4 text-sm text-white">
                            <code {...props}>{children}</code>
                        </div>
                        );
                    },
                    // Styling lists and bold text
                    p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-6 mb-4">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-6 mb-4">{children}</ol>,
                    }}
                >
                    {msg.content}
                </ReactMarkdown>
                </div>
            </div>
          </div>
        ))}
        {/* Spacer for bottom input */}
        <div className="h-40" />
      </div>

      {/* Sticky Bottom Container */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white dark:from-[#212121] via-white dark:via-[#212121] to-transparent pt-10 pb-6 px-4">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex flex-col gap-2">
          
          {/* 1. File Preview Chip */}
          {file && (
            <div className="flex items-center gap-3 bg-white dark:bg-[#2f2f2f] w-fit px-3 py-1.5 rounded-xl text-xs border border-gray-200 dark:border-white/10 shadow-sm animate-in fade-in slide-in-from-bottom-1">
              <span className="text-gray-700 dark:text-gray-300 font-medium border-r border-gray-300 dark:border-gray-700 pr-2">
                📄 {file.name}
              </span>
              
              <button 
                type="button" 
                onClick={handleSaveToRAG} 
                className="text-emerald-500 font-bold hover:text-emerald-400"
              >
                SAVE
              </button>

              <button 
                type="button" 
                onClick={() => { setFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }} 
                className="text-red-400 hover:text-red-500 font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* 2. Main Input Row */}
          <div className="flex items-center bg-white dark:bg-[#2f2f2f] border border-gray-200 dark:border-white/10 rounded-2xl p-1.5 shadow-sm focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-white/20">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message AI..."
              rows={1}
              className="flex-1 bg-transparent border-none py-3 px-3 focus:outline-none resize-none text-gray-800 dark:text-gray-200"
            />
            
            <input type="file" className="hidden" ref={fileInputRef} accept=".txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />

            {!file && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
                📎
              </button>
            )}

            <button type="submit" className="ml-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-80 shrink-0">
              Send ↑
            </button>
          </div>
          
          <p className="text-center text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
              AI can make mistakes. Check important info.
          </p>
        </form>
      </div>
    </div>
  );
}
