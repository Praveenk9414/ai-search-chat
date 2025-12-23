import faiss
import numpy as np
from typing import List, Dict


class VectorStore:
    def __init__(self, dim: int):
        self.index = faiss.IndexFlatIP(dim)
        self.metadata: List[Dict] = []

    def add(self, embeddings: np.ndarray, metadatas: List[Dict]):
        """
        Store embeddings with metadata.
        """
        self.index.add(embeddings)
        self.metadata.extend(metadatas)

    def search(self, query_embedding: np.ndarray, top_k: int = 5):
        """
        Search similar chunks.
        """
        query_embedding = np.expand_dims(query_embedding, axis=0)
        scores, indices = self.index.search(query_embedding, top_k)

        results = []
        for idx in indices[0]:
            if idx == -1:
                continue
            results.append(self.metadata[idx])

        return results
