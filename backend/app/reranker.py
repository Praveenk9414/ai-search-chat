from sentence_transformers import CrossEncoder
from typing import List, Dict

class Reranker:
    def __init__(self, model_name="cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)

    def rerank(
        self,
        query: str,
        chunks: List[Dict],
        top_k: int = 3
    ) -> List[Dict]:

        if not chunks:
            return []

        pairs = [(query, chunk["text"]) for chunk in chunks]
        scores = self.model.predict(pairs)

        for chunk, score in zip(chunks, scores):
            chunk["rerank_score"] = float(score)

        chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
        return chunks[:top_k]
