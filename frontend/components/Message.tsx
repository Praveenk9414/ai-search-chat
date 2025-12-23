import { Sparkles, CheckCircle, ChevronDown, FileText } from 'lucide-react';
import { useState } from 'react';
import type { Citation, ToolEvent } from './Chat';

type MessageProps = {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  tools?: ToolEvent[];
  onCitationClick?: (c: Citation) => void;
};

export default function Message({
  role,
  text,
  citations = [],
  tools = [],
  onCitationClick,
}: MessageProps) {
  const [showTools, setShowTools] = useState(false);
  const [showSources, setShowSources] = useState(true);

  if (role === "user") {
    return (
      <div className="flex justify-end mb-6">
        <div className="flex flex-col items-end max-w-[85%]">
          <span className="text-xs text-gray-500 mb-2 mr-2">You</span>
          <div className="bg-blue-500 text-white rounded-3xl rounded-tr-md px-6 py-4 shadow-sm">
            <p className="text-[15px] leading-relaxed">{text}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="mb-8">
      {/* Tools/Thinking indicator */}
      {tools.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowTools(!showTools)}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors w-full max-w-lg shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <span className="text-[15px] font-medium text-gray-800">
              Searched {tools.length} document{tools.length > 1 ? 's' : ''}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${showTools ? 'rotate-180' : ''}`}
            />
          </button>

          {showTools && (
            <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
              {tools.map((tool, idx) => (
                <div key={idx} className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">{tool.name}:</span> {tool.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Answer header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-500" />
        <span className="text-xl font-bold text-gray-900">Answer</span>
      </div>

      {/* Answer text with inline citations */}
      <div className="text-gray-900 leading-relaxed text-[15px] mb-6">
        {(() => {
          // Replace citation markers like [1], [2], [3] with clickable badges
          const parts = text.split(/(\[\d+\])/g);

          return parts.map((part, partIdx) => {
            const match = part.match(/\[(\d+)\]/);
            if (match) {
              const citationNum = parseInt(match[1]);
              const citation = citations.find(c => c.id === citationNum);

              return (
                <button
                  key={partIdx}
                  onClick={() => citation && onCitationClick?.(citation)}
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors mx-0.5 align-baseline"
                >
                  {citationNum}
                </button>
              );
            }
            return <span key={partIdx}>{part}</span>;
          });
        })()}
      </div>

      {/* Sources section */}
      {citations.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Sources
            </span>
          </div>

          {showSources && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {citations.map((citation) => (
                <button
                  key={citation.id}
                  onClick={() => onCitationClick?.(citation)}
                  className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                      <path d="M14 2v6h6"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900 truncate flex-1">
                        {citation.document}
                      </span>
                      <span className="flex-shrink-0 min-w-[24px] h-6 bg-blue-50 text-blue-600 text-xs font-bold rounded flex items-center justify-center border border-blue-200 px-2">
                        {citation.id}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                      {citation.snippet}
                    </p>

                    <span className="text-xs text-gray-400 font-medium">
                      Page {citation.page}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}