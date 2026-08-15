"use client";

import React, { useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from "@xyflow/react";
import {
  Search,
  GitBranch,
  ExternalLink,
  Cpu,
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { CustomCodeNode } from "@/components/CustomCodeNode";

const nodeTypes = {
  customCodeNode: CustomCodeNode,
};

const API_BASE = "http://localhost:8000";

export default function App() {
  const [githubUrl, setGithubUrl] = useState("https://github.com/pallets/flask");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStats, setIngestStats] = useState<any>(null);

  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answerData, setAnswerData] = useState<any>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;

    setIsIngesting(true);
    setIngestStats(null);
    setAnswerData(null);

    try {
      // 1. Trigger Ingestion
      const ingestRes = await fetch(`${API_BASE}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: githubUrl }),
      });
      const data = await ingestRes.json();
      setIngestStats(data);

      // 2. Fetch React Flow graph
      const graphRes = await fetch(`${API_BASE}/graph?github_url=${encodeURIComponent(githubUrl)}`);
      const graphData = await graphRes.json();

      if (graphData.nodes) {
        setNodes(graphData.nodes);
        setEdges(graphData.edges);
      }
    } catch (err) {
      console.error("Ingest error:", err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !githubUrl) return;

    setIsAsking(true);
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: githubUrl, question }),
      });
      const data = await res.json();
      setAnswerData(data);
    } catch (err) {
      console.error("Ask error:", err);
    } finally {
      setIsAsking(false);
    }
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-[#0d1322]/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-indigo-500/20 shadow-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Codebase Oracle <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">GraphRAG</span>
            </h1>
          </div>
        </div>

        {/* Repository Ingest Form */}
        <form onSubmit={handleIngest} className="flex items-center gap-2 w-full max-w-xl">
          <div className="relative flex-1">
            <GitBranch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={isIngesting}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-2 shrink-0 transition"
          >
            {isIngesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            {isIngesting ? "Indexing..." : "Index Repo"}
          </button>
        </form>
      </header>

      {/* Stats Bar */}
      {ingestStats && (
        <div className="bg-indigo-950/40 border-b border-indigo-900/40 px-6 py-2 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Repository Ready
            </span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-slate-400" /> {ingestStats.file_count} Files</span>
            <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-purple-400" /> {ingestStats.node_count} Graph Nodes</span>
            <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5 text-blue-400" /> {ingestStats.edge_count} Relationships</span>
            <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-amber-400" /> {ingestStats.chunk_count} Vector Chunks</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: React Flow Graph View */}
        <div className="flex-1 relative h-full bg-[#070a11]">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-center px-4">
              <Layers className="w-12 h-12 stroke-[1.2] mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">Knowledge Graph Viewport</p>
              <p className="text-xs max-w-sm mt-1">
                Enter a GitHub URL above and click Index Repo to parse Python AST, generate Neo4j relationships, and explore the interactive graph.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background color="#1e293b" gap={20} size={1} />
              <Controls className="!bg-slate-900 !border-slate-700 !text-slate-200" />
              <MiniMap
                nodeColor="#6366f1"
                maskColor="rgba(11, 15, 25, 0.7)"
                className="!bg-slate-900 !border-slate-800"
              />
            </ReactFlow>
          )}

          {/* Node Details Floating Modal */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 max-w-sm p-4 rounded-xl bg-slate-900/90 border border-slate-700 backdrop-blur-md shadow-2xl text-xs z-10">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-100 truncate">{selectedNode.label}</span>
                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  {selectedNode.kind}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-slate-400 font-mono text-[11px]">
                <div>File: <span className="text-slate-200">{selectedNode.file_path}</span></div>
                <div>Lines: <span className="text-slate-200">{selectedNode.start_line} - {selectedNode.end_line}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Right: GraphRAG Q&A & Citations Panel */}
        <div className="w-[440px] border-l border-slate-800 bg-[#0d1322] flex flex-col shrink-0 h-full">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-indigo-400" /> Codebase Question Answering
            </h2>
          </div>

          {/* Answers & Chat Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!answerData && !isAsking && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-4">
                <Sparkles className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-medium text-slate-400">Ask any question about the codebase</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Combines Neo4j graph traversal, BM25 keyword matching, and Qdrant vector retrieval with strict grounding.
                </p>
              </div>
            )}

            {isAsking && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-indigo-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                Performing hybrid graph + vector retrieval...
              </div>
            )}

            {answerData && (
              <div className="space-y-4">
                {/* Refusal Alert */}
                {answerData.refused && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-300">Refusal: Insufficient Context</div>
                      <div className="mt-1 text-[11px] opacity-90">{answerData.reason}</div>
                    </div>
                  </div>
                )}

                {/* Grounded Answer */}
                {!answerData.refused && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap shadow-inner">
                    {answerData.answer}
                  </div>
                )}

                {/* Citations List */}
                {answerData.citations && answerData.citations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Grounded Evidence & Citations
                    </div>
                    <div className="space-y-1.5">
                      {answerData.citations.map((cite: any, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition"
                        >
                          <div className="font-mono text-[11px] text-slate-300 truncate max-w-[280px]">
                            {cite.file_path} <span className="text-slate-500">#L{cite.start_line}-L{cite.end_line}</span>
                          </div>
                          {cite.github_url && (
                            <a
                              href={cite.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px] font-semibold"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Question Input Form */}
          <form onSubmit={handleAsk} className="p-4 border-t border-slate-800 bg-[#0d1322]">
            <div className="relative">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Where is authentication handled?"
                className="w-full pl-3 pr-20 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={isAsking || !question}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-40 transition"
              >
                Ask
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}