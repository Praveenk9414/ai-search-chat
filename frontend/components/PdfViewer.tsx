"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import react-pdf components (client-only)
const Document = dynamic(
  async () => {
    const mod = await import("react-pdf");
    return mod.Document;
  },
  { ssr: false }
);

const Page = dynamic(
  async () => {
    const mod = await import("react-pdf");
    return mod.Page;
  },
  { ssr: false }
);

type Props = {
  pdfFile: string;
  page: number;
  snippet: string;
  zoom?: number;
  onClose: () => void;
  onLoad?: (numPages: number) => void;
};

export default function PdfViewer({
  pdfFile,
  page,
  snippet,
  onClose,
  zoom = 0.8,
  onLoad,
}: Props) {
  const [isTextLayerReady, setIsTextLayerReady] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedSpansRef = useRef<HTMLElement[]>([]);

  // ⚙️ Configure pdf.js worker (browser only)
  useEffect(() => {
    (async () => {
      const { pdfjs } = await import("react-pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

      // Suppress AbortException warnings globally at multiple levels
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;

      console.warn = (...args) => {
        const message = args[0]?.toString() || '';
        if (message.includes('AbortException') ||
            message.includes('TextLayer task cancelled') ||
            message.includes('Rendering cancelled')) {
          return;
        }
        originalConsoleWarn.apply(console, args);
      };

      console.error = (...args) => {
        const message = args[0]?.toString() || '';
        if (message.includes('AbortException') ||
            message.includes('TextLayer task cancelled') ||
            message.includes('Rendering cancelled')) {
          return;
        }
        originalConsoleError.apply(console, args);
      };
    })();
  }, []);

  // Clear highlights when page, snippet, or zoom changes
  useEffect(() => {
    setIsTextLayerReady(false);

    // Clear previous highlights
    highlightedSpansRef.current.forEach((span) => {
      if (span && span.style) {
        span.style.backgroundColor = "";
        span.style.borderRadius = "";
        span.style.padding = "";
      }
    });
    highlightedSpansRef.current = [];
  }, [page, snippet, zoom]);

  // 🔦 Highlight & scroll to cited text - Re-runs on zoom change
  useEffect(() => {
    if (!snippet || !isTextLayerReady) return;

    const timer = setTimeout(() => {
      try {
        const textLayer = containerRef.current?.querySelector(
          ".react-pdf__Page__textContent"
        );

        if (!textLayer) return;

        const spans = Array.from(
          textLayer.querySelectorAll("span")
        ) as HTMLElement[];

        // Normalize the snippet
        const normalizedSnippet = snippet
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        // Build concatenated text from all spans
        let fullText = "";
        const spanRanges: { start: number; end: number; element: HTMLElement }[] = [];

        spans.forEach((span) => {
          const text = (span.textContent || "").trim();
          if (!text) return;

          const start = fullText.length;
          fullText += text.toLowerCase() + " ";
          const end = fullText.length - 1;

          spanRanges.push({ start, end, element: span });
        });

        // Find the snippet in the full text
        let snippetIndex = fullText.indexOf(normalizedSnippet);

        // Fallback: try first 50 characters if exact match fails
        if (snippetIndex === -1 && normalizedSnippet.length > 50) {
          const partial = normalizedSnippet.substring(0, 50);
          snippetIndex = fullText.indexOf(partial);
        }

        // Fallback: try first 30 characters
        if (snippetIndex === -1 && normalizedSnippet.length > 30) {
          const partial = normalizedSnippet.substring(0, 30);
          snippetIndex = fullText.indexOf(partial);
        }

        if (snippetIndex === -1) return;

        const snippetEnd = snippetIndex + normalizedSnippet.length;

        // Find all spans that overlap with the snippet
        const matchedSpans: HTMLElement[] = [];
        let firstMatch: HTMLElement | null = null;

        spanRanges.forEach(({ start, end, element }) => {
          // Check if this span overlaps with snippet range
          if (!(end < snippetIndex || start > snippetEnd)) {
            matchedSpans.push(element);
            if (!firstMatch) {
              firstMatch = element;
            }
          }
        });

        // Apply highlighting
        matchedSpans.forEach((span) => {
          if (span && span.style) {
            span.style.backgroundColor = "rgba(255, 235, 59, 0.4)";
            span.style.borderRadius = "3px";
            span.style.padding = "2px 1px";
          }
        });

        highlightedSpansRef.current = matchedSpans;

        // Scroll to first match within the PDF container
        if (firstMatch) {
          setTimeout(() => {
            const scrollContainer = containerRef.current?.closest('.pdf-container');

            if (scrollContainer && firstMatch) {
              const spanRect = firstMatch.getBoundingClientRect();
              const containerRect = scrollContainer.getBoundingClientRect();

              const scrollTop = scrollContainer.scrollTop +
                              (spanRect.top - containerRect.top) -
                              (containerRect.height / 2) +
                              (spanRect.height / 2);

              scrollContainer.scrollTo({
                top: scrollTop,
                behavior: "smooth"
              });
            }
          }, 100);
        }
      } catch (error) {
        console.debug("Highlight error:", error);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [snippet, isTextLayerReady, zoom]); // Added zoom dependency

  return (
    <div ref={containerRef} style={{ padding: '20px 0' }}>
      <Document
        file={`http://localhost:8000/pdf/${pdfFile}`}
        onLoadSuccess={({ numPages: n }) => {
          setNumPages(n);
          onLoad?.(n);
        }}
        onLoadError={(error) => {
          console.error("PDF load error:", error);
        }}
        loading={
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            color: '#666'
          }}>
            Loading PDF...
          </div>
        }
      >
        {numPages && (
          <Page
            key={`page-${page}-${zoom}`}
            pageNumber={page}
            scale={zoom}
            renderTextLayer
            renderAnnotationLayer={false}
            onRenderTextLayerSuccess={() => {
              setIsTextLayerReady(true);
            }}
            onRenderTextLayerError={(error) => {
              // Suppress expected cancellation warnings
              const message = error?.message || '';
              if (message.includes("TextLayer task cancelled") ||
                  message.includes("AbortException")) {
                return;
              }
              console.debug("Text layer error:", error);
            }}
            loading={
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '600px',
                color: '#666'
              }}>
                Loading page...
              </div>
            }
          />
        )}
      </Document>
    </div>
  );
}