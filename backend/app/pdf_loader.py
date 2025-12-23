import pdfplumber
from typing import List, Dict


def clean_text(text: str) -> str:
    """Basic cleanup for PDF text."""
    if not text:
        return ""
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text


def chunk_text(
    text: str,
    chunk_size: int = 400,
    overlap: int = 50
) -> List[str]:
    """
    Split text into overlapping chunks.
    """
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap

    return chunks


def ingest_pdf(pdf_path: str) -> List[Dict]:
    """
    Load PDF → extract page text → chunk → attach metadata.

    Returns:
    [
        {
            "document": "sample.pdf",
            "page": 2,
            "chunk_id": "sample.pdf_p2_c3",
            "text": "chunk text..."
        }
    ]
    """
    results = []
    document_name = pdf_path.split("/")[-1]

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            page_number = page_index + 1
            raw_text = page.extract_text()

            if not raw_text:
                continue

            cleaned = clean_text(raw_text)
            chunks = chunk_text(cleaned)

            for i, chunk in enumerate(chunks):
                results.append({
                    "document": document_name,
                    "page": page_number,
                    "chunk_id": f"{document_name}_p{page_number}_c{i}",
                    "text": chunk
                })

    return results


# ---------------------------
# QUICK TEST
# ---------------------------
if __name__ == "__main__":
    chunks = ingest_pdf("pdfs/AI.pdf")

    print(f"Total chunks: {len(chunks)}")
    print("Sample chunk:\n")
    for i in range(len(chunks)):
        print(chunks[i])
