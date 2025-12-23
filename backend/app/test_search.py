from pdf_loader import ingest_pdf
from embedding import EmbeddingModel
from vector_store import VectorStore

# 1. Load PDF chunks
chunks = ingest_pdf("pdfs/AI.pdf")

texts = [c["text"] for c in chunks]

# 2. Embed chunks
embedder = EmbeddingModel()
chunk_embeddings = embedder.embed_texts(texts)

# 3. Build FAISS index
store = VectorStore(dim=chunk_embeddings.shape[1])
store.add(chunk_embeddings, chunks)

# 4. Query
query = "Human Agent"
query_embedding = embedder.embed_query(query)

results = store.search(query_embedding, top_k=3)

print("\nTop results:\n")
for r in results:
    print(f"Page {r['page']}: {r['text'][:120]}...\n")
