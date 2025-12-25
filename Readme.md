

## 📄 AI Search Chat (Perplexity-style RAG System)

A full-stack AI application that allows users to **upload PDFs**, ask natural language questions, and receive **streamed AI responses with inline citations**. Clicking on a citation opens a **PDF viewer** that automatically navigates to and highlights the referenced section.

The system is inspired by **Perplexity AI** and demonstrates **Retrieval-Augmented Generation (RAG)** with a **Generative UI**.

---

## Displayed on Youtube -> 
      https://www.youtube.com/watch?v=DW-WC5O2Ir4

---

## ✨ Key Features

- 📄 Upload PDFs dynamically from the frontend
- 🔍 Semantic search over PDF content (RAG)
-  Perplexity-style chat interface
-  Real-time streaming responses using SSE
-  Tool call indicators (e.g. *Searching documents…*)
-  Inline numbered citations `[1] [2] [3]`
-  Source cards below responses
- 📖 PDF Viewer with:
  - Smooth slide-in animation
  - Auto-navigation to cited page
  - Highlighted / underlined cited text
  - Zoom & page navigation
- ♻️ Session reset (clear PDFs + vector store)

---

## 🧱 Tech Stack

### Frontend
- **Next.js (App Router)**
- **TypeScript**
- **Tailwind CSS**
- **Framer Motion** (animations)
- **react-pdf / pdf.js**
- **Lucide Icons**

### Backend
- **FastAPI**
- **Python 3.11**
- **Server-Sent Events (SSE)**
- **SentenceTransformers** (local embeddings)
- **FAISS** (vector similarity search)
- **pdfplumber** (PDF parsing)
- **Ollama** (local LLM inference)

---
```
## 🏗 Architecture Overview

┌────────────┐
│    User    │
└─────┬──────┘
      │
      ▼
┌──────────────────────────┐
│        Frontend          │
│        (Next.js)         │
│──────────────────────────│
│ • Chat Interface         │
│ • PDF Upload (+ button)  │
│ • Streaming Responses    │
│ • PDF Viewer + Highlight │
└─────┬────────────────────┘
      │  HTTP / SSE
      ▼
┌──────────────────────────┐
│         Backend          │
│        (FastAPI)         │
│──────────────────────────│
│ • PDF Upload API         │
│ • Text Extraction        │
│ • Chunking               │
│ • Embeddings             │
│ • Vector Store (FAISS)   │
│ • LLM Answer Generator   │
└──────────────────────────┘
```

---

## 🔄 Streaming Protocol (SSE)

The backend streams multiple event types over a single SSE connection:

| Event | Purpose |
|-----|--------|
| `tool` | Tool / reasoning updates |
| `text` | Incremental LLM output |
| `citation` | Document + page + snippet |
| `done` | End of response |

This enables:
- Real-time typing effect
- Tool call UI indicators
- Progressive UI updates

---

## 🧠 RAG Pipeline

1. User uploads PDF from UI
2. PDF stored in `backend/pdfs/`
3. Text extracted using `pdfplumber`
4. Text split into overlapping chunks
5. Chunks embedded using **SentenceTransformer (local)**
6. Stored in FAISS vector index
7. User query embedded
8. Top-K chunks retrieved
9. LLM answers **only using retrieved context**
10. Citations streamed alongside response

---

## ⚙️ Setup Instructions

### 1️⃣ Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # macOS / Linux
# venv\Scripts\activate   # Windows

pip install -r requirements.txt
````

Run backend:

```bash
uvicorn main:app --reload --port 8000
```

Backend URL:

```
http://localhost:8000
```

---

### 2️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```
http://localhost:3000
```

---

## 🌱 Environment Variables

### Backend (`backend/.env`)

```env
OLLAMA_BASE_URL=http://localhost:11434
```

> No API keys are required — the system runs fully locally.

---

## 📦 Libraries Used & Justification

| Library              | Reason                  |
| -------------------- | ----------------------- |
| FastAPI              | Async backend + SSE     |
| sse-starlette        | SSE support             |
| SentenceTransformers | Local embeddings        |
| FAISS                | Fast vector similarity  |
| pdfplumber           | Reliable PDF extraction |
| Ollama               | Local LLM inference     |
| Next.js              | Modern React framework  |
| Framer Motion        | Smooth transitions      |
| react-pdf            | PDF rendering           |

---

## 🧩 Design Decisions

### Why SSE over WebSockets?

* Simpler protocol
* One-way streaming suits LLM output
* Native browser support

### Why local embeddings & LLM?

* No API cost
* Offline-friendly
* Deterministic behavior

### Why in-memory vector store?

* Faster iteration
* Simpler system for assignment scope

---

## ⚠️ Trade-offs & Limitations

* Vector store resets on server restart
* No persistent database
* Single-user session
* PDF highlighting is text-layer based (best-effort)

---

## ♻️ Reset Session

The backend supports resetting the session:

* Deletes uploaded PDFs
* Clears chunks
* Reinitializes vector store

Useful for starting fresh without restarting the server.

---

## 🚀 Future Improvements

* Persistent FAISS index
* Multi-document filtering
* User authentication
* Charts & tables as generative UI
* Hybrid search (BM25 + embeddings)

---
