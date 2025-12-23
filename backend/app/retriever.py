from typing import List, Dict

from embedding import EmbeddingModel
from vector_store import VectorStore


# Global singletons (kept in memory)
_embedder: EmbeddingModel | None = None
_vector_store: VectorStore | None = None


def init_retriever(chunks: List[Dict]) -> None:
    """
    Initialize embeddings + FAISS index once at startup.
    """
    global _embedder, _vector_store

    if not chunks:
        raise ValueError("No chunks provided to initialize retriever")

    _embedder = EmbeddingModel()

    texts = [chunk["text"] for chunk in chunks]
    embeddings = _embedder.embed_texts(texts)

    dim = embeddings.shape[1]
    _vector_store = VectorStore(dim)
    _vector_store.add(embeddings, chunks)

    print(f"✅ Retriever initialized with {len(chunks)} chunks")


def search_chunks(query: str, top_k: int = 3) -> List[Dict]:
    """
    Perform semantic search over indexed chunks.
    """
    if _embedder is None or _vector_store is None:
        raise RuntimeError("Retriever not initialized. Call init_retriever() first.")

    query_embedding = _embedder.embed_query(query)
    results = _vector_store.search(query_embedding, top_k=top_k)
    return results
