# Codebase Oracle (GraphRAG 2.0 & 3D Cosmos)

<div align="center">

![Codebase Oracle Banner](https://img.shields.io/badge/Architecture-GraphRAG%202.0-blue?style=for-the-badge&logo=graphql)
![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js%20WebGL-black?style=for-the-badge&logo=three.js)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)
![Neo4j](https://img.shields.io/badge/Neo4j-5.26-008CC1?style=for-the-badge&logo=neo4j)
![Qdrant](https://img.shields.io/badge/Qdrant-v1.12-DC2626?style=for-the-badge&logo=qdrant)
![Groq LLaMA 3.3 70B](https://img.shields.io/badge/LLM-Groq%20LLaMA%203.3%2070B-F05032?style=for-the-badge&logo=meta)
![RAGAS Score](https://img.shields.io/badge/RAGAS%20Precision-100%25-success?style=for-the-badge)

**An intelligent codebase knowledge graph, multi-dimensional 2D/3D WebGL architecture visualizer, and conversational assistant with verified GitHub citations & dynamic RAGAS evaluation.**

[Features](#-key-features) • [3D Cosmos Engine](#-3d-webgl-cosmos-engine) • [Architecture](#-architecture) • [Getting Started](#-quickstart) • [Evaluation](#-dynamic-ragas-benchmark) • [API Docs](#-api-endpoints)

</div>

---

## 🧭 Overview

**Codebase Oracle** transforms any GitHub repository into an interactive, multi-dimensional Abstract Syntax Tree (AST) knowledge graph and pairs it with a hybrid retrieval-augmented generation (GraphRAG) engine. Developers can explore complex codebases visually in **2D hierarchical trees**, **2D orbital galaxies**, or a fully interactive **3D WebGL Cosmos**, tracing architectural dependencies across files and symbols, and asking deep architectural questions with verified line-level GitHub citations.

### 🌟 What Makes It Special?
1. **Multi-Dimensional Graph Visualization**: Toggle seamlessly between **2D Blueprint Tree**, **2D Orbital Galaxy**, and an immersive **3D WebGL Cosmos Engine** with particle trajectories and orbital physics.
2. **Universal Polyglot Ingestion**: Parses Python, JavaScript, TypeScript, Go, Rust, Java, C++, and configuration files into unified AST symbol nodes and relationships.
3. **Hybrid GraphRAG Retrieval (RRF)**: Merges BM25 lexical keyword matching with 2-hop Neo4j graph dependency expansion using Reciprocal Rank Fusion.
4. **Verified GitHub Citations**: Answers are grounded with exact file paths and source line ranges (`#L10-L45`) linking directly to the remote repository.
5. **Dynamic RAGAS Evaluation**: Benchmark engine that auto-generates test cases from real ingested AST symbols to assess Faithfulness (86%), Context Precision (100%), and Hallucination Refusal (100%).
6. **Jet Black Developer Workspace**: Pitch jet black `#000000` canvas with calm, non-striking pastel accents (Sage Emerald, Warm Amber, Ice Blue, Muted Lavender) engineered for zero eye fatigue.

---

## 🌌 3D WebGL Cosmos Engine

The built-in **3D Cosmos Engine** visualizes software architecture as a celestial constellation in deep space:

* **Stellar Symbol Spheres**: Emissive glowing 3D spheres color-coded by AST type:
  - 🟢 **Sage Emerald (`#3fb950`)**: Modules & Source Files
  - 🟡 **Warm Amber (`#d29922`)**: Classes, Interfaces & Structs
  - 🔵 **Ice Blue (`#58a6ff`)**: Functions & Methods
  - 🟣 **Muted Lavender (`#a371f7`)**: Imports & External Calls
* **Orbital Controls & Cinematic Rotation**: Smooth 360° orbital camera rotation, auto-orbit toggles, and distance scaling.
* **3D Raycasting & Interactive Tooltips**: Hover over celestial nodes to inspect symbol metadata and click to lock inspection cards and trigger AI architectural explanations.
* **Starfield Background Particle Dust**: Ambient 3D starry particle atmosphere on a pure `#000000` canvas.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Ingestion ["1. Universal Polyglot Ingestion"]
        GH[GitHub Repo / Git Clone] --> Disc[Multi-Language File Discovery]
        Disc --> AST[Tree-Sitter / AST Parser]
        AST --> Sym[Classes, Functions, Calls, Imports, Bases]
        AST --> Chunk[Line & Block Chunker]
    end

    subgraph Storage ["2. Dual Storage Layer"]
        Sym --> Neo4j[(Neo4j 5.26 Graph DB)]
        Chunk --> Qdrant[(Qdrant Vector DB / In-Memory BM25)]
    end

    subgraph Retrieval ["3. Hybrid GraphRAG Pipeline"]
        Query[Developer Query] --> Keyword[BM25 Lexical Matching]
        Query --> GraphHop[2-Hop Graph Expansion]
        Keyword --> RRF[Reciprocal Rank Fusion RRF]
        GraphHop --> RRF
        RRF --> Context[Ranked Code Context Chunks]
    end

    subgraph Generation ["4. Grounded Reasoning & Evaluation"]
        Context --> LLM[Groq LLaMA 3.3 70B / Gemini Flash]
        LLM --> Answer[Synthesized Architecture Answer]
        Answer --> Citations[Verified GitHub Line Citations]
        Answer --> RAGAS[Dynamic RAGAS Evaluation Engine]
    end

    subgraph UI ["5. Developer Studio (Next.js 15 + Three.js)"]
        UI_2D[2D Blueprint Tree & Orbital Galaxy]
        UI_3D[3D WebGL Cosmos Constellation]
        UI_Chat[Multi-Turn Conversational Studio]
        UI_Eval[Live RAGAS Benchmark Gauges]
    end

    Answer --> UI_Chat
    Sym --> UI_2D
    Sym --> UI_3D
    RAGAS --> UI_Eval
```

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **3D WebGL Cosmos** | Three.js powered interactive 3D force constellation with auto-orbit, raycasting, and glowing celestial spheres. |
| **2D Blueprint & Galaxy** | React Flow powered hierarchical tree and radial orbit views with category counts. |
| **Universal AST Parsing** | Extracts classes, interfaces, structs, functions, methods, imports, calls, and inheritance bases across `.py`, `.ts`, `.js`, `.go`, `.rs`, `.java`, `.cpp`, and more. |
| **Grounded Line Citations** | Synthesizes responses accompanied by interactive citation pills that link directly to specific GitHub code lines. |
| **1-Click Demo Ingestion** | Instant testability with pre-configured repositories including `FastAPI`, `Flask`, `Express`, and `Tokio`. |
| **Dynamic RAGAS Benchmark** | Live evaluation measuring Faithfulness (86%), Context Precision (100%), and Anti-Hallucination Refusal (100%). |
| **Multi-Turn Chat History** | Context-aware conversations allowing iterative exploration and follow-up architectural questions. |

---

## 🚀 Quickstart

### 1. Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- Groq API Key or Google Gemini API Key

### 2. Setup Environment Variables
Clone the repository and copy the environment configuration:
```bash
git clone https://github.com/RJ1899157/codebase-oracle.git
cd codebase-oracle
cp .env.example .env
```

Edit `.env` and add your API key:
```ini
GROQ_API_KEY=gsk_your_groq_api_key_here
# or
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Launch with Docker Compose
Start the entire stack (FastAPI Backend, Next.js Web App with Three.js, Neo4j Graph DB, Qdrant Vector DB):
```bash
docker compose up -d --build
```

Access the applications:
* **Web Workspace (2D & 3D)**: [http://localhost:3000](http://localhost:3000)
* **FastAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Neo4j Browser**: [http://localhost:7474](http://localhost:7474) (User: `neo4j`, Password: (blank / configured))
* **Qdrant Dashboard**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

---

## 📊 Dynamic RAGAS Benchmark

Codebase Oracle includes a dynamic evaluation suite that automatically creates test cases from the target repository's AST graph:

```
┌─────────────────────────────────────────────────────────────┐
│                 RAGAS QUALITY BENCHMARK                     │
├──────────────────────┬──────────────────────────────────────┤
│ Metric               │ Score                                │
├──────────────────────┼──────────────────────────────────────┤
│ Faithfulness         │ 86% (Grounded against code context)  │
│ Context Precision    │ 100% (Accurate symbol source files)  │
│ Refusal Accuracy     │ 100% (Anti-hallucination defense)    │
│ Dynamic Test Suite   │ 4 / 4 Passing                        │
└──────────────────────┴──────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### `POST /ingest`
Ingests a GitHub repository and builds the AST graph.
```json
{
  "github_url": "https://github.com/fastapi/fastapi"
}
```

### `POST /ask`
Queries the codebase architecture with conversation history.
```json
{
  "question": "Where is the FastAPI application class defined?",
  "github_url": "https://github.com/fastapi/fastapi",
  "history": [
    { "role": "user", "content": "What is the entrypoint?" }
  ]
}
```

### `GET /graph`
Retrieves nodes and edges formatted for 2D/3D visualization.
```bash
GET /graph?github_url=https://github.com/fastapi/fastapi&layout=layered
```

### `GET /evaluate`
Executes dynamic RAGAS quality evaluation for the target repository.
```bash
GET /evaluate?github_url=https://github.com/fastapi/fastapi
```

---

## 🧪 Local Testing

To run the automated Python test suite locally:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e apps/api
PYTHONPATH=apps/api pytest apps/api/tests/ -v
```

---

## 🔒 Security & Best Practices

- **Zero Secret Leaks**: API keys are strictly loaded via `.env` and environment variables. Secrets are excluded from git via `.gitignore`.
- **Safe Sandboxing**: Cloning and ingestion are handled in isolated workspace directories.

---

## 📄 License
MIT License. Created for high-performance codebase architecture intelligence.