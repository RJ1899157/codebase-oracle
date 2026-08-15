"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Code, FileCode, Layers, Terminal, ArrowUpRight } from "lucide-react";

const KIND_THEMES: Record<string, { bg: string; border: string; text: string; badge: string; icon: any }> = {
  class: {
    bg: "bg-purple-950/80 hover:bg-purple-900/90",
    border: "border-purple-500/70",
    text: "text-purple-300",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    icon: Layers,
  },
  function: {
    bg: "bg-blue-950/80 hover:bg-blue-900/90",
    border: "border-blue-500/70",
    text: "text-blue-300",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    icon: Code,
  },
  file: {
    bg: "bg-emerald-950/80 hover:bg-emerald-900/90",
    border: "border-emerald-500/70",
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    icon: FileCode,
  },
  import: {
    bg: "bg-amber-950/80 hover:bg-amber-900/90",
    border: "border-amber-500/70",
    text: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    icon: Box,
  },
  call: {
    bg: "bg-rose-950/80 hover:bg-rose-900/90",
    border: "border-rose-500/70",
    text: "text-rose-300",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    icon: Terminal,
  },
};

export const CustomCodeNode = memo(({ data }: { data: any }) => {
  const kind = (data.kind || "function").toLowerCase();
  const theme = KIND_THEMES[kind] || KIND_THEMES.function;
  const Icon = theme.icon;

  return (
    <div
      className={`px-3.5 py-2.5 rounded-xl border ${theme.border} ${theme.bg} shadow-xl backdrop-blur-md min-w-[160px] text-xs transition-all duration-200 hover:scale-105 cursor-pointer`}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900" />
      <Handle type="target" position={Position.Left} className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
          <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${theme.badge}`}>
            {kind}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">L{data.start_line}</span>
      </div>

      <div className="mt-1.5">
        <div className="font-semibold text-slate-100 truncate max-w-[150px] font-mono text-[11px]">
          {data.label}
        </div>
        <div className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5 opacity-80">
          {data.file_path.split("/").pop()}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900" />
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";