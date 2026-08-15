"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import "@xyflow/react/dist/style.css";
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
  Filter,
  Code,
  Box,
  Copy,
  Check,
} from "lucide-react";
import { CustomCodeNode } from "@/components/CustomCodeNode";

const API_BASE = "http://localhost:8000";

export default function App() {
  const [githubUrl, setGithubUrl] = useState("https://github.com/pallets/flask");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStats, setIngestStats] = useState<any>(null);

  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [answerData, setAnswerData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const nodeTypes = useMemo(
    () => ({
      customCodeNode: CustomCodeNode,
    }),
    []
  );

  const filterNodes = useCallback(
    (kind: string, search: string, sourceNodes: Node[], sourceEdges: Edge[]) => {
      let filtered = sourceNodes;
      if (kind !== "all") {
        filtered = filtered.filter(
          (n) => ((n.data as any)?.kind || "").toLowerCase() === kind
        );
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (n) =>
            ((n.data as any)?.label || "").toLowerCase().includes(q) ||
            ((n.data as any)?.file_path || "").toLowerCase().includes(q)
        );
      }
      setNodes(filtered);
      const activeIds = new Set(filtered.map((n) => n.id));
      setEdges(
        sourceEdges.filter(
          (e) => activeIds.has(e.source) && activeIds.has(e.target)
        )
      );
    },
    [setNodes, setEdges]
  );

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;

    setIsIngesting(true);
    setIngestStats(null);
    setAnswerData(null);

    try {
      const ingestRes = await fetch(`${API_BASE}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: githubUrl }),
      });
      const data = await ingestRes.json();
      setIngestStats(data);

      const graphRes = await fetch(
        `${API_BASE}/graph?github_url=${encodeURIComponent(githubUrl)}`
      );
      const graphData = await graphRes.json();

      if (graphData.nodes && graphData.nodes.length > 0) {
        setAllNodes(graphData.nodes);
        setAllEdges(graphData.edges || []);
        setNodes(graphData.nodes);
        setEdges(graphData.edges || []);
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

  const copyAnswer = () => {
    if (answerData?.answer) {
      navigator.clipboard.writeText(answerData.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070a13] text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0d1322]/90 backdrop-blur px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-indigo-500/25 shadow-lg">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Codebase Oracle{" "}
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                GraphRAG
              </span>
            </h1>
          </div>
        </div>

        {/* Repository Ingest Form */}
        <form onSubmit={handleIngest} className="flex items-center gap-2.5 w-full max-w-xl">
          <div className="relative flex-1">
            <GitBranch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={isIngesting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-2 shrink-0 transition shadow-lg shadow-indigo-600/20"
          >
            {isIngesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            {isIngesting ? "Indexing..." : "Index Repo"}
          </button>
        </form>
      </header>

      {/* Stats Bar */}
      {ingestStats && (
        <div className="bg-indigo-950/30 border-b border-indigo-900/30 px-6 py-2 flex items-center justify-between text-xs text-slate-300 shrink-0 z-10">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Repository Ready
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <FileText className="w-3.5 h-3.5 text-slate-500" /> {ingestStats.file_count} Files
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> {ingestStats.node_count} Graph Nodes
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <GitBranch className="w-3.5 h-3.5 text-blue-400" /> {ingestStats.edge_count} Relationships
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cpu className="w-3.5 h-3.5 text-amber-400" /> {ingestStats.chunk_count} Vector Chunks
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: React Flow Graph View */}
        <div className="flex-1 relative w-full h-full bg-[#070a13] min-h-0 min-w-0">
          {/* Floating Graph Filter & Search Toolbar */}
          {allNodes.length > 0 && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md p-1.5 rounded-xl shadow-2xl">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    filterNodes(selectedKind, e.target.value, allNodes, allEdges);
                  }}
                  placeholder="Filter nodes..."
                  className="pl-8 pr-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36"
                />
              </div>

              <div className="h-4 w-[1px] bg-slate-800" />

              <div className="flex items-center gap-1 text-[11px]">
                {["all", "class", "function", "file"].map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSelectedKind(k);
                      filterNodes(k, searchQuery, allNodes, allEdges);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono capitalize transition ${
                      selectedKind === k
                        ? "bg-indigo-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-center px-4">
              <Layers className="w-12 h-12 stroke-[1.2] mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">Knowledge Graph Viewport</p>
              <p className="text-xs max-w-sm mt-1">
                Enter a GitHub URL above and click Index Repo to parse Python AST, generate Neo4j relationships, and explore the interactive graph.
              </p>
            </div>
          ) : (
            <div style={{ width: "100%", height: "100%" }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                minZoom={0.05}
                maxZoom={2.5}
              >
                <Background color="#1e293b" gap={28} size={1} />
                <Controls />
                <MiniMap
                  nodeColor={(node: any) => {
                    const k = node.data?.kind;
                    if (k === "class") return "#a855f7";
                    if (k === "function") return "#3b82f6";
                    if (k === "file") return "#10b981";
                    return "#6366f1";
                  }}
                  maskColor="rgba(7, 10, 19, 0.8)"
                  className="!bg-slate-900 !border-slate-800"
                />
              </ReactFlow>
            </div>
          )}

          {/* Node Details Floating Modal */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 max-w-sm p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl shadow-2xl text-xs z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-100 truncate max-w-[200px] font-mono">
                  {selectedNode.label}
                </span>
                <span className="uppercase text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                  {selectedNode.kind}
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5 text-slate-400 font-mono text-[11px]">
                <div>
                  File: <span className="text-slate-200">{selectedNode.file_path}</span>
                </div>
                <div>
                  Lines:{" "}
                  <span className="text-slate-200">
                    {selectedNode.start_line} - {selectedNode.end_line}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: GraphRAG Q&A & Citations Panel */}
        <div className="w-[480px] border-l border-slate-800/80 bg-[#0d1322] flex flex-col shrink-0 h-full z-20">
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-indigo-400" /> GraphRAG Question Answering
            </h2>
            {answerData && !answerData.refused && (
              <button
                onClick={copyAnswer}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px] font-mono transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>

          {/* Answers & Chat Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!answerData && !isAsking && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-xs font-medium text-slate-300">Ask any architectural question</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Traverses Neo4j relationships and Qdrant code embeddings with LLaMA 3.3 70B strict grounding.
                </p>
              </div>
            )}

            {isAsking && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-indigo-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                Retrieving graph structure & synthesizing grounded answer...
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
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap shadow-inner font-sans">
                    {answerData.answer}
                  </div>
                )}

                {/* Citations List */}
                {answerData.citations && answerData.citations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Grounded Evidence & Citations
                    </div>
                    <div className="space-y-1.5">
                      {answerData.citations.map((cite: any, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between text-xs hover:border-slate-700 transition"
                        >
                          <div className="font-mono text-[11px] text-slate-300 truncate max-w-[300px]">
                            {cite.file_path}{" "}
                            <span className="text-slate-500">
                              #L{cite.start_line}-L{cite.end_line}
                            </span>
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
          <form onSubmit={handleAsk} className="p-4 border-t border-slate-800/80 bg-[#0d1322]">
            <div className="relative">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Where is the Flask class defined?"
                className="w-full pl-3.5 pr-20 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
              />
              <button
                type="submit"
                disabled={isAsking || !question}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-40 transition shadow-md shadow-indigo-600/30"
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