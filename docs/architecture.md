# Architecture Notes

## Main parts

- Ingestion: clone repo, parse code, extract structure, clean up temp files
- Graph: store entities and relationships in Neo4j
- Vectors: store embeddings in Qdrant
- Retrieval: combine graph traversal, vector search, and keyword search
- Generation: answer with citations or refuse when evidence is weak

## Early scope

- Python first
- Backend first
- UI later

