# codebase-oracle

GraphRAG + RAG system for GitHub repositories.

## Goal

The user gives a GitHub URL. The system clones the repo, parses code structure, builds a Neo4j knowledge graph, stores embeddings in Qdrant, and answers questions using graph traversal plus vector retrieval.

## Build order

1. Project setup and architecture
2. Tree-sitter ingestion for Python
3. Neo4j graph writing
4. Qdrant embeddings
5. Hybrid retrieval
6. Answer generation and refusal logic
7. FastAPI backend
8. Next.js UI with graph view
9. Evaluation
10. Docker Compose and documentation

## Rules

- Teach one small step at a time
- Explain the purpose before each step
- Keep secrets in `.env`
- Keep `.env.example` checked in
- Start with Python support first

