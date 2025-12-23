from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse
import asyncio

# ---- Local imports ----
from pdf_loader import ingest_pdf
from retriever import init_retriever, search_chunks
from ollama_streamer import stream_ollama_answer

app = FastAPI()


# -------------------------------------------------
# Startup: load PDF → build embeddings → init FAISS
# -------------------------------------------------
@app.on_event("startup")
def startup_event():
    print("🚀 Starting backend...")

    chunks = ingest_pdf("pdfs/AI.pdf")
    init_retriever(chunks)

    print("✅ Backend ready. Retriever initialized.")


# ----------------
# Health check
# ----------------
@app.get("/health")
def health():
    return {"status": "ok"}


# ----------------
# Streaming chat
# ----------------
@app.get("/chat/stream")
async def chat_stream(query: str):

    async def event_generator():

        # Guard: empty query
        if not query or not query.strip():
            yield {"event": "text", "data": "Please provide a valid query."}
            yield {"event": "done", "data": "{}"}
            return

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
                "data": "No relevant information found in the provided documents."
            }
            yield {"event": "done", "data": "{}"}
            return

        # 3️⃣ Build RAG prompt
        context = "\n\n".join(
            f"(Page {r['page']}) {r['text']}"
            for r in results
        )

        prompt = f"""You are an AI assistant answering questions using ONLY the provided context.

Context:
{context}

Question:
{query}

If the answer is not present in the context, say:
"Not found in the provided documents."
"""

        # 4️⃣ REAL streaming from Ollama
        buffer = ""

        for token in stream_ollama_answer(prompt):
            buffer += token
            if token.endswith(" ") or token.endswith("\n"):
                yield {"event": "text", "data": buffer}
                buffer = ""
            await asyncio.sleep(0)

        if buffer:
            yield {"event": "text", "data": buffer}

            await asyncio.sleep(0)  # allow SSE flush

        # 5️⃣ Citation events
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
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
