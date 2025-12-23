"use client";

import { useEffect, useState } from "react";
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
  onClose: () => void;
  zoom?: number;
};

export default function PdfViewer({
  pdfFile,
  page,
  snippet,
  onClose,
  zoom = 1.0,
}: Props) {

  // ⚙️ Configure pdf.js worker (browser only)
  useEffect(() => {
    (async () => {
      const { pdfjs } = await import("react-pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    })();
  }, []);

  // 🔦 Highlight & scroll to cited text
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!snippet) return;

      const spans = Array.from(
        window.document.querySelectorAll(
          ".react-pdf__Page__textContent span"
        )
      );

      const snippetWords = snippet
        .toLowerCase()
        .split(" ")
        .slice(0, 6);

      let firstMatch: HTMLElement | null = null;

      spans.forEach((span) => {
        const text = span.textContent?.toLowerCase() || "";

        const matchCount = snippetWords.filter((w) =>
          text.includes(w)
        ).length;

        if (matchCount >= Math.ceil(snippetWords.length / 2)) {
          span.style.backgroundColor = "rgba(255, 235, 59, 0.25)";
          span.style.textDecoration = "underline";
          span.style.textDecorationColor = "#f59e0b";
          span.style.textDecorationThickness = "2px";
          span.style.textUnderlineOffset = "3px";
          span.style.borderRadius = "3px";

          if (!firstMatch) {
            firstMatch = span as HTMLElement;
          }
        }
      });

      if (firstMatch) {
        firstMatch.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [page, snippet, zoom]);

  return (
    <div>
      {/* PDF Viewer */}
      <Document file={`/pdfs/${pdfFile}`}>
        <Page pageNumber={page} scale={zoom} renderTextLayer={true} renderAnnotationLayer={false} />
      </Document>
    </div>
  );
}