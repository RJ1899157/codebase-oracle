"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Sparkles,
  Send,
  GitBranch,
  Terminal,
  Layers,
  Loader2,
  ExternalLink,
  Code2,
  Check,
  Copy,
  Trash2,
  Box,
  FileCode,
  Zap,
  Gauge,
  HelpCircle,
  X,
  ArrowRight,
} from "lucide-react";

import { CustomCodeNode } from "@/components/CustomCodeNode";

interface Citation {
  file_path: string;
  start_line: number;
  end_line: number;
  github_url?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
  refused?: boolean;
}

const nodeTypes = {
  customCodeNode: CustomCodeNode,
};

const DEMO_REPOSITORIES = [
  { name: "FastAPI", url: "https://github.com/fastapi/fastapi", desc: "Python Async API Framework" },
  { name: "Flask", url: "https://github.com/pallets/flask", desc: "Python WSGI Microframework" },
  { name: "Express", url: "https://github.com/expressjs/express", desc: "Node.js Web Framework" },
  { name: "Tokio", url: "https://github.com/tokio-rs/tokio", desc: "Rust Async Runtime" },
];

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-xs leading-relaxed text-[#c9d1d9]">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="text-xs font-bold text-[#58a6ff] uppercase tracking-wider pt-2 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff]" />
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-bold text-[#f0f6fc] uppercase tracking-wider pt-2.5 font-mono border-b border-[#30363d] pb-1">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={i} className="text-base font-extrabold text-[#f0f6fc] uppercase tracking-wider pt-3 font-mono">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-1 text-[#c9d1d9]">
              <span className="text-[#58a6ff] font-bold mt-0.5">•</span>
              <span>{formatInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={i} className="p-3 rounded bg-[#161b22] border-l-2 border-[#10b981] text-[#8b949e] italic text-[11px]">
              {formatInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }
        if (trimmed.startsWith("```")) {
          return null;
        }
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }
        return <p key={i}>{formatInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function formatInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#79c0ff] font-mono text-[11px] font-medium">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-[#f0f6fc]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function App() {
  const [githubUrl, setGithubUrl] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStats, setIngestStats] = useState<any>(null);

  const [inputQuery, setInputQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>("Detecting LLM...");

  const [layoutMode, setLayoutMode] = useState<"layered" | "radial">("layered");
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const [activeRightTab, setActiveRightTab] = useState<"chat" | "benchmark">("chat");
  const [showHelpGuide, setShowHelpGuide] = useState(true);
  const [evalResult, setEvalResult] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Check LLM status on mount
  useEffect(() => {
    fetch("http://localhost:8000/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.active_model) {
          setActiveModel(data.active_model);
        }
      })
      .catch(() => {
        setActiveModel("Local Graph Engine Active");
      });
  }, []);

  const filterNodes = useCallback(
    (kind: string, query: string, rawNodes: Node[], rawEdges: Edge[]) => {
      let filtered = rawNodes;
      if (kind !== "all") {
        filtered = filtered.filter((n) => (n.data as any)?.kind === kind);
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        filtered = filtered.filter(
          (n) =>
            (n.data as any)?.label?.toLowerCase().includes(q) ||
            (n.data as any)?.file_path?.toLowerCase().includes(q)
        );
      }

      const activeIds = new Set(filtered.map((n) => n.id));
      const filteredEdges = rawEdges.filter(
        (e) => activeIds.has(e.source) && activeIds.has(e.target)
      );

      setNodes(filtered);
      setEdges(filteredEdges);
    },
    [setNodes, setEdges]
  );

  const fetchGraphData = useCallback(
    async (url: string, layout: "layered" | "radial") => {
      try {
        const res = await fetch(
          `http://localhost:8000/graph?github_url=${encodeURIComponent(url)}&layout=${layout}`
        );
        if (res.ok) {
          const data = await res.json();
          setAllNodes(data.nodes || []);
          setAllEdges(data.edges || []);
          filterNodes(selectedKind, searchQuery, data.nodes || [], data.edges || []);
        }
      } catch (err) {
        console.error("Failed to load graph data", err);
      }
    },
    [filterNodes, selectedKind, searchQuery]
  );

  const handleIngest = async (targetUrl?: string) => {
    const urlToIngest = targetUrl || githubUrl;
    if (!urlToIngest.trim()) return;
    setIsIngesting(true);
    try {
      const res = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: urlToIngest }),
      });
      const data = await res.json();
      setIngestStats(data);
      if (targetUrl) setGithubUrl(targetUrl);
      await fetchGraphData(urlToIngest, layoutMode);
    } catch (err) {
      console.error("Ingest failed", err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleLayoutToggle = async (mode: "layered" | "radial") => {
    setLayoutMode(mode);
    if (githubUrl) {
      await fetchGraphData(githubUrl, mode);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    const query = promptOverride || inputQuery;
    if (!query.trim() || isAsking) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    if (!promptOverride) setInputQuery("");
    setIsAsking(true);
    setActiveRightTab("chat");

    try {
      const historyPayload = updatedHistory.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: query,
          github_url: githubUrl || undefined,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "No grounded answer generated.",
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        refused: data.refused,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("Ask query failed", err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Error: Unable to connect to retrieval engine. Ensure the FastAPI backend is running.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!githubUrl) return;
    setIsEvaluating(true);
    setActiveRightTab("benchmark");
    try {
      const res = await fetch(`http://localhost:8000/evaluate?github_url=${encodeURIComponent(githubUrl)}`);
      const data = await res.json();
      setEvalResult(data);
    } catch (err) {
      console.error("Evaluation failed", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node.data);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#0d1117] text-[#f0f6fc] font-sans">
      {/* ========================================================================= */}
      {/* ZONE 1: TOP COMMAND BAR (Linear / Supabase Engineering Style) */}
      {/* ========================================================================= */}
      <header className="h-16 px-5 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between shrink-0 z-30">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-[#10b981]">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#f0f6fc] tracking-tight font-mono">
                Codebase Oracle
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#21262d] text-[#8b949e] border border-[#30363d] font-mono">
                GraphRAG 2.0
              </span>
            </div>
          </div>
        </div>

        {/* Repository Ingest Bar & 1-Click Demo Repositories */}
        <div className="flex flex-col items-center gap-1.5 max-w-2xl w-full mx-6">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <GitBranch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#0d1117] border border-[#30363d] text-xs text-[#f0f6fc] placeholder-[#6e7681] focus:outline-none focus:border-[#3b82f6] font-mono transition"
              />
            </div>
            <button
              onClick={() => handleIngest()}
              disabled={isIngesting || !githubUrl.trim()}
              className="px-3.5 py-1.5 rounded-md bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 transition shrink-0"
            >
              {isIngesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Parsing AST...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  Index Repository
                </>
              )}
            </button>
          </div>

          {/* Quick 1-Click Demo Repositories */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8b949e]">
            <span>Try sample:</span>
            {DEMO_REPOSITORIES.map((repo) => (
              <button
                key={repo.name}
                onClick={() => {
                  setGithubUrl(repo.url);
                  handleIngest(repo.url);
                }}
                className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] hover:text-[#f0f6fc] text-[#c9d1d9] border border-[#30363d] transition"
                title={repo.desc}
              >
                {repo.name}
              </button>
            ))}
          </div>
        </div>

        {/* Telemetry Status & Actions */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#21262d] border border-[#30363d] text-[11px] text-[#c9d1d9]">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span className="truncate max-w-[140px]">{activeModel}</span>
          </div>

          {ingestStats && (
            <div className="hidden xl:flex items-center gap-2 text-[11px] text-[#8b949e]">
              <span className="px-2 py-1 rounded bg-[#21262d] border border-[#30363d]">
                <strong className="text-[#f0f6fc]">{ingestStats.node_count}</strong> nodes
              </span>
              <span className="px-2 py-1 rounded bg-[#21262d] border border-[#30363d]">
                <strong className="text-[#f0f6fc]">{ingestStats.edge_count}</strong> edges
              </span>
            </div>
          )}

          <button
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className="p-1.5 rounded-md hover:bg-[#21262d] text-[#8b949e] hover:text-[#f0f6fc] border border-transparent hover:border-[#30363d] transition"
            title="Toggle Onboarding Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* GUIDED STEP-BY-STEP ONBOARDING BANNER (Easily Accessible) */}
      {/* ========================================================================= */}
      {showHelpGuide && (
        <div className="px-5 py-2 border-b border-[#30363d] bg-[#161b22]/70 flex items-center justify-between text-xs text-[#8b949e] font-mono">
          <div className="flex items-center gap-6">
            <span className="font-bold text-[#c9d1d9] uppercase tracking-wider">Quick Start Guide:</span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${!githubUrl ? "bg-[#3b82f6] text-white" : "bg-[#21262d] text-[#c9d1d9]"}`}>
                Step 1
              </span>
              <span>Paste repo URL & click Index</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#484f58]" />
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${nodes.length > 0 ? "bg-[#3b82f6] text-white" : "bg-[#21262d] text-[#c9d1d9]"}`}>
                Step 2
              </span>
              <span>Filter symbols & explore technical blueprint</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#484f58]" />
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${messages.length > 0 ? "bg-[#3b82f6] text-white" : "bg-[#21262d] text-[#c9d1d9]"}`}>
                Step 3
              </span>
              <span>Ask architectural questions with citations</span>
            </div>
          </div>
          <button
            onClick={() => setShowHelpGuide(false)}
            className="text-[#6e7681] hover:text-[#f0f6fc] text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: SPLIT SCREEN (Graph 65% | AI Studio 35%) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* ======================================================================= */}
        {/* ZONE 2: TECHNICAL BLUEPRINT GRAPH EXPLORER (Left 65%) */}
        {/* ======================================================================= */}
        <section className="flex-1 flex flex-col relative border-r border-[#30363d] bg-[#0d1117]">
          {/* Graph Toolbar: Search, Kind Filter Tabs, Layout Switcher */}
          <div className="h-12 px-4 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between shrink-0 z-10">
            {/* Search Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b949e]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    filterNodes(selectedKind, e.target.value, allNodes, allEdges);
                  }}
                  placeholder="Filter symbols in graph..."
                  className="pl-8 pr-2.5 py-1 rounded bg-[#0d1117] border border-[#30363d] text-xs text-[#f0f6fc] placeholder-[#6e7681] focus:outline-none focus:border-[#3b82f6] w-48 font-mono"
                />
              </div>

              <div className="h-4 w-[1px] bg-[#30363d]" />

              {/* Symbol Kind Filter Tabs */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                {["all", "class", "function", "file"].map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSelectedKind(k);
                      filterNodes(k, searchQuery, allNodes, allEdges);
                    }}
                    className={`px-2.5 py-1 rounded font-medium uppercase transition ${
                      selectedKind === k
                        ? "bg-[#21262d] text-[#f0f6fc] border border-[#484f58]"
                        : "text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]/50"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Mode Switcher */}
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="text-[#6e7681] mr-1">Layout:</span>
              <button
                onClick={() => handleLayoutToggle("layered")}
                className={`px-2.5 py-1 rounded transition ${
                  layoutMode === "layered"
                    ? "bg-[#21262d] text-[#58a6ff] border border-[#30363d] font-semibold"
                    : "text-[#8b949e] hover:text-[#f0f6fc]"
                }`}
              >
                Blueprint Tree
              </button>
              <button
                onClick={() => handleLayoutToggle("radial")}
                className={`px-2.5 py-1 rounded transition ${
                  layoutMode === "radial"
                    ? "bg-[#21262d] text-[#58a6ff] border border-[#30363d] font-semibold"
                    : "text-[#8b949e] hover:text-[#f0f6fc]"
                }`}
              >
                Orbital Galaxy
              </button>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="flex-1 relative">
            {nodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-4 text-[#8b949e]">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-[#f0f6fc] uppercase tracking-wider font-mono">
                  Knowledge Graph Canvas
                </h3>
                <p className="text-xs text-[#8b949e] font-mono max-w-sm mt-1.5 leading-relaxed">
                  Enter any GitHub repository URL in the header or select a sample repository to inspect AST nodes and module relationships.
                </p>
              </div>
            ) : (
              <div className="w-full h-full">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.05}
                  maxZoom={2.5}
                >
                  <Background color="#30363d" gap={24} size={1} />
                  <Controls className="!left-4 !bottom-4" />
                  <MiniMap
                    className="!left-4 !bottom-16 rounded-lg overflow-hidden border border-[#30363d]"
                    nodeColor={(node: any) => {
                      const k = node.data?.kind;
                      if (k === "class") return "#f59e0b";
                      if (k === "function") return "#3b82f6";
                      if (k === "file") return "#10b981";
                      return "#8b949e";
                    }}
                    maskColor="rgba(13, 17, 23, 0.85)"
                  />
                </ReactFlow>
              </div>
            )}

            {/* Bottom Docked Selected Symbol Inspector */}
            {selectedNode && (
              <div className="absolute bottom-4 right-4 z-20 w-96 rounded-lg border border-[#30363d] bg-[#161b22] p-4 shadow-xl font-mono">
                <div className="flex items-start justify-between gap-2 border-b border-[#30363d] pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#21262d] text-[#58a6ff] border border-[#30363d]">
                        {selectedNode.kind || "SYMBOL"}
                      </span>
                      <span className="text-xs font-bold text-[#f0f6fc] truncate max-w-[190px]">
                        {selectedNode.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8b949e] mt-1 truncate" title={selectedNode.file_path}>
                      {selectedNode.file_path}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-[#6e7681] hover:text-[#f0f6fc] p-1 rounded hover:bg-[#21262d]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-[#8b949e]">
                    Lines:{" "}
                    <strong className="text-[#f0f6fc]">
                      {selectedNode.start_line}
                      {selectedNode.end_line && selectedNode.end_line !== selectedNode.start_line
                        ? `–${selectedNode.end_line}`
                        : ""}
                    </strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleSendMessage(
                          undefined,
                          `Explain the implementation and role of \`${selectedNode.label}\` in \`${selectedNode.file_path}\`.`
                        )
                      }
                      className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#58a6ff] text-[10px] font-bold transition"
                    >
                      Explain with AI
                    </button>

                    {githubUrl && selectedNode.file_path && (
                      <a
                        href={`${githubUrl}/blob/main/${selectedNode.file_path}#L${selectedNode.start_line}-L${selectedNode.end_line}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#f0f6fc] text-[10px] font-medium flex items-center gap-1 transition"
                      >
                        GitHub <ExternalLink className="w-3 h-3 text-[#8b949e]" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ======================================================================= */}
        {/* ZONE 3: ARCHITECTURE AI STUDIO (Right 35% Fixed Panel) */}
        {/* ======================================================================= */}
        <aside className="w-[460px] flex flex-col bg-[#161b22] shrink-0">
          {/* Header Tabs: AI Studio vs RAGAS Benchmark */}
          <div className="h-12 px-4 border-b border-[#30363d] flex items-center justify-between shrink-0 font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveRightTab("chat")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeRightTab === "chat"
                    ? "bg-[#21262d] text-[#f0f6fc] border border-[#30363d]"
                    : "text-[#8b949e] hover:text-[#f0f6fc]"
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-[#58a6ff]" />
                Architecture Chat
              </button>

              <button
                onClick={() => {
                  setActiveRightTab("benchmark");
                  if (!evalResult && githubUrl) handleRunEvaluation();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeRightTab === "benchmark"
                    ? "bg-[#21262d] text-[#f0f6fc] border border-[#30363d]"
                    : "text-[#8b949e] hover:text-[#f0f6fc]"
                }`}
              >
                <Gauge className="w-3.5 h-3.5 text-[#10b981]" />
                RAGAS Eval
              </button>
            </div>

            {activeRightTab === "chat" && messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[#8b949e] hover:text-rose-400 flex items-center gap-1 text-[11px] transition px-2 py-1 rounded hover:bg-[#21262d]"
                title="Clear conversation"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* TAB 1: ARCHITECTURE CHAT STUDIO */}
          {activeRightTab === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !isAsking && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#8b949e] px-4 font-mono">
                    <div className="w-12 h-12 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center mb-3 text-[#58a6ff]">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-[#f0f6fc] uppercase tracking-wider">
                      Conversational Codebase Architect
                    </h4>
                    <p className="text-[11px] text-[#8b949e] mt-1 max-w-xs leading-relaxed">
                      Grounded with AST symbols, graph connections, and Groq LLaMA 3.3 70B.
                    </p>

                    {/* Preset Architecture Questions */}
                    <div className="mt-5 flex flex-col gap-2 w-full max-w-xs text-left">
                      {[
                        "What is the main architecture and entrypoint of this repository?",
                        "How is data flow and routing structured across modules?",
                        "What are the core classes, interfaces, and key abstractions?",
                        "Are there any external dependencies or API clients configured?",
                      ].map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(undefined, prompt)}
                          className="text-[11px] text-[#c9d1d9] hover:text-[#f0f6fc] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] px-3 py-2 rounded-md text-left transition font-mono truncate group"
                        >
                          <span className="text-[#58a6ff] mr-1.5 font-bold">→</span> {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages Stream */}
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-2">
                    {msg.role === "user" ? (
                      <div className="flex items-start justify-end">
                        <div className="max-w-[85%] rounded-lg bg-[#21262d] border border-[#30363d] p-3">
                          <p className="text-xs font-mono text-[#f0f6fc] leading-relaxed">{msg.content}</p>
                          <span className="text-[9px] font-mono text-[#8b949e] mt-1 block text-right">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#0d1117] border border-[#30363d] p-3.5">
                        <div className="flex items-center justify-between border-b border-[#30363d] pb-1.5 mb-2 font-mono">
                          <span className="text-[10px] font-bold text-[#58a6ff] uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#58a6ff]" />
                            Codebase Oracle
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="text-[#8b949e] hover:text-[#f0f6fc] text-[10px] flex items-center gap-1 transition"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-[#10b981]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <MarkdownRenderer content={msg.content} />

                        {/* Grounded Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#30363d] font-mono">
                            <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider block mb-1.5">
                              Verified Code Citations:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.citations.map((c, cIdx) => (
                                <a
                                  key={cIdx}
                                  href={c.github_url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-[#58a6ff] text-[10px] text-[#58a6ff] flex items-center gap-1 transition"
                                >
                                  <span>{c.file_path.split("/").pop()}</span>
                                  <span className="text-[#8b949e]">L{c.start_line}–{c.end_line}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-[#8b949e]" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isAsking && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0d1117] border border-[#30363d] text-[#58a6ff] font-mono text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing response with GraphRAG...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#30363d] bg-[#161b22] flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask about this codebase architecture..."
                  className="flex-1 px-3 py-2 rounded-md bg-[#0d1117] border border-[#30363d] text-xs text-[#f0f6fc] placeholder-[#6e7681] focus:outline-none focus:border-[#3b82f6] font-mono"
                />
                <button
                  type="submit"
                  disabled={isAsking || !inputQuery.trim()}
                  className="p-2 rounded-md bg-[#10b981] hover:bg-[#059669] text-white disabled:opacity-40 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: RAGAS QUALITY BENCHMARK */}
          {activeRightTab === "benchmark" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#f0f6fc] uppercase tracking-wider">
                    RAGAS Quality & Faithfulness Benchmark
                  </h4>
                  <p className="text-[10px] text-[#8b949e] mt-0.5">
                    Automated retrieval & synthesis evaluation metrics
                  </p>
                </div>
                <button
                  onClick={handleRunEvaluation}
                  disabled={isEvaluating || !githubUrl}
                  className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#f0f6fc] border border-[#30363d] text-xs font-semibold disabled:opacity-40 transition"
                >
                  {isEvaluating ? "Evaluating..." : "Re-run"}
                </button>
              </div>

              {isEvaluating ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#8b949e]">
                  <Loader2 className="w-6 h-6 text-[#10b981] animate-spin" />
                  <p className="text-xs">Running synthetic RAGAS evaluations...</p>
                </div>
              ) : evalResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-md bg-[#0d1117] border border-[#30363d]">
                      <span className="text-[10px] text-[#8b949e] uppercase">Faithfulness</span>
                      <p className="text-lg font-bold text-[#10b981] mt-1">
                        {Math.round(evalResult.faithfulness_score * 100)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-[#0d1117] border border-[#30363d]">
                      <span className="text-[10px] text-[#8b949e] uppercase">Precision</span>
                      <p className="text-lg font-bold text-[#58a6ff] mt-1">
                        {Math.round(evalResult.context_precision_score * 100)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-[#0d1117] border border-[#30363d]">
                      <span className="text-[10px] text-[#8b949e] uppercase">Refusal Acc</span>
                      <p className="text-lg font-bold text-[#f0f6fc] mt-1">
                        {Math.round(evalResult.negative_refusal_accuracy * 100)}%
                      </p>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-[#f0f6fc] uppercase mb-2">Test Case Results</h5>
                    <div className="space-y-2">
                      {evalResult.detailed_cases?.map((tc: any, i: number) => (
                        <div key={i} className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px] flex items-center justify-between">
                          <span className="text-[#c9d1d9] truncate max-w-[280px]">{tc.question}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tc.passed
                                ? "bg-emerald-950/40 text-[#10b981] border border-emerald-800/40"
                                : "bg-rose-950/40 text-rose-400 border border-rose-800/40"
                            }`}
                          >
                            {tc.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-[#8b949e] text-xs">
                  Index a repository and click &quot;Run Evaluation&quot; to inspect RAGAS precision scores.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}