"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ArrowUp, FileText, Calendar, AlertTriangle, ArrowLeft, MoreVertical, X, Clock } from 'lucide-react';
import Message from "./Message";
import PdfViewer from "./PdfViewer";
import { startChatStream } from "../lib/sse";


export type Citation = {
  id: number;
  document: string;
  page: number;
  snippet: string;
};

export type ToolEvent = {
  name: string;
  message: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  tools: ToolEvent[];
};

type PdfState = {
  document: string;
  page: number;
  snippet: string;
} | null;

/* ==================== EMPTY STATE ==================== */
function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  const prompts = [
    { icon: FileText, text: "Summarize contract" },
    { icon: Calendar, text: "Find key dates" },
    { icon: AlertTriangle, text: "Identify risks" }
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="mb-8">
        <div className="w-32 h-32 bg-white rounded-3xl shadow-xl flex items-center justify-center">
          <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C10.89 2 10 2.89 10 4C10 4.55 10.22 5.05 10.59 5.41L8.88 7.13C8.54 6.96 8.16 6.86 7.75 6.86C6.64 6.86 5.75 7.75 5.75 8.86C5.75 9.41 5.97 9.91 6.34 10.27L4.63 11.98C4.29 11.81 3.91 11.71 3.5 11.71C2.39 11.71 1.5 12.6 1.5 13.71C1.5 14.82 2.39 15.71 3.5 15.71C4.61 15.71 5.5 14.82 5.5 13.71C5.5 13.16 5.28 12.66 4.91 12.3L6.62 10.59C6.96 10.76 7.34 10.86 7.75 10.86C8.86 10.86 9.75 9.97 9.75 8.86C9.75 8.31 9.53 7.81 9.16 7.45L10.87 5.74C11.21 5.91 11.59 6.01 12 6.01C13.11 6.01 14 5.12 14 4.01C14 2.9 13.11 2.01 12 2.01M12 15C10.89 15 10 15.89 10 17V20C10 21.11 10.89 22 12 22C13.11 22 14 21.11 14 20V17C14 15.89 13.11 15 12 15Z"/>
          </svg>
        </div>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome back</h1>
      <p className="text-gray-500 text-center max-w-md mb-10 text-lg leading-relaxed">
        I'm ready to analyze your documents. Upload a file or ask me anything to begin.
      </p>
      <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPromptClick(prompt.text)}
            className="flex items-center gap-3 px-6 py-3.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all text-gray-700 text-base font-medium"
          >
            <prompt.icon className="w-5 h-5 text-gray-500" />
            {prompt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ==================== MAIN CHAT COMPONENT ==================== */
export default function Chat() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [pdfState, setPdfState] = useState<PdfState>(null);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  const streamRef = useRef<EventSource | null>(null);
  const lastTextRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [totalPages, setTotalPages] = useState<number>(0);

  /* ==================== HANDLERS ==================== */
  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("http://localhost:8000/upload/pdf", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        setToast(`📄 "${file.name}" uploaded successfully`);
        setTimeout(() => setToast(null), 2500);
      } catch (err) {
        setToast("❌ PDF upload failed");
        setTimeout(() => setToast(null), 2500);
      }

      e.target.value = "";
    }


  async function resetSession() {
    if (!confirm("This will remove all uploaded PDFs and reset the session. Continue?")) return;
    await fetch("http://localhost:8000/reset", { method: "POST" });
    setMessages([]);
    setPdfState(null);
    setQuery("");
  }

  function sendQuery(promptText?: string) {
    const textToSend = promptText || query;
    if (!textToSend.trim()) return;

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    lastTextRef.current = "";
    const userMessage: ChatMessage = { role: "user", text: textToSend, citations: [], tools: [] };
    const assistantMessage: ChatMessage = { role: "assistant", text: "", citations: [], tools: [] };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setQuery("");
    setLoading(true);

    streamRef.current = startChatStream(textToSend, {
      onTool: (tool) => {
        setMessages((prev) => {
          const updated = [...prev];
          if (!updated[updated.length - 1].tools.some(t => t.name === tool.name && t.message === tool.message)) {
            updated[updated.length - 1].tools.push(tool);
          }
          return [...updated];
        });
      },
      onText: (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.length - 1;
          let delta = chunk.startsWith(lastTextRef.current) ? chunk.slice(lastTextRef.current.length) : chunk;
          lastTextRef.current = chunk;
          updated[idx].text += delta;
          return [...updated];
        });
      },
      onCitation: (citation) => {
        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.length - 1;
          if (!updated[idx].citations.some(c => c.document === citation.document && c.page === citation.page && c.id === citation.id)) {
            updated[idx].citations.push(citation);
          }
          return [...updated];
        });
      },
      onDone: () => {
        setLoading(false);
        streamRef.current = null;
      },
    });
  }

  /* ==================== RENDER ==================== */
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* CHAT PANEL */}
      <motion.div animate={{ width: pdfState ? "60%" : "100%" }} transition={{ duration: 0.35 }} className="flex flex-col">

        {/* Navbar */}
        <nav className="w-full bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pdfState && (
                <button onClick={() => setPdfState(null)} className="p-2 hover:bg-gray-100 rounded-lg -ml-2">
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
              )}
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {pdfState ? `Chat with ${pdfState.document}` : 'DocChat'}
                </h1>
                {pdfState && <p className="text-xs text-gray-500"></p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg"><Clock className="w-5 h-5 text-gray-600" /></button>
              <button onClick={resetSession} className="p-2 hover:bg-gray-100 rounded-lg" title="Reset session">
                <X className="w-5 h-5 text-gray-600" />
              </button>
              {pdfState && <button className="p-2 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-5 h-5 text-gray-600" /></button>}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">JD</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onPromptClick={(p) => { setQuery(p); sendQuery(p); }} />
          ) : (
            <div className="max-w-4xl mx-auto px-6 py-8">
              {messages.map((m, i) => (
                <Message
                  key={i}
                  role={m.role}
                  text={m.text}
                  citations={m.citations}
                  tools={m.tools}
                  onCitationClick={(c) => {
                    setCurrentPage(c.page);
                    setPdfState({ document: c.document, page: c.page, snippet: c.snippet });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t bg-white px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 border-2 border-gray-200 rounded-3xl px-2 py-2">
              <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={handlePdfUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                <Plus className="w-5 h-5" />
              </button>
              <input
                className="flex-1 px-2 py-2.5 outline-none text-gray-900 placeholder-gray-400"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendQuery())}
                placeholder={pdfState ? "Ask a follow-up question..." : "Ask a question about your PDFs..."}
                disabled={loading}
              />
              <button onClick={() => sendQuery()} disabled={loading || !query.trim()} className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300">
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 text-center mt-4">
              {pdfState ? "AI can make mistakes. Please verify important information." : "DocChat can make mistakes. Please verify important info."}
            </p>
          </div>
        </div>
      </motion.div>

      {/* PDF VIEWER */}
      <AnimatePresence>
        {pdfState && (
          <motion.div initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} className="w-[40%] bg-white border-l flex flex-col">

            {/* Controls */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                <button onClick={() => setZoom(p => Math.max(p - 10, 50))} disabled={zoom <= 50} className="p-1.5 hover:bg-white rounded disabled:opacity-50">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">{zoom}%</span>
                <button onClick={() => setZoom(p => Math.min(p + 10, 200))} disabled={zoom >= 200} className="p-1.5 hover:bg-white rounded disabled:opacity-50">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage <= 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
              </div>
            </div>

            {/* PDF Container with proper scroll */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 pdf-container" style={{
              scrollBehavior: 'smooth',
              position: 'relative'
            }}>
              <style jsx global>{`
                .react-pdf__Page__textContent span {
                  line-height: 1.2 !important;
                  display: inline !important;
                }
                .react-pdf__Page__textContent {
                  line-height: 1.2 !important;
                }
              `}</style>
              <div className="flex justify-center py-6 px-4">
                <PdfViewer
                  pdfFile={pdfState.document}
                  page={currentPage}
                  snippet={pdfState.snippet}
                  zoom={zoom / 100}
                  onClose={() => setPdfState(null)}
                  onLoad={(pages) => {
                    setTotalPages(pages);
                    setCurrentPage((p) => Math.min(p, pages));
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}