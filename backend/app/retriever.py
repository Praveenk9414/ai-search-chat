from typing import List, Dict
from embedding import EmbeddingModel
from vector_store import VectorStore
from reranker import Reranker

_reranker: Reranker | None = None
_embedder: EmbeddingModel | None = None
_vector_store: VectorStore | None = None


def reset_retriever():
    global _embedder, _vector_store
    _embedder = None
    _vector_store = None
    print("Retriever reset")


def init_retriever(chunks: List[Dict]) -> None:
    global _embedder, _vector_store, _reranker

    _embedder = EmbeddingModel()
    _reranker = Reranker()
    texts = [c["text"] for c in chunks]
    embeddings = _embedder.embed_texts(texts)

    dim = embeddings.shape[1]
    _vector_store = VectorStore(dim)
    _vector_store.add(embeddings, chunks)

    print(f"Retriever initialized with {len(chunks)} chunks")


def add_chunks(chunks: List[Dict]) -> None:
    global _embedder, _vector_store

    if _embedder is None or _vector_store is None:
        raise RuntimeError("Retriever not initialized")

    texts = [c["text"] for c in chunks]
    embeddings = _embedder.embed_texts(texts)

    _vector_store.add(embeddings, chunks)
    print(f"Added {len(chunks)} new chunks")


def search_chunks(query: str, top_k: int = 3) -> List[Dict]:
    if _embedder is None or _vector_store is None or _reranker is None:
        raise RuntimeError("Retriever not initialized")

    # 1️⃣ Fast retrieval (recall)
    query_embedding = _embedder.embed_query(query)
    candidates = _vector_store.search(query_embedding, top_k=10)

    # 2️⃣ Cross-encoder reranking (precision)
    reranked = _reranker.rerank(query, candidates, top_k=top_k)

    print("\n🔁 RERANKED RESULTS")
    for c in reranked:
        print(
            f"score={round(c['rerank_score'], 4)} | "
            f"doc={c['document']} | page={c['page']} | id={c['chunk_id']}"
        )
    return reranked




