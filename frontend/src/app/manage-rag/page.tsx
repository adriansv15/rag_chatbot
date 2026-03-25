'use client'
import { useState, useEffect } from "react";

// 1. Define the shape of your file object
interface RAGFile {
  id: string;
  filename: string;
}

export default function RAGDashboard() {
  const [files, setFiles] = useState<RAGFile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    const res = await fetch("http://localhost:8000/rag/files");
    const data: RAGFile[] = await res.json();
    setFiles(data);
    setLoading(false);
  };

  const deleteFile = async (filename: string) => {
    if (!confirm(`Remove "${filename}" from the AI's memory?`)) return;
    
    await fetch(`http://localhost:8000/rag/files/${encodeURIComponent(filename)}`, { 
      method: "DELETE" 
    });
    fetchFiles();
  };

  useEffect(() => { fetchFiles(); }, []);

  return (
    <div className="mt-8 p-6 bg-white dark:bg-[#2f2f2f] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Knowledge Base</h2>
        <button onClick={fetchFiles} className="text-blue-500 hover:underline">↻</button>
      </div>

      <div className="space-y-3">
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#212121] rounded-xl border border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-3 px-4">
              <span className="text-lg">📄</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{file.filename}</span>
            </div>
            <button 
              onClick={() => deleteFile(file.filename)}
              className="text-[10px] font-black text-red-400 hover:text-red-500 uppercase tracking-tighter"
            >
              x
            </button>
          </div>
        ))}

        {files.length === 0 && !loading && (
          <p className="text-center py-4 text-xs text-gray-400 italic">No files indexed in ChromaDB.</p>
        )}
      </div>
    </div>
  );
}
