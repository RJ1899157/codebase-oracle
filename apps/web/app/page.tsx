"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
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
  Gauge,
  HelpCircle,
  X,
  ArrowRight,
  Zap,
  CheckCircle2,
  XCircle,
  Box,
  Orbit,
  Network,
} from "lucide-react";

import { CustomCodeNode } from "@/components/CustomCodeNode";

// Dynamic client-side import for 3D Three.js Graph
const CodeGraph3D = dynamic(() => import("@/components/CodeGraph3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#000000] text-[#8b949e] font-mono text-xs gap-3">
      <Loader2 className="w-6 h-6 text-[#58a6ff] animate-spin" />
      <span>Initializing WebGL 3D Cosmos Engine...</span>
    </div>
  ),
});

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEMO_REPOSITORIES = [
  { name: "FastAPI", url: "https://github.com/fastapi/fastapi" },
  { name: "Flask", url: "https://github.com/pallets/flask" },
  { name: "Express", url: "https://github.com/expressjs/express" },
  { name: "Tokio", url: "https://github.com/tokio-rs/tokio" },
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
            <h3 key={i} className="text-sm font-semibold text-[#f0f6fc] uppercase tracking-wider pt-2.5 font-mono border-b border-[#222222] pb-1">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={i} className="text-base font-bold text-[#f0f6fc] uppercase tracking-wider pt-3 font-mono">
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
            <blockquote key={i} className="p-2.5 rounded bg-[#111111] border-l-2 border-[#58a6ff] text-[#8b949e] italic text-[11px]">
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
        <code key={idx} className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#27272a] text-[#58a6ff] font-mono text-[11px] font-medium">
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

  const [layoutMode, setLayoutMode] = useState<"layered" | "radial" | "3d">("layered");
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const [activeRightTab, setActiveRightTab] = useState<"chat" | "benchmark">("chat");
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [evalResult, setEvalResult] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat container to newest question and assistant response
  useEffect(() => {
    if (activeRightTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAsking, activeRightTab]);

  // Check LLM status on mount with auto-retry for cloud backend wake-up
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const checkStatus = () => {
      fetch(`${API_BASE}/status`)
        .then((res) => res.json())
        .then((data) => {
          if (data.active_model) {
            setActiveModel(data.active_model);
          }
        })
        .catch(() => {
          setActiveModel("Connecting to Backend...");
          timer = setTimeout(checkStatus, 4000);
        });
    };
    checkStatus();
    return () => clearTimeout(timer);
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: allNodes.length, class: 0, function: 0, file: 0 };
    allNodes.forEach((n) => {
      const k = (n.data as any)?.kind;
      if (k === "class" || k === "interface" || k === "struct") counts.class++;
      else if (k === "function") counts.function++;
      else if (k === "file" || k === "module") counts.file++;
    });
    return counts;
  }, [allNodes]);

  const filterNodes = useCallback(
    (kind: string, query: string, rawNodes: Node[], rawEdges: Edge[]) => {
      let filtered = rawNodes;
      if (kind !== "all") {
        if (kind === "class") {
          filtered = filtered.filter((n) => ["class", "interface", "struct"].includes((n.data as any)?.kind));
        } else if (kind === "file") {
          filtered = filtered.filter((n) => ["file", "module"].includes((n.data as any)?.kind));
        } else {
          filtered = filtered.filter((n) => (n.data as any)?.kind === kind);
        }
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
    async (url: string, layout: "layered" | "radial" | "3d") => {
      try {
        const fetchLayout = layout === "3d" ? "radial" : layout;
        const res = await fetch(
          `${API_BASE}/graph?github_url=${encodeURIComponent(url)}&layout=${fetchLayout}`
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
      const res = await fetch(`${API_BASE}/ingest`, {
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

  const handleLayoutToggle = async (mode: "layered" | "radial" | "3d") => {
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

      const res = await fetch(`${API_BASE}/ask`, {
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
    const targetUrl = githubUrl || "https://github.com/fastapi/fastapi";
    if (!githubUrl) setGithubUrl(targetUrl);
    setIsEvaluating(true);
    setActiveRightTab("benchmark");
    try {
      // Ensure graph is loaded if empty
      if (!allNodes || allNodes.length === 0) {
        await handleIngest(targetUrl);
      }
      const res = await fetch(`${API_BASE}/evaluate?github_url=${encodeURIComponent(targetUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setEvalResult(data);
      } else {
        // Fallback: ingest explicitly and re-run evaluation
        await handleIngest(targetUrl);
        const retryRes = await fetch(`${API_BASE}/evaluate?github_url=${encodeURIComponent(targetUrl)}`);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          setEvalResult(retryData);
        }
      }
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

  // Convert React Flow nodes for 3D component
  const nodesFor3D = useMemo(() => {
    return nodes.map((n) => ({
      id: n.id,
      data: {
        id: n.id,
        label: (n.data as any)?.label || n.id,
        kind: (n.data as any)?.kind || "symbol",
        file_path: (n.data as any)?.file_path,
        start_line: (n.data as any)?.start_line,
        end_line: (n.data as any)?.end_line,
      },
    }));
  }, [nodes]);

  const edgesFor3D = useMemo(() => {
    return edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: (e.data as any)?.label || "",
    }));
  }, [edges]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#000000] text-[#c9d1d9] font-sans">
      {/* ========================================================================= */}
      {/* ZONE 1: JET BLACK COMMAND HEADER (Solid 56px Bar) */}
      {/* ========================================================================= */}
      <header className="h-14 px-5 border-b border-[#222222] bg-[#0a0a0a] flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#161616] border border-[#27272a] text-[#58a6ff] flex items-center justify-center font-black text-xs">
            ▲
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#f0f6fc] tracking-tight font-mono">
              Codebase Oracle
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#161616] text-[#8b949e] border border-[#27272a] font-mono">
              GraphRAG 2.0
            </span>
          </div>
        </div>

        {/* Center: Ingest Search Bar & Quick Sample Buttons */}
        <div className="flex items-center gap-2 max-w-2xl w-full mx-4">
          <div className="relative flex-1">
            <GitBranch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#000000] border border-[#27272a] text-xs text-[#c9d1d9] placeholder-[#52525b] focus:outline-none focus:border-[#58a6ff] font-mono transition"
            />
          </div>
          <button
            onClick={() => handleIngest()}
            disabled={isIngesting || !githubUrl.trim()}
            className="px-3.5 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white font-medium text-xs flex items-center gap-1.5 disabled:opacity-40 transition shrink-0"
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Parsing AST...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Index Repo
              </>
            )}
          </button>

          {/* Quick Demo Repositories */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-[#8b949e] ml-1">
            {DEMO_REPOSITORIES.map((repo) => (
              <button
                key={repo.name}
                onClick={() => {
                  setGithubUrl(repo.url);
                  handleIngest(repo.url);
                }}
                className="px-2 py-1 rounded bg-[#161616] hover:bg-[#222222] hover:text-[#f0f6fc] text-[#c9d1d9] border border-[#27272a] transition"
              >
                {repo.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Telemetry Status & Actions */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111111] border border-[#222222] text-[11px] text-[#8b949e]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
            <span className="truncate max-w-[140px] text-[#c9d1d9] font-medium">{activeModel}</span>
          </div>

          {ingestStats && (
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-[#8b949e]">
              <span className="px-2 py-1 rounded bg-[#111111] border border-[#222222]">
                <strong className="text-[#f0f6fc]">{ingestStats.node_count}</strong> nodes
              </span>
              <span className="px-2 py-1 rounded bg-[#111111] border border-[#222222]">
                <strong className="text-[#f0f6fc]">{ingestStats.edge_count}</strong> rels
              </span>
            </div>
          )}

          <button
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            className="p-1.5 rounded-md hover:bg-[#161616] text-[#8b949e] hover:text-[#c9d1d9] border border-transparent hover:border-[#27272a] transition"
            title="Toggle Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* GUIDED ONBOARDING BANNER (TOGGLEABLE) */}
      {/* ========================================================================= */}
      {showHelpGuide && (
        <div className="px-5 py-2 border-b border-[#222222] bg-[#0a0a0a] flex items-center justify-between text-xs text-[#8b949e] font-mono">
          <div className="flex items-center gap-5">
            <span className="font-semibold text-[#f0f6fc] uppercase tracking-wider">Guide:</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#161616] border border-[#27272a] text-[#58a6ff]">1</span>
              <span>Paste repo URL or click sample</span>
            </div>
            <ArrowRight className="w-3 h-3 text-[#52525b]" />
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#161616] border border-[#27272a] text-[#8b949e]">2</span>
              <span>Filter symbols & explore in 2D or 3D Cosmos</span>
            </div>
            <ArrowRight className="w-3 h-3 text-[#52525b]" />
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#161616] border border-[#27272a] text-[#8b949e]">3</span>
              <span>Ask architectural queries with verified citations</span>
            </div>
          </div>
          <button
            onClick={() => setShowHelpGuide(false)}
            className="text-[#8b949e] hover:text-[#c9d1d9] text-[11px]"
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
        {/* ZONE 2: KNOWLEDGE GRAPH EXPLORER (2D / 3D COSMOS) (Left 65%) */}
        {/* ======================================================================= */}
        <section className="flex-1 flex flex-col relative border-r border-[#222222] bg-[#000000]">
          {/* Graph Toolbar: Search, Kind Filter Tabs with Counts, 2D/3D Mode Switcher */}
          <div className="h-11 px-4 border-b border-[#222222] bg-[#0a0a0a] flex items-center justify-between shrink-0 z-10">
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
                  placeholder="Filter symbols..."
                  className="pl-8 pr-2.5 py-1 rounded bg-[#000000] border border-[#27272a] text-xs text-[#c9d1d9] placeholder-[#52525b] focus:outline-none focus:border-[#58a6ff] w-44 font-mono"
                />
              </div>

              <div className="h-4 w-[1px] bg-[#222222]" />

              {/* Symbol Kind Filter Tabs with Counts */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                {[
                  { id: "all", label: "ALL", count: categoryCounts.all },
                  { id: "class", label: "CLASS", count: categoryCounts.class },
                  { id: "function", label: "FUNCTION", count: categoryCounts.function },
                  { id: "file", label: "FILE", count: categoryCounts.file },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSelectedKind(tab.id);
                      filterNodes(tab.id, searchQuery, allNodes, allEdges);
                    }}
                    className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1.5 ${
                      selectedKind === tab.id
                        ? "bg-[#161616] text-[#58a6ff] border border-[#27272a]"
                        : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161616]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded ${
                          selectedKind === tab.id ? "bg-[#222222] text-[#58a6ff]" : "bg-[#161616] text-[#8b949e]"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2D / 3D Layout Mode Switcher */}
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="text-[#8b949e] mr-1">View:</span>
              <button
                onClick={() => handleLayoutToggle("layered")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  layoutMode === "layered"
                    ? "bg-[#161616] text-[#58a6ff] border border-[#27272a] font-semibold"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
                <Network className="w-3 h-3" />
                <span>2D Tree</span>
              </button>

              <button
                onClick={() => handleLayoutToggle("radial")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  layoutMode === "radial"
                    ? "bg-[#161616] text-[#58a6ff] border border-[#27272a] font-semibold"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
                <Orbit className="w-3 h-3" />
                <span>2D Galaxy</span>
              </button>

              <button
                onClick={() => handleLayoutToggle("3d")}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  layoutMode === "3d"
                    ? "bg-[#161616] text-[#3fb950] border border-[#3fb950]/30 font-semibold"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
                <Box className="w-3 h-3" />
                <span>3D Cosmos</span>
              </button>
            </div>
          </div>

          {/* Canvas Viewport (2D React Flow OR 3D Three.js) */}
          <div className="flex-1 relative">
            {nodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-xl bg-[#0a0a0a] border border-[#222222] flex items-center justify-center mb-4 text-[#8b949e]">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-[#f0f6fc] uppercase tracking-wider font-mono">
                  Knowledge Graph Canvas
                </h3>
                <p className="text-xs text-[#8b949e] font-mono max-w-sm mt-1.5 leading-relaxed">
                  Enter any GitHub repository URL in the header or select a sample repository to inspect AST nodes and module relationships in 2D or 3D Cosmos.
                </p>
              </div>
            ) : layoutMode === "3d" ? (
              <CodeGraph3D
                nodes={nodesFor3D}
                edges={edgesFor3D}
                onNodeSelect={(nodeData) => setSelectedNode(nodeData)}
                selectedNodeId={selectedNode?.id}
              />
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
                  <Background color="#1f1f1f" gap={24} size={1} />
                  <Controls className="!left-4 !bottom-4" />
                  <MiniMap
                    bgColor="#0a0a0a"
                    maskColor="rgba(0, 0, 0, 0.85)"
                    style={{
                      backgroundColor: "#0a0a0a",
                      border: "1px solid #222222",
                      borderRadius: "8px",
                      width: 180,
                      height: 110,
                    }}
                    nodeColor={(node: any) => {
                      const k = node.data?.kind;
                      if (k === "class" || k === "interface" || k === "struct") return "#d29922";
                      if (k === "function") return "#58a6ff";
                      if (k === "file" || k === "module") return "#3fb950";
                      return "#8b949e";
                    }}
                  />
                </ReactFlow>
              </div>
            )}

            {/* Bottom Docked Selected Symbol Inspector */}
            {selectedNode && (
              <div className="absolute bottom-4 right-4 z-20 w-96 rounded-lg border border-[#222222] bg-[#0a0a0a]/95 backdrop-blur-md p-4 shadow-2xl font-mono">
                <div className="flex items-start justify-between gap-2 border-b border-[#1f1f1f] pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#161616] text-[#58a6ff] border border-[#27272a]">
                        {selectedNode.kind || "SYMBOL"}
                      </span>
                      <span className="text-xs font-semibold text-[#f0f6fc] truncate max-w-[190px]">
                        {selectedNode.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8b949e] mt-1 truncate" title={selectedNode.file_path}>
                      {selectedNode.file_path}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-[#8b949e] hover:text-[#c9d1d9] p-1 rounded hover:bg-[#161616]"
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
                      className="px-2.5 py-1 rounded bg-[#161616] hover:bg-[#222222] border border-[#27272a] text-[#58a6ff] text-[10px] font-semibold transition"
                    >
                      Explain with AI
                    </button>

                    {githubUrl && selectedNode.file_path && (
                      <a
                        href={`${githubUrl}/blob/main/${selectedNode.file_path}#L${selectedNode.start_line}-L${selectedNode.end_line}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-[#161616] hover:bg-[#222222] border border-[#27272a] text-[#c9d1d9] text-[10px] font-medium flex items-center gap-1 transition"
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
        <aside className="w-[460px] flex flex-col bg-[#0a0a0a] shrink-0">
          {/* Header Tabs: AI Studio vs RAGAS Benchmark */}
          <div className="h-11 px-4 border-b border-[#222222] flex items-center justify-between shrink-0 font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveRightTab("chat")}
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeRightTab === "chat"
                    ? "bg-[#161616] text-[#58a6ff] border border-[#27272a]"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
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
                className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeRightTab === "benchmark"
                    ? "bg-[#161616] text-[#3fb950] border border-[#27272a]"
                    : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
                <Gauge className="w-3.5 h-3.5 text-[#3fb950]" />
                RAGAS Eval
              </button>
            </div>

            {activeRightTab === "chat" && messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[#8b949e] hover:text-rose-400 flex items-center gap-1 text-[11px] transition px-2 py-1 rounded hover:bg-[#161616]"
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
                    <div className="w-12 h-12 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-center mb-3 text-[#58a6ff]">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider">
                      Conversational Codebase Architect
                    </h4>
                    <p className="text-[11px] text-[#8b949e] mt-1 max-w-xs leading-relaxed">
                      Grounded with AST symbols, graph relationships, and Groq LLaMA 3.3 70B.
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
                          className="text-[11px] text-[#c9d1d9] hover:text-[#f0f6fc] bg-[#111111] hover:bg-[#161616] border border-[#222222] hover:border-[#333333] px-3 py-2 rounded-md text-left transition font-mono truncate group"
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
                        <div className="max-w-[85%] rounded-lg bg-[#161616] border border-[#27272a] p-3">
                          <p className="text-xs font-mono text-[#f0f6fc] leading-relaxed">{msg.content}</p>
                          <span className="text-[9px] font-mono text-[#8b949e] mt-1 block text-right">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#000000] border border-[#222222] p-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-1.5 mb-2 font-mono">
                          <span className="text-[10px] font-semibold text-[#58a6ff] uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#58a6ff]" />
                            Codebase Oracle
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="text-[#8b949e] hover:text-[#c9d1d9] text-[10px] flex items-center gap-1 transition"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-[#3fb950]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <MarkdownRenderer content={msg.content} />

                        {/* Grounded Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-[#1f1f1f] font-mono">
                            <span className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider block mb-1.5">
                              Verified Code Citations:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.citations.map((c, cIdx) => (
                                <a
                                  key={cIdx}
                                  href={c.github_url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded bg-[#111111] hover:bg-[#161616] border border-[#222222] hover:border-[#58a6ff] text-[10px] text-[#58a6ff] flex items-center gap-1 transition"
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
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-[#000000] border border-[#222222] text-[#58a6ff] font-mono text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing response with GraphRAG...</span>
                  </div>
                )}
                <div ref={chatBottomRef} className="h-1 shrink-0" />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#222222] bg-[#0a0a0a] flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask about this codebase architecture..."
                  className="flex-1 px-3 py-2 rounded-md bg-[#000000] border border-[#27272a] text-xs text-[#c9d1d9] placeholder-[#52525b] focus:outline-none focus:border-[#58a6ff] font-mono"
                />
                <button
                  type="submit"
                  disabled={isAsking || !inputQuery.trim()}
                  className="px-3.5 py-2 rounded-md bg-[#161616] hover:bg-[#222222] border border-[#27272a] text-[#58a6ff] font-semibold text-xs disabled:opacity-40 transition flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: RAGAS QUALITY BENCHMARK */}
          {activeRightTab === "benchmark" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider">
                    RAGAS Quality & Faithfulness Benchmark
                  </h4>
                  <p className="text-[10px] text-[#8b949e] mt-0.5">
                    Dynamic repository retrieval and anti-hallucination evaluation
                  </p>
                </div>
                <button
                  onClick={handleRunEvaluation}
                  disabled={isEvaluating || !githubUrl}
                  className="px-3 py-1.5 rounded-md bg-[#161616] hover:bg-[#222222] border border-[#27272a] text-[#3fb950] text-xs font-semibold disabled:opacity-40 transition flex items-center gap-1.5"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Run Benchmark
                    </>
                  )}
                </button>
              </div>

              {isEvaluating ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#8b949e]">
                  <Loader2 className="w-6 h-6 text-[#58a6ff] animate-spin" />
                  <p className="text-xs">Running dynamic RAGAS test suite...</p>
                </div>
              ) : evalResult && evalResult.mean_faithfulness !== undefined ? (
                <div className="space-y-4">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg bg-[#000000] border border-[#222222]">
                      <span className="text-[10px] text-[#8b949e] uppercase font-semibold tracking-wider">Faithfulness</span>
                      <p className="text-xl font-bold text-[#3fb950] mt-1">
                        {Math.round(evalResult.mean_faithfulness * 100)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#000000] border border-[#222222]">
                      <span className="text-[10px] text-[#8b949e] uppercase font-semibold tracking-wider">Precision</span>
                      <p className="text-xl font-bold text-[#58a6ff] mt-1">
                        {Math.round(evalResult.mean_context_precision * 100)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#000000] border border-[#222222]">
                      <span className="text-[10px] text-[#8b949e] uppercase font-semibold tracking-wider">Refusal Acc</span>
                      <p className="text-xl font-bold text-[#f0f6fc] mt-1">
                        {Math.round(evalResult.refusal_accuracy * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Benchmark Cases List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold text-[#f0f6fc] uppercase tracking-wider">Dynamic Test Cases</h5>
                      <span className="text-[10px] text-[#8b949e]">
                        Passed {evalResult.passed_cases}/{evalResult.total_cases}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {evalResult.details?.map((tc: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-[#000000] border border-[#222222] hover:border-[#333333] transition space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-[#f0f6fc] font-medium leading-snug">{tc.question}</p>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 flex items-center gap-1 ${
                                tc.passed
                                  ? "bg-[#238636]/20 text-[#3fb950] border border-[#3fb950]/30"
                                  : "bg-rose-950/40 text-rose-400 border border-rose-800/40"
                              }`}
                            >
                              {tc.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {tc.passed ? "PASS" : "FAIL"}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-[10px] text-[#8b949e] pt-1 border-t border-[#18181b]">
                            <span>Faithfulness: <strong className="text-[#f0f6fc]">{Math.round(tc.faithfulness * 100)}%</strong></span>
                            <span>Precision: <strong className="text-[#f0f6fc]">{Math.round(tc.precision * 100)}%</strong></span>
                            <span>Refusal: <strong className="text-[#f0f6fc]">{tc.refusal_accurate ? "Accurate" : "Mismatch"}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-[#8b949e] text-xs">
                  Index any repository above and click &quot;Run Benchmark&quot; to test grounded retrieval & anti-hallucination accuracy.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}