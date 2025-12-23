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

// Empty State Component
function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  const prompts = [
    { icon: FileText, text: "Summarize contract" },
    { icon: Calendar, text: "Find key dates" },
    { icon: AlertTriangle, text: "Identify risks" }
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Logo */}
      <div className="mb-8 relative">
        <div className="w-32 h-32 bg-white rounded-3xl shadow-xl flex items-center justify-center">
          <svg
            className="w-16 h-16 text-blue-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C10.89 2 10 2.89 10 4C10 4.55 10.22 5.05 10.59 5.41L8.88 7.13C8.54 6.96 8.16 6.86 7.75 6.86C6.64 6.86 5.75 7.75 5.75 8.86C5.75 9.41 5.97 9.91 6.34 10.27L4.63 11.98C4.29 11.81 3.91 11.71 3.5 11.71C2.39 11.71 1.5 12.6 1.5 13.71C1.5 14.82 2.39 15.71 3.5 15.71C4.61 15.71 5.5 14.82 5.5 13.71C5.5 13.16 5.28 12.66 4.91 12.3L6.62 10.59C6.96 10.76 7.34 10.86 7.75 10.86C8.86 10.86 9.75 9.97 9.75 8.86C9.75 8.31 9.53 7.81 9.16 7.45L10.87 5.74C11.21 5.91 11.59 6.01 12 6.01C13.11 6.01 14 5.12 14 4.01C14 2.9 13.11 2.01 12 2.01M12 15C10.89 15 10 15.89 10 17V20C10 21.11 10.89 22 12 22C13.11 22 14 21.11 14 20V17C14 15.89 13.11 15 12 15Z"/>
          </svg>
        </div>
      </div>

      {/* Welcome Text */}
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Welcome back
      </h1>
      <p className="text-gray-500 text-center max-w-md mb-10 text-lg leading-relaxed">
        I'm ready to analyze your documents. Upload a file or ask me anything to begin.
      </p>

      {/* Prompt Suggestions */}
      <div className="flex flex-wrap gap-3 justify-center max-w-2xl">
        {prompts.map((prompt, index) => (
          <button
            key={index}
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

export default function Chat() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfState, setPdfState] = useState<PdfState>(null);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 14;

  const streamRef = useRef<EventSource | null>(null);
  const lastTextRef = useRef<string>("");

  function sendQuery(promptText?: string) {
    const textToSend = promptText || query;
    if (!textToSend.trim()) return;

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    lastTextRef.current = "";

    const userMessage: ChatMessage = {
      role: "user",
      text: textToSend,
      citations: [],
      tools: [],
    };

    const assistantMessage: ChatMessage = {
      role: "assistant",
      text: "",
      citations: [],
      tools: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setQuery("");
    setLoading(true);

    streamRef.current = startChatStream(textToSend, {
      onTool: (tool) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated.length - 1;
          const exists = updated[last].tools.some(
            (t) => t.name === tool.name && t.message === tool.message
          );
          if (!exists) {
            updated[last].tools.push(tool);
          }
          return [...updated];
        });
      },

      onText: (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          const previousText = lastTextRef.current;
          let delta = chunk;
          if (chunk.startsWith(previousText)) {
            delta = chunk.slice(previousText.length);
          }
          lastTextRef.current = chunk;
          updated[lastIndex].text += delta;
          return [...updated];
        });
      },

      onCitation: (citation) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated.length - 1;
          const exists = updated[last].citations.some(
            (c) =>
              c.document === citation.document &&
              c.page === citation.page &&
              c.id === citation.id
          );
          if (!exists) {
            updated[last].citations.push(citation);
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

  const handlePromptClick = (prompt: string) => {
    setQuery(prompt);
    sendQuery(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  // PDF Controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* CHAT PANEL */}
      <motion.div
        animate={{ width: pdfState ? "60%" : "100%" }}
        transition={{ duration: 0.35 }}
        className="flex flex-col"
      >
        {/* Navbar */}
        <nav className="w-full bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Left side - Logo and title */}
            <div className="flex items-center gap-3">
              {pdfState && (
                <button
                  onClick={() => setPdfState(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors -ml-2"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
              )}
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {pdfState ? `Chat with ${pdfState.document}` : 'DocChat'}
                </h1>
                {pdfState && (
                  <p className="text-xs text-gray-500">Standard & Poor • 12MB</p>
                )}
              </div>
            </div>

            {/* Right side - Icons */}
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Clock className="w-5 h-5 text-gray-600" />
              </button>
              {pdfState && (
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">JD</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onPromptClick={handlePromptClick} />
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
                    setPdfState({
                      document: c.document,
                      page: c.page,
                      snippet: c.snippet,
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-6 py-6 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-white border-2 border-gray-200 rounded-3xl shadow-sm focus-within:border-gray-300 transition-colors px-2 py-2">
              <button
                className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Add attachment"
              >
                <Plus className="w-5 h-5" />
              </button>

              <input
                className="flex-1 px-2 py-2.5 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={pdfState ? "Ask a follow-up question..." : "Ask a question about your PDFs..."}
                disabled={loading}
              />

              <button
                onClick={() => sendQuery()}
                disabled={loading || !query.trim()}
                className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                aria-label="Send message"
              >
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
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="w-[40%] bg-white border-l border-gray-200 flex flex-col"
          >
            {/* PDF Controls Bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              {/* Zoom Controls */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="p-1.5 hover:bg-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">{zoom}%</span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="p-1.5 hover:bg-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage <= 1}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Additional Controls */}
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-y-auto bg-gray-900">
              <PdfViewer
                pdfFile={pdfState.document}
                page={currentPage}
                snippet={pdfState.snippet}
                onClose={() => setPdfState(null)}
                zoom={zoom / 100}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}