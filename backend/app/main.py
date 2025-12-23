from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import asyncio

from fastapi.responses import FileResponse
import os
from fastapi import UploadFile, File
import shutil



# ---- Your existing imports ----
from pdf_loader import ingest_pdf
from retriever import init_retriever, search_chunks
from ollama_streamer import stream_ollama_answer
# OR if you switched to ollama:
# from ollama_streamer import stream_answer


# -------------------------------------------------
# App initialization
# -------------------------------------------------
app = FastAPI()

# -------------------------------------------------
# ✅ CORS FIX (THIS IS THE ONLY NEW PART)
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontenddfdd
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Startup: ingest PDF and init retriever
# -------------------------------------------------
@app.on_event("startup")
def startup_event():
    print("🚀 Backend starting...")

    chunks = ingest_pdf("pdfs/AI.pdf")
    init_retriever(chunks)

    print("✅ Retriever initialized.")


# -------------------------------------------------
# Health check
# -------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/pdf/{filename}")
def serve_pdf(filename: str):
    pdf_path = os.path.join("pdfs", filename)

    if not os.path.exists(pdf_path):
        return {"error": "PDF not found"}

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename
    )

# -------------------------------------------------
# Streaming chat endpoint (SSE)
# -------------------------------------------------
@app.get("/chat/stream")
async def chat_stream(query: str):

    async def event_generator():

        # 1️⃣ Tool event
        yield {
            "event": "tool",
            "data": '{"name":"semantic_search","message":"Searching documents..."}'
        }

        # 2️⃣ Semantic search
        results = search_chunks(query, top_k=3)

        if not results:
            yield {
                "event": "text",
                "data": "No relevant information found in the document."
            }
            yield {
                "event": "done",
                "data": "{}"
            }
            return

        # 3️⃣ Build context
        context = "\n\n".join(
            f"(Page {r['page']}) {r['text']}"
            for r in results
        )

        prompt = f"""
You are an AI assistant. Answer ONLY using the context below.

Context:
{context}

Question:
{query}
"""

        # 4️⃣ Stream LLM output
        for token in stream_ollama_answer(prompt):
            yield {
                "event": "text",
                "data": token
            }
            await asyncio.sleep(0)

        # 5️⃣ Citations
        for i, r in enumerate(results, start=1):
            yield {
                "event": "citation",
                "data": f"""{{
                    "id": {i},
                    "document": "{r['document']}",
                    "page": {r['page']},
                    "snippet": "{r['text'][:160]}"
                }}"""
            }

        # 6️⃣ Done
        yield {
            "event": "done",
            "data": "{}"
        }

    return EventSourceResponse(event_generator())
