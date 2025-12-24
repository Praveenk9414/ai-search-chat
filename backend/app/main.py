from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse
import asyncio
import os

from pdf_loader import ingest_pdf
from retriever import init_retriever, search_chunks
from ollama_streamer import stream_ollama_answer

PDF_DIR = "pdfs"
os.makedirs(PDF_DIR, exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/reset")
def reset_session():
    # 1. Delete all PDFs
    pdf_dir = "pdfs"
    if os.path.exists(pdf_dir):
        for f in os.listdir(pdf_dir):
            if f.lower().endswith(".pdf"):
                os.remove(os.path.join(pdf_dir, f))

    # 2. Reset retriever (FAISS + embeddings)
    from retriever import reset_retriever
    reset_retriever()

    return {"status": "session reset"}


@app.on_event("startup")
def startup_event():
    print("🚀 Backend starting...")

    all_chunks = []
    for file in os.listdir(PDF_DIR):
        if file.endswith(".pdf"):
            all_chunks.extend(ingest_pdf(os.path.join(PDF_DIR, file)))

    if all_chunks:
        init_retriever(all_chunks)

    print("✅ Backend ready")

@app.post("/upload/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        return {"error": "Only PDF files are allowed"}

    pdf_dir = "pdfs"
    os.makedirs(pdf_dir, exist_ok=True)

    file_path = os.path.join(pdf_dir, file.filename)

    # Save uploaded PDF
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Ingest + update retriever
    new_chunks = ingest_pdf(file_path)

    if not new_chunks:
        return {"error": "No text found in PDF"}

    # IMPORTANT: reinitialize retriever with ALL PDFs
    all_chunks = ingest_pdf(pdf_dir)
    init_retriever(all_chunks)

    return {
        "status": "uploaded",
        "filename": file.filename,
        "chunks_added": len(new_chunks)
    }


@app.get("/pdf/{filename}")
def serve_pdf(filename: str):
    path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(path):
        return {"error": "PDF not found"}
    return FileResponse(path, media_type="application/pdf")


@app.get("/chat/stream")
async def chat_stream(query: str):
    async def event_generator():
        yield {"event": "tool", "data": '{"name":"search","message":"Searching documents..."}'}

        results = search_chunks(query)

        context = "\n".join(f"(Page {r['page']}) {r['text']}" for r in results)

        prompt = f"""
        You are a professional in everything.

        STRICT FORMATTING RULES (MANDATORY):
        - Every heading must be followed by a NEW LINE
        - Bullet points must NEVER appear on the same line as a heading
        - Use markdown exactly as specified
        - If formatting rules are violated, the answer is INVALID

        FORMAT TO FOLLOW EXACTLY wherever applicable:

        ### Overview
        - Bullet point
        - Bullet point

        ### Key Points
        - Bullet point
        - Bullet point

        ### Explanation
        Paragraph text.

        New paragraph on a new line.

        ### Evidence from Documents
        - Evidence point with citation

        ADDITIONAL RULES:
        - Use "-" for bullets
        - One idea per bullet
        - Paragraphs max 3 lines
        - Add blank lines between sections
        - Do NOT inline bullets with headings
        - Prefer bullets over paragraphs

        Context:
        {context}

        Question:
        {query}
        """

        for token in stream_ollama_answer(prompt):
            yield {"event": "text", "data": token}
            await asyncio.sleep(0)

        for i, r in enumerate(results, 1):
            yield {
                "event": "citation",
                "data": f"""{{
                  "id": {i},
                  "document": "{r['document']}",
                  "page": {r['page']},
                  "snippet": "{r['text'][:160]}"
                }}"""
            }

        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
