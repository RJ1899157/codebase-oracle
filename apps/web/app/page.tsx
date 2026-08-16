"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import {
  Search,
  Sparkles,
  Send,
  GitBranch,
  Terminal,
  Layers,
  ChevronRight,
  Loader2,
  ExternalLink,
  Code2,
  Check,
  Copy,
  Trash2,
  Activity,
  Box,
  FileCode,
  Zap,
  Gauge,
  Sliders,
  Compass,
  Command,
  Maximize2,
  Minimize2,
  Info,
  X,
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

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-200">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider pt-2 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-extrabold text-white uppercase tracking-wider pt-2.5 font-mono border-b border-white/10 pb-1">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={i} className="text-base font-black text-white uppercase tracking-wider pt-3 font-mono">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-1 text-slate-300">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span>{formatInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={i} className="p-3 rounded-xl bg-cyan-950/20 border-l-2 border-cyan-400 text-cyan-200 italic text-[11px]">
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
        <code key={idx} className="px-1.5 py-0.5 rounded bg-black/50 border border-white/15 text-cyan-300 font-mono text-[11px] font-semibold">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-extrabold text-white">
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

  const [layoutMode, setLayoutMode] = useState<"radial" | "layered">("radial");
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [evalResult, setEvalResult] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);

  // Keyboard shortcut: Cmd + K or Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    async (url: string, layout: "radial" | "layered") => {
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

  const handleIngest = async () => {
    if (!githubUrl.trim()) return;
    setIsIngesting(true);
    try {
      const res = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: githubUrl }),
      });
      const data = await res.json();
      setIngestStats(data);
      await fetchGraphData(githubUrl, layoutMode);
    } catch (err) {
      console.error("Ingest failed", err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleLayoutToggle = async (mode: "radial" | "layered") => {
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
    setShowEvalModal(true);
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#07080d] select-none">
      {/* ========================================================================= */}
      {/* 1. TOP FLOATING COMMAND ISLAND (macOS Native Glass Style) */}
      {/* ========================================================================= */}
      <header className="absolute top-4 inset-x-6 z-40 flex items-center justify-between px-5 py-2.5 rounded-2xl glass-panel shadow-2xl">
        {/* Left: Window Dots & Logo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[1px] shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <div className="w-full h-full bg-[#07080d] rounded-[11px] flex items-center justify-center">
                <Compass className="w-4 h-4 text-cyan-400 animate-pulse-slow" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-wider font-mono uppercase flex items-center gap-1.5">
                Codebase<span className="text-cyan-400 font-extrabold">.</span>Oracle
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Repository Ingest Command Bar */}
        <div className="flex items-center gap-2 max-w-xl w-full mx-4">
          <div className="relative flex-1">
            <GitBranch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition"
            />
          </div>
          <button
            onClick={handleIngest}
            disabled={isIngesting || !githubUrl.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-40 transition shrink-0"
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Parsing AST...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-black" />
                Index Repo
              </>
            )}
          </button>
        </div>

        {/* Right: Telemetry & Actions */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff66] animate-pulse" />
            <span className="truncate max-w-[150px] font-semibold">{activeModel}</span>
          </div>

          {ingestStats && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/5">
                <strong className="text-white">{ingestStats.node_count}</strong> nodes
              </span>
              <span className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/5">
                <strong className="text-white">{ingestStats.edge_count}</strong> rels
              </span>
            </div>
          )}

          {githubUrl && (
            <button
              onClick={handleRunEvaluation}
              className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-extrabold flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(168,85,247,0.2)]"
            >
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              Eval RAGAS
            </button>
          )}

          <button
            onClick={() => setIsCommandOpen(true)}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-400 hover:text-white transition"
            title="Command Palette (Cmd+K)"
          >
            <Command className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. FULL-BLEED KNOWLEDGE GRAPH VIEWPORT */}
      {/* ========================================================================= */}
      <main className="w-full h-full pt-20">
        {/* Floating Filter Island (Top-Left) */}
        {allNodes.length > 0 && (
          <div className="absolute top-24 left-6 z-30 flex items-center gap-2 p-1.5 rounded-2xl glass-panel shadow-2xl">
            {/* Search Symbol */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  filterNodes(selectedKind, e.target.value, allNodes, allEdges);
                }}
                placeholder="Filter symbols..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 w-36 font-mono"
              />
            </div>

            <div className="h-5 w-[1px] bg-white/10" />

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              {["all", "class", "function", "file"].map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setSelectedKind(k);
                    filterNodes(k, searchQuery, allNodes, allEdges);
                  }}
                  className={`px-3 py-1 rounded-xl font-extrabold uppercase tracking-wider transition ${
                    selectedKind === k
                      ? "bg-cyan-400 text-black shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="h-5 w-[1px] bg-white/10" />

            {/* Galaxy Orbit vs Constellation Flow Layout Toggle */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10 text-[11px] font-mono">
              <button
                onClick={() => handleLayoutToggle("radial")}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                  layoutMode === "radial"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Radial Galaxy Subsystem View"
              >
                🌌 Orbit
              </button>
              <button
                onClick={() => handleLayoutToggle("layered")}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                  layoutMode === "layered"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Tiered Architecture Dependency Flow"
              >
                ⚡ Flow
              </button>
            </div>
          </div>
        )}

        {/* Knowledge Graph Render View */}
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-white/15 flex items-center justify-center mb-5 shadow-[0_0_50px_rgba(0,240,255,0.2)] animate-float">
              <Layers className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-widest font-mono">
              Knowledge Graph Canvas
            </h2>
            <p className="text-xs text-zinc-400 font-mono max-w-md mt-2 leading-relaxed">
              Enter any public GitHub repository above to parse AST nodes, generate interactive Neo4j relationships, and explore your codebase galaxy.
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
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.05}
              maxZoom={2.5}
            >
              <Background color="#1e293b" gap={32} size={1} />
              <Controls className="!left-6 !bottom-6" />
              <MiniMap
                className="!right-6 !bottom-6 rounded-2xl overflow-hidden glass-panel"
                nodeColor={(node: any) => {
                  const k = node.data?.kind;
                  if (k === "class") return "#ffb700";
                  if (k === "function") return "#00f0ff";
                  if (k === "file") return "#00ff66";
                  return "#ff3366";
                }}
                maskColor="rgba(7, 8, 13, 0.75)"
              />
            </ReactFlow>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. FLOATING CODE INSPECTOR DRAWER (macOS Slide-Up Card) */}
      {/* ========================================================================= */}
      {selectedNode && (
        <div className="absolute bottom-6 left-24 z-30 w-96 rounded-2xl glass-panel p-4 shadow-2xl animate-in slide-in-from-bottom duration-300 font-mono">
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedNode.kind || "SYMBOL"}
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[190px]">
                  {selectedNode.label}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 truncate" title={selectedNode.file_path}>
                {selectedNode.file_path}
              </p>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.08]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              Lines:{" "}
              <strong className="text-white">
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
                    `Explain the role and implementation of \`${selectedNode.label}\` in \`${selectedNode.file_path}\`.`
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold transition"
              >
                Explain with AI
              </button>

              {githubUrl && selectedNode.file_path && (
                <a
                  href={`${githubUrl}/blob/main/${selectedNode.file_path}#L${selectedNode.start_line}-L${selectedNode.end_line}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-[10px] font-bold flex items-center gap-1 transition"
                >
                  GitHub <ExternalLink className="w-3 h-3 text-cyan-400" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FLOATING AI ARCHITECTURE CHAT STUDIO (Right macOS Glass Panel) */}
      {/* ========================================================================= */}
      <div
        className={`absolute top-24 right-6 bottom-6 z-30 rounded-3xl glass-panel shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
          isChatOpen ? "w-[480px]" : "w-14 h-14 !bottom-auto rounded-2xl"
        }`}
      >
        {/* Chat Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            {isChatOpen && (
              <h3 className="text-xs font-extrabold text-white font-mono uppercase tracking-wider">
                Architecture AI Studio
              </h3>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isChatOpen && messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-zinc-400 hover:text-rose-400 flex items-center gap-1 text-[11px] font-mono transition px-2 py-1 rounded hover:bg-rose-950/30"
                title="Clear conversation"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.08]"
              title={isChatOpen ? "Minimize" : "Expand"}
            >
              {isChatOpen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Chat Messages Container */}
        {isChatOpen && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !isAsking && (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                    <Sparkles className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h4 className="text-xs font-extrabold text-white uppercase font-mono tracking-wider">
                    Conversational Codebase Architect
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed font-mono">
                    Grounded with AST nodes, Neo4j relationships, and Groq LLaMA 3.3 70B.
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
                        className="text-[11px] text-zinc-300 hover:text-white bg-black/40 hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/40 px-3 py-2 rounded-xl text-left transition font-mono truncate shadow-sm group"
                      >
                        <span className="text-cyan-400 mr-1.5 font-bold group-hover:translate-x-0.5 inline-block transition">
                          →
                        </span>{" "}
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation Messages */}
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2 animate-in fade-in duration-200">
                  {msg.role === "user" ? (
                    <div className="flex items-start justify-end gap-2">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 p-3 shadow-md">
                        <p className="text-xs font-mono text-white leading-relaxed">{msg.content}</p>
                        <span className="text-[9px] font-mono text-cyan-300/70 mt-1 block text-right font-semibold">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="flex-1 rounded-2xl rounded-tl-sm bg-black/60 border border-white/10 p-3.5 shadow-md">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                          <span className="text-[10px] font-mono font-extrabold text-cyan-300 uppercase tracking-wider">
                            Codebase Oracle
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="text-zinc-500 hover:text-white text-[10px] flex items-center gap-1 transition font-mono"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <MarkdownRenderer content={msg.content} />

                        {/* Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-white/10">
                            <span className="text-[10px] font-mono font-extrabold text-zinc-400 uppercase tracking-wider block mb-1.5">
                              Verified Code Citations:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.citations.map((c, cIdx) => (
                                <a
                                  key={cIdx}
                                  href={c.github_url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-500/50 text-[10px] font-mono text-cyan-300 flex items-center gap-1 transition"
                                >
                                  <span>{c.file_path.split("/").pop()}</span>
                                  <span className="text-zinc-500">L{c.start_line}–{c.end_line}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-cyan-400" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isAsking && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-black/40 border border-white/10 text-cyan-400 font-mono text-xs animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing response with GraphRAG...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about this codebase architecture..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
              <button
                type="submit"
                disabled={isAsking || !inputQuery.trim()}
                className="p-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black disabled:opacity-40 transition shadow-[0_0_15px_rgba(0,240,255,0.4)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. SPOTLIGHT COMMAND PALETTE MODAL (Cmd + K) */}
      {/* ========================================================================= */}
      {isCommandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl glass-panel p-4 shadow-2xl border border-white/20 font-mono animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Search className="w-4 h-4 text-cyan-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search symbols, run eval, or ask questions..."
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none font-mono"
              />
              <button onClick={() => setIsCommandOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1">
              <button
                onClick={() => {
                  handleLayoutToggle(layoutMode === "radial" ? "layered" : "radial");
                  setIsCommandOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.08] text-left text-xs text-white flex items-center justify-between"
              >
                <span>Switch Layout to {layoutMode === "radial" ? "⚡ Constellation Flow" : "🌌 Galaxy Orbit"}</span>
                <span className="text-[10px] text-zinc-500">Action</span>
              </button>

              <button
                onClick={() => {
                  handleRunEvaluation();
                  setIsCommandOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/[0.08] text-left text-xs text-white flex items-center justify-between"
              >
                <span>Run RAGAS Evaluation Benchmark</span>
                <span className="text-[10px] text-purple-400">Benchmark</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. RAGAS BENCHMARK MODAL */}
      {/* ========================================================================= */}
      {showEvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl glass-panel p-6 shadow-2xl border border-white/20 font-mono animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  RAGAS Quality & Faithfulness Benchmark
                </h3>
              </div>
              <button
                onClick={() => setShowEvalModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isEvaluating ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-xs text-zinc-300">Running synthetic RAGAS evaluations...</p>
              </div>
            ) : evalResult ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-[10px] text-zinc-400 uppercase">Faithfulness</span>
                    <p className="text-xl font-extrabold text-emerald-400 mt-1">
                      {Math.round(evalResult.faithfulness_score * 100)}%
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-[10px] text-zinc-400 uppercase">Context Precision</span>
                    <p className="text-xl font-extrabold text-cyan-400 mt-1">
                      {Math.round(evalResult.context_precision_score * 100)}%
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-[10px] text-zinc-400 uppercase">Refusal Accuracy</span>
                    <p className="text-xl font-extrabold text-purple-400 mt-1">
                      {Math.round(evalResult.negative_refusal_accuracy * 100)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-bold text-white uppercase mb-2">Test Case Results</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {evalResult.detailed_cases?.map((tc: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-[11px] flex items-center justify-between">
                        <span className="text-zinc-300 truncate max-w-sm">{tc.question}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            tc.passed
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {tc.passed ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}