import os
import pdfplumber
from typing import List, Dict


def clean_text(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.replace("\n", " ").split())


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap

    return chunks


def ingest_pdf(path: str) -> List[Dict]:
    """
    Accepts:
    - single PDF path
    - OR directory containing PDFs
    """
    results = []

    pdf_files = []
    if os.path.isdir(path):
        pdf_files = [
            os.path.join(path, f)
            for f in os.listdir(path)
            if f.lower().endswith(".pdf")
        ]
    else:
        pdf_files = [path]

    for pdf_path in pdf_files:
        document_name = os.path.basename(pdf_path)

        with pdfplumber.open(pdf_path) as pdf:
            for page_index, page in enumerate(pdf.pages):
                raw_text = page.extract_text()
                if not raw_text:
                    continue

                cleaned = clean_text(raw_text)
                chunks = chunk_text(cleaned)

                for i, chunk in enumerate(chunks):
                    results.append({
                        "document": document_name,
                        "page": page_index + 1,
                        "chunk_id": f"{document_name}_p{page_index+1}_c{i}",
                        "text": chunk
                    })

    return results
