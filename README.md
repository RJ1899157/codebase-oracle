# 🔮 Codebase Oracle: GraphRAG for GitHub Repositories

> **Codebase Oracle** is an end-to-end GraphRAG + Vector RAG system for analyzing and querying GitHub repositories with deep structural reasoning, interactive graph visualization, and strictly grounded citations.

---

## 🚀 Key Features

- **AST-Powered Ingestion**: Clones GitHub repositories, extracts Abstract Syntax Trees using **Tree-sitter**, and resolves classes, functions, methods, imports, inheritance, and call graphs.
- **Dual Knowledge Storage**:
  - **Neo4j**: Structural relationships (`CONTAINS`, `IMPORTS`, `CALLS`, `INHERITS`).
  - **Qdrant**: Vector embeddings for semantic search over code chunks.
- **Hybrid Retrieval**:
  - Entity extraction & Neo4j graph neighborhood traversal.
  - BM25 keyword matching with tokenized code identifier extraction.
  - **Reciprocal Rank Fusion (RRF)** for rank unification.
- **Strict Grounding & Deep Citations**:
  - Primary LLM: **Groq LLaMA 3.3 70B** (Ultra-fast).
  - Fallback LLM: **Google Gemini Flash**.
  - Direct GitHub file and line-range links (`#L10-L24`).
  - Automated refusal on insufficient context.
- **Interactive UI**: Built with **Next.js**, **React Flow**, and **TailwindCSS** for live graph rendering, node inspection, and Q&A.
- **RAGAS-Style Evaluation Suite**: Built-in benchmark suite measuring Faithfulness, Context Precision, and Refusal Accuracy.

---

## 🛠️ Architecture

```mermaid
graph TD
    User([User / Web UI]) -->|1. Submit GitHub URL| API[FastAPI Backend]
    API -->|2. Git Clone to Tempdir| Ingest[Tree-sitter Ingestion Engine]
    Ingest -->|3. Extract Syntax Tree| Graph[Neo4j Knowledge Graph]
    Ingest -->|4. Chunk & Embed| Vector[Qdrant Vector Store]
    
    User -->|5. Ask Natural-Language Question| API
    API -->|6a. Graph Traversal| Graph
    API -->|6b. Vector Search| Vector
    API -->|6c. BM25 Search| BM25[BM25 Keyword Engine]
    
    Graph & Vector & BM25 -->|7. Combine Rankings| RRF[Reciprocal Rank Fusion]
    RRF -->|8. Grounded Prompt with Citations| LLM[Groq LLaMA 3.3 70B / Gemini Flash]
    LLM -->|9. Answer + GitHub Deep Links| User