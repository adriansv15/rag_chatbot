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
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const MAX_TOTAL_SIZE = 1 * 1024 * 1024; // 1MB

    const getTotalSize = (files: File[]) =>
      files.reduce((sum, f) => sum + f.size, 0);

    const handleSend = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!input.trim() && files.length === 0) return;

        // Total size check
        const totalSize = getTotalSize(files);
        if (totalSize > MAX_TOTAL_SIZE) {
          alert("Total file size exceeds 1MB. Please upload smaller files.");
          return;
        }

        // 1. Add User Message
         // 1. Prepare UI Message (Show filename if exists)
        // Display filenames in chat bubble
        const fileListText =
          files.length > 0
            ? "\n\n📎 Attached:\n" + files.map(f => `• ${f.name}`).join("\n")
            : "";

        const userMsg: Message = {
          role: "user",
          content: input + fileListText,
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");

        
        // 2. Prepare Multipart Form Data
        const formData = new FormData();
        formData.append("message", input);
        formData.append("session_id", sessionId || "");
        for (const f of files) {
          const text = await f.text();
          if (text.length > 1000000) {
            alert(`File "${f.name}" is too large for the AI context.`);
            return;
          }
          formData.append("files", f);
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
        // Clear files after sending
          setFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = "";
        };
    
        // 1. Add a clear function to reset both state and DOM
    const clearSingleFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));

      // Reset input so user can re-upload the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const clearAllFiles = () => {
      setFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    // 2. Add a function to ingest the file into your RAG DB
    const handleSaveAll = async () => {
      if (files.length === 0) {
        alert("No files to save");
        return;
      }

      const formData = new FormData();
      files.forEach(f => formData.append("files", f));

      const response = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        alert("Failed to save all files");
        return;
      }

      alert("All files saved!");

      clearAllFiles();
    };

    const handleSaveSingle = async (file: File, index: number) => {
      const formData = new FormData();
      formData.append("files", file);

      try {
        const response = await fetch("http://localhost:8000/ingest", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          alert("Failed to save file");
          return;
        }

        alert(`Saved: ${file.name}`);

        // Remove only this file
        clearSingleFile(index);

      } catch (err) {
        console.error(err);
        alert("Error uploading file");
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
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white dark:bg-[#2f2f2f] w-fit px-3 py-1.5 rounded-xl text-xs border border-gray-200 dark:border-white/10 shadow-sm"
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium border-r border-gray-300 dark:border-gray-700 pr-2">
                    📄 {f.name}
                  </span>

                  <button 
                    type="button" 
                    onClick={() => handleSaveSingle(f, i)} 
                    className="text-emerald-500 font-bold hover:text-emerald-400"
                  >
                    SAVE
                  </button>

                  <button
                    type="button"
                    onClick={() => clearSingleFile(i)}
                    className="text-red-400 hover:text-red-500 font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
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
            
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept=".txt, .pdf, .docx, .png, .jpg, .jpeg"
              multiple
              onChange={(e) => {
                const newFiles = Array.from(e.target.files || []);
                setFiles(prev => [...prev, ...newFiles]);
              }}
            />


            
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
              📎
            </button>


            <button type="submit" className="ml-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-80 shrink-0">
              Send ↑
            </button>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSaveAll}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Save All Files
            </button>

            <button
              onClick={clearAllFiles}
              className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear All Files
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
