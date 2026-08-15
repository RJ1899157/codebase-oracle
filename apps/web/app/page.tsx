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

// Lightweight Markdown Renderer for clean engineering display
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-200">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="text-[13px] font-bold text-white mt-3 pb-1 border-b border-slate-800">
              {trimmed.replace("### ", "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-bold text-white mt-4 pb-1 border-b border-slate-800">
              {trimmed.replace("## ", "")}
            </h3>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-1 text-slate-300">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>{formatInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={i} className="p-2.5 rounded bg-slate-900/80 border-l-2 border-indigo-500 text-slate-300 italic text-[11px]">
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
        <code key={idx} className="px-1.5 py-0.5 rounded bg-[#161c28] border border-slate-700/60 text-indigo-300 font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function App() {
  const [githubUrl, setGithubUrl] = useState("https://github.com/pallets/flask");
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStats, setIngestStats] = useState<any>(null);

  const [inputQuery, setInputQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>("Detecting LLM...");

  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

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

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;

    setIsIngesting(true);
    setIngestStats(null);
    setMessages([]);

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
      // Build previous conversation turns for backend
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
          content: "Failed to connect to backend server. Please verify the API container is running.",
        },
      ]);
    } finally {
      setIsAsking(false);
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

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0c1017] px-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-white font-mono">
              codebase-oracle
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              GraphRAG 2.0
            </span>
          </div>
        </div>

        {/* Ingest Repository Bar */}
        <form onSubmit={handleIngest} className="flex items-center gap-2 w-full max-w-lg">
          <div className="relative flex-1">
            <GitBranch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#070a0f] border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
            />
          </div>
          <button
            type="submit"
            disabled={isIngesting}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition"
          >
            {isIngesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
            {isIngesting ? "Indexing..." : "Index Repo"}
          </button>
        </form>

        {/* Active Engine Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-800 bg-[#070a0f] text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400 text-[11px]">Model:</span>
          <span className="text-indigo-300 font-semibold text-[11px] truncate max-w-[200px]">
            {activeModel}
          </span>
        </div>
      </header>

      {/* Stats Bar */}
      {ingestStats && (
        <div className="bg-[#0a0e17] border-b border-slate-800 px-5 py-1.5 flex items-center justify-between text-xs text-slate-400 shrink-0 z-10 font-mono">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
            </span>
            <span>
              <b className="text-slate-200">{ingestStats.file_count}</b> Files
            </span>
            <span>
              <b className="text-slate-200">{ingestStats.node_count}</b> AST Nodes
            </span>
            <span>
              <b className="text-slate-200">{ingestStats.edge_count}</b> Relationships
            </span>
            <span>
              <b className="text-slate-200">{ingestStats.chunk_count}</b> Code Chunks
            </span>
          </div>
        </div>
      )}

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Architecture Graph Viewport */}
        <div className="flex-1 relative w-full h-full bg-[#05070c] min-h-0 min-w-0">
          {/* Node Filters Toolbar */}
          {allNodes.length > 0 && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#0c1017]/95 border border-slate-800 backdrop-blur-md p-1 rounded-lg shadow-md">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    filterNodes(selectedKind, e.target.value, allNodes, allEdges);
                  }}
                  placeholder="Filter symbols..."
                  className="pl-6 pr-2 py-1 rounded bg-[#07090e] border border-slate-800 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 font-mono"
                />
              </div>

              <div className="h-4 w-[1px] bg-slate-800" />

              <div className="flex items-center gap-0.5 text-[11px] font-mono">
                {["all", "class", "function", "file"].map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSelectedKind(k);
                      filterNodes(k, searchQuery, allNodes, allEdges);
                    }}
                    className={`px-2 py-0.5 rounded capitalize transition ${
                      selectedKind === k
                        ? "bg-indigo-600 text-white font-medium"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
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
              <Layers className="w-10 h-10 stroke-[1.2] mb-2 text-slate-600" />
              <p className="text-xs font-semibold text-slate-300 font-mono">
                Repository Architecture Graph
              </p>
              <p className="text-[11px] max-w-sm mt-0.5 text-slate-500">
                Index a repository to parse Abstract Syntax Trees and explore interactive relationships.
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
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.1}
                maxZoom={2}
              >
                <Background color="#1e2433" gap={24} size={1} />
                <Controls />
                <MiniMap
                  nodeColor={(node: any) => {
                    const k = node.data?.kind;
                    if (k === "class") return "#a855f7";
                    if (k === "function") return "#38bdf8";
                    if (k === "file") return "#34d399";
                    return "#64748b";
                  }}
                  maskColor="rgba(5, 7, 12, 0.85)"
                  className="!bg-[#0c1017] !border-slate-800 !rounded-lg"
                />
              </ReactFlow>
            </div>
          )}

          {/* Node Details Card */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 max-w-sm p-3.5 rounded-xl bg-[#0c1017]/95 border border-slate-700/80 backdrop-blur-xl shadow-xl text-xs z-30 font-mono">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-white truncate max-w-[200px]">
                  {selectedNode.label}
                </span>
                <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  {selectedNode.kind}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-slate-400 text-[11px]">
                <div>
                  <span className="text-slate-500">Path:</span>{" "}
                  <span className="text-slate-200">{selectedNode.file_path}</span>
                </div>
                <div>
                  <span className="text-slate-500">Lines:</span>{" "}
                  <span className="text-slate-200">
                    {selectedNode.start_line} - {selectedNode.end_line}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Multi-Turn Conversation Q&A Studio */}
        <div className="w-[500px] border-l border-slate-800 bg-[#090c13] flex flex-col shrink-0 h-full z-20">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0c1017]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <h2 className="text-xs font-semibold text-slate-300 font-mono">
                Architecture Chat Studio
              </h2>
              {messages.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                  {messages.length} messages
                </span>
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-slate-400 hover:text-rose-300 flex items-center gap-1 text-[11px] font-mono transition px-2 py-0.5 rounded hover:bg-rose-950/30 hover:border-rose-900/50 border border-transparent"
                title="Clear conversation history"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isAsking && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-6">
                <Terminal className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-medium text-slate-300 font-mono">
                  Conversational Codebase Assistant
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Multi-turn conversation enabled. Ask questions and continuous follow-ups grounded in AST relations & embeddings.
                </p>

                {/* Suggested Quick Prompts */}
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-xs text-left">
                  {[
                    "Where is the Flask class defined?",
                    "How are blueprints registered in the app?",
                    "What are the main entrypoint files?",
                  ].map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(undefined, prompt)}
                      className="text-[11px] text-slate-400 hover:text-white bg-[#0c1017] hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 px-3 py-2 rounded-lg text-left transition font-mono truncate"
                    >
                      → {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2 animate-in fade-in duration-200">
                {/* User Message */}
                {msg.role === "user" ? (
                  <div className="flex items-start justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600/90 text-white px-3.5 py-2 text-xs font-medium shadow-sm">
                      {msg.content}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-indigo-300" />
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Refusal Alert */}
                      {msg.refused ? (
                        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-2.5 font-mono">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-amber-300">Insufficient Context</div>
                            <div className="mt-0.5 text-[11px] opacity-90">{msg.reason}</div>
                          </div>
                        </div>
                      ) : (
                        /* Standard Grounded Answer */
                        <div className="p-4 rounded-xl bg-[#0c1017] border border-slate-800/90 shadow-sm relative group">
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition p-1 rounded bg-slate-800 border border-slate-700"
                            title="Copy answer"
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

                      {/* Grounded Code Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="space-y-1.5 font-mono pl-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Code Citations
                          </div>
                          <div className="space-y-1">
                            {msg.citations.map((cite: any, i: number) => (
                              <div
                                key={i}
                                className="p-2 rounded-lg bg-[#0c1017] border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition"
                              >
                                <div className="font-mono text-[11px] text-slate-300 truncate max-w-[320px]">
                                  <span className="text-white font-medium">{cite.file_path}</span>{" "}
                                  <span className="text-indigo-400 font-semibold">
                                    #L{cite.start_line}–L{cite.end_line}
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
                  </div>
                )}
              </div>
            ))}

            {isAsking && (
              <div className="flex items-start gap-2.5 animate-in fade-in duration-150">
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="p-3.5 rounded-xl bg-[#0c1017] border border-slate-800 flex items-center gap-3 text-xs text-indigo-300 font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  Synthesizing answer with conversation context...
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Question Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-[#0c1017]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask architecture questions or follow-ups..."
                className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-[#070a0f] border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono transition"
              />
              <button
                type="submit"
                disabled={isAsking || !inputQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-500 font-mono">
              <span>Press Enter to send</span>
              <span>Grounded with LLaMA 3.3 70B</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}