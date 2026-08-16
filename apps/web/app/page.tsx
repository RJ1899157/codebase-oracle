"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Code2,
  Trash2,
  Send,
  User,
  Bot,
  Sparkles,
  BarChart3,
  Award,
  X,
  Compass,
  Zap,
  Maximize2,
  HelpCircle,
} from "lucide-react";
import { CustomCodeNode } from "@/components/CustomCodeNode";

const API_BASE = "http://localhost:8000";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: any[];
  refused?: boolean;
  reason?: string;
}

// Lightweight Markdown Renderer
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-100">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="text-[13px] font-bold text-white mt-3 pb-1 border-b border-zinc-800">
              {trimmed.replace("### ", "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-extrabold text-cyan-400 mt-4 pb-1 border-b border-zinc-800">
              {trimmed.replace("## ", "")}
            </h3>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-1 text-slate-200">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span>{formatInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={i} className="p-2.5 rounded-lg bg-zinc-900 border-l-2 border-cyan-500 text-zinc-300 italic text-[11px]">
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
        <code key={idx} className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-cyan-300 font-mono text-[11px] font-semibold">
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

  const [layoutMode, setLayoutMode] = useState<"layered" | "radial">("layered");
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Evaluation Benchmark Modal State
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalReport, setEvalReport] = useState<any>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/status`)
      .then((r) => r.json())
      .then((data) => setActiveModel(data.active_model))
      .catch(() => setActiveModel("API Offline"));
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  const nodeTypes = useMemo(() => ({ customCodeNode: CustomCodeNode }), []);

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

  const fetchGraph = async (url: string, layout: string) => {
    try {
      const graphRes = await fetch(
        `${API_BASE}/graph?github_url=${encodeURIComponent(url)}&layout=${layout}`
      );
      const graphData = await graphRes.json();
      if (graphData.nodes && graphData.nodes.length > 0) {
        setAllNodes(graphData.nodes);
        setAllEdges(graphData.edges || []);
        setNodes(graphData.nodes);
        setEdges(graphData.edges || []);
      }
    } catch (err) {
      console.error("Fetch graph error:", err);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;

    setIsIngesting(true);
    setIngestStats(null);
    setMessages([]);
    setSelectedNode(null);

    try {
      const ingestRes = await fetch(`${API_BASE}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: githubUrl }),
      });
      const data = await ingestRes.json();
      setIngestStats(data);
      await fetchGraph(githubUrl, layoutMode);
    } catch (err) {
      console.error("Ingest error:", err);
    } finally {
      setIsIngesting(false);
    }
  };

  const toggleLayout = async (newLayout: "layered" | "radial") => {
    setLayoutMode(newLayout);
    if (githubUrl && ingestStats) {
      await fetchGraph(githubUrl, newLayout);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const query = customText || inputQuery;
    if (!query.trim() || !githubUrl || isAsking) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputQuery("");
    setIsAsking(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          github_url: githubUrl,
          question: query,
          history: historyPayload,
        }),
      });
      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        refused: data.refused,
        reason: data.reason,
      };

      setMessages([...newHistory, assistantMessage]);
    } catch (err) {
      console.error("Ask error:", err);
      setMessages([
        ...newHistory,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Failed to connect to backend server. Please verify API container is running.",
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const runEvalBenchmark = async () => {
    if (!githubUrl || !ingestStats) return;
    setIsRunningEval(true);
    setShowEvalModal(true);
    try {
      const res = await fetch(`${API_BASE}/evaluate?github_url=${encodeURIComponent(githubUrl)}`);
      const data = await res.json();
      setEvalReport(data);
    } catch (err) {
      console.error("Eval error:", err);
    } finally {
      setIsRunningEval(false);
    }
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#000000] text-white overflow-hidden font-sans antialiased selection:bg-cyan-500/40 selection:text-white">
      {/* Top Header - Pure High Contrast Black */}
      <header className="h-16 border-b border-zinc-800 bg-[#000000] px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.3)]">
            <Zap className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wider text-white font-mono uppercase">
                Codebase<span className="text-cyan-400">.Oracle</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-extrabold">
                GraphRAG 2.0
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              AST Knowledge Graph & Deep Semantic Code Retrieval
            </p>
          </div>
        </div>

        {/* Ingest Repository Bar */}
        <form onSubmit={handleIngest} className="flex items-center gap-2.5 w-full max-w-lg">
          <div className="relative flex-1">
            <GitBranch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-[#09090b] border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition"
            />
          </div>
          <button
            type="submit"
            disabled={isIngesting}
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-xs font-extrabold text-black uppercase font-mono tracking-wider disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            {isIngesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            {isIngesting ? "Indexing..." : "Index Repo"}
          </button>
        </form>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Run Eval Button */}
          {ingestStats && (
            <button
              onClick={runEvalBenchmark}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono font-bold transition shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Eval Benchmark</span>
            </button>
          )}

          {/* Model Status Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#09090b] text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff66] animate-pulse" />
            <span className="text-zinc-400 text-[11px]">Model:</span>
            <span className="text-cyan-300 font-bold text-[11px] truncate max-w-[190px]">
              {activeModel}
            </span>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {ingestStats && (
        <div className="bg-[#050508] border-b border-zinc-800 px-6 py-2 flex items-center justify-between text-xs text-zinc-300 shrink-0 z-10 font-mono">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold">
              <CheckCircle2 className="w-4 h-4" /> Ready
            </span>
            <span>
              <b className="text-emerald-400">{ingestStats.file_count}</b> Files
            </span>
            <span>
              <b className="text-amber-400">{ingestStats.node_count}</b> AST Nodes
            </span>
            <span>
              <b className="text-cyan-400">{ingestStats.edge_count}</b> Relationships
            </span>
            <span>
              <b className="text-rose-400">{ingestStats.chunk_count}</b> Embeddings
            </span>
          </div>

          {/* Layout Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#09090b] p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => toggleLayout("layered")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition ${
                layoutMode === "layered"
                  ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Layered Tree
            </button>
            <button
              onClick={() => toggleLayout("radial")}
              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition ${
                layoutMode === "radial"
                  ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Radial Galaxy
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Interactive Knowledge Graph */}
        <div className="flex-1 relative w-full h-full bg-[#000000] min-h-0 min-w-0">
          {/* Node Filters Toolbar */}
          {allNodes.length > 0 && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 bg-[#09090b]/95 border border-zinc-800 backdrop-blur-xl p-2 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.9)]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    filterNodes(selectedKind, e.target.value, allNodes, allEdges);
                  }}
                  placeholder="Search symbols..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-black border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 w-36 font-mono"
                />
              </div>

              <div className="h-5 w-[1px] bg-zinc-800" />

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
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                <Layers className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                Knowledge Graph Viewport
              </p>
              <p className="text-xs max-w-sm mt-1 text-zinc-400 font-mono">
                Index a repository above to parse AST nodes, Neo4j relationships, and explore the interactive graph.
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
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.05}
                maxZoom={2.5}
              >
                <Background color="#18181b" gap={28} size={1} />
                <Controls />
                <MiniMap
                  nodeColor={(node: any) => {
                    const k = node.data?.kind;
                    if (k === "class") return "#ffb700";
                    if (k === "function") return "#00f0ff";
                    if (k === "file") return "#00ff66";
                    return "#ff3366";
                  }}
                  maskColor="rgba(0, 0, 0, 0.9)"
                  className="!bg-[#09090b] !border-zinc-800 !rounded-xl"
                />
              </ReactFlow>
            </div>
          )}

          {/* Interactive Code Inspector Drawer */}
          {selectedNode && (
            <div className="absolute bottom-6 left-6 max-w-md p-4 rounded-2xl bg-[#09090b]/95 border border-cyan-500/40 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.9)] text-xs z-30 font-mono animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-[13px] truncate max-w-[240px]">
                    {selectedNode.label}
                  </span>
                  <span className="uppercase text-[9px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/40">
                    {selectedNode.kind}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2 text-zinc-300 text-[11px]">
                <div>
                  <span className="text-zinc-500">File Path:</span>{" "}
                  <span className="text-emerald-300 font-semibold">{selectedNode.file_path}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Line Range:</span>{" "}
                  <span className="text-white font-bold">
                    L{selectedNode.start_line} – L{selectedNode.end_line}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => handleSendMessage(undefined, `Explain what ${selectedNode.kind} '${selectedNode.label}' in ${selectedNode.file_path} does`)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Explain Symbol
                </button>
                <a
                  href={`${githubUrl}/blob/main/${selectedNode.file_path}#L${selectedNode.start_line}-L${selectedNode.end_line}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-[11px] flex items-center gap-1 transition"
                >
                  GitHub <ExternalLink className="w-3 h-3 text-cyan-400" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right: Architecture Chat Studio */}
        <div className="w-[520px] border-l border-zinc-800 bg-[#000000] flex flex-col shrink-0 h-full z-20">
          <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between bg-[#050508]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-extrabold text-white font-mono uppercase tracking-wider">
                GraphRAG Intelligence Studio
              </h2>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-zinc-400 hover:text-rose-400 flex items-center gap-1 text-[11px] font-mono transition px-2 py-0.5 rounded hover:bg-rose-950/30 border border-transparent"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Chat Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isAsking && (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 px-6">
                <div className="w-14 h-14 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(0,240,255,0.2)]">
                  <Sparkles className="w-7 h-7 text-cyan-400" />
                </div>
                <p className="text-xs font-extrabold text-white uppercase font-mono tracking-wider">
                  Conversational Codebase Architect
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-xs leading-relaxed font-mono">
                  Grounded with Neo4j relations, AST symbols, and Groq LLaMA 3.3 70B. Ask questions or continuous follow-ups.
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
                      className="text-[11px] text-zinc-300 hover:text-white bg-[#09090b] hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 px-3.5 py-2.5 rounded-xl text-left transition font-mono truncate shadow-sm group"
                    >
                      <span className="text-cyan-400 mr-1.5 font-bold group-hover:translate-x-0.5 inline-block transition">→</span> {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Flow */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2 animate-in fade-in duration-200">
                {msg.role === "user" ? (
                  <div className="flex items-start justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-500 text-black px-4 py-2.5 text-xs font-bold shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                      {msg.content}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-cyan-300" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                      {msg.refused ? (
                        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2.5 font-mono shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-amber-300 uppercase">Insufficient Context</div>
                            <div className="mt-0.5 text-[11px] opacity-90">{msg.reason}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-[#09090b] border border-zinc-800 shadow-lg relative group">
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white transition p-1 rounded-md bg-zinc-800 border border-zinc-700"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <MarkdownContent content={msg.content} />
                        </div>
                      )}

                      {/* Code Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="space-y-1.5 font-mono pl-1">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Verified Code Citations
                          </div>
                          <div className="space-y-1">
                            {msg.citations.map((cite: any, i: number) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-lg bg-[#09090b] border border-zinc-800/90 flex items-center justify-between text-xs hover:border-cyan-500/50 transition group"
                              >
                                <div className="font-mono text-[11px] text-zinc-300 truncate max-w-[320px]">
                                  <span className="text-white font-bold">{cite.file_path}</span>{" "}
                                  <span className="text-cyan-400 font-extrabold">
                                    #L{cite.start_line}–L{cite.end_line}
                                  </span>
                                </div>
                                {cite.github_url && (
                                  <a
                                    href={cite.github_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px] font-bold group-hover:underline"
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
                  </div>
                )}
              </div>
            ))}

            {isAsking && (
              <div className="flex items-start gap-2.5 animate-in fade-in duration-150">
                <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="p-3.5 rounded-xl bg-[#09090b] border border-cyan-500/40 flex items-center gap-3 text-xs text-cyan-300 font-mono shadow-[0_0_20px_rgba(0,240,255,0.2)] animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  Synthesizing answer with conversation context...
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Question Input Form */}
          <form onSubmit={handleSendMessage} className="p-3.5 border-t border-zinc-800 bg-[#050508]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask architecture questions or follow-ups..."
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-black border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition"
              />
              <button
                type="submit"
                disabled={isAsking || !inputQuery.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold disabled:opacity-30 transition shadow-[0_0_10px_rgba(0,240,255,0.4)]"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-zinc-500 font-mono">
              <span>Press Enter to send</span>
              <span>Grounded with LLaMA 3.3 70B</span>
            </div>
          </form>
        </div>
      </div>

      {/* RAGAS Evaluation Benchmark Modal */}
      {showEvalModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#09090b] border border-zinc-800 rounded-3xl p-6 shadow-[0_0_60px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white font-mono uppercase">
                    RAGAS Architectural Evaluation
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Automated precision, faithfulness & refusal benchmarks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEvalModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isRunningEval ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                <p className="text-xs font-bold text-white font-mono">
                  Executing Automated Benchmark Suite...
                </p>
                <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Evaluating faithfulness score, context precision, and negative refusal logic.
                </p>
              </div>
            ) : evalReport ? (
              <div className="mt-5 space-y-5">
                {/* Score Meters */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                      {(evalReport.mean_faithfulness * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase font-mono mt-1">
                      Faithfulness
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-2xl font-extrabold text-cyan-400 font-mono">
                      {(evalReport.mean_context_precision * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase font-mono mt-1">
                      Context Precision
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-2xl font-extrabold text-amber-400 font-mono">
                      {(evalReport.refusal_accuracy * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase font-mono mt-1">
                      Refusal Accuracy
                    </div>
                  </div>
                </div>

                {/* Benchmark Case Details */}
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono">
                    Test Case Breakdown ({evalReport.passed_cases}/{evalReport.total_cases} Passed)
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {evalReport.details?.map((detail: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="truncate max-w-[420px] text-zinc-200">
                          {detail.question}
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                          detail.passed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}>
                          {detail.passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowEvalModal(false)}
                className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}