"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Code, FileCode, Layers, Terminal } from "lucide-react";

const KIND_THEMES: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    tag: string;
    icon: any;
    accentBar: string;
    dot: string;
  }
> = {
  class: {
    bg: "bg-[#090700]/95",
    border: "border-amber-500/50 hover:border-amber-400",
    text: "text-amber-400",
    tag: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    icon: Layers,
    accentBar: "bg-amber-400",
    dot: "bg-amber-400 shadow-[0_0_8px_#ffb700]",
  },
  function: {
    bg: "bg-[#00080d]/95",
    border: "border-cyan-500/50 hover:border-cyan-400",
    text: "text-cyan-400",
    tag: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    icon: Code,
    accentBar: "bg-cyan-400",
    dot: "bg-cyan-400 shadow-[0_0_8px_#00f0ff]",
  },
  file: {
    bg: "bg-[#000a06]/95",
    border: "border-emerald-500/60 hover:border-emerald-400",
    text: "text-emerald-400",
    tag: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    icon: FileCode,
    accentBar: "bg-emerald-400",
    dot: "bg-emerald-400 shadow-[0_0_8px_#00ff66]",
  },
  import: {
    bg: "bg-[#0a0205]/95",
    border: "border-rose-500/50 hover:border-rose-400",
    text: "text-rose-400",
    tag: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    icon: Box,
    accentBar: "bg-rose-400",
    dot: "bg-rose-400 shadow-[0_0_8px_#ff3366]",
  },
  call: {
    bg: "bg-[#0a0205]/95",
    border: "border-rose-500/50 hover:border-rose-400",
    text: "text-rose-400",
    tag: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    icon: Terminal,
    accentBar: "bg-rose-400",
    dot: "bg-rose-400 shadow-[0_0_8px_#ff3366]",
  },
};

export const CustomCodeNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
  const kind = (data.kind || "function").toLowerCase();
  const theme = KIND_THEMES[kind] || KIND_THEMES.function;
  const Icon = theme.icon;
  const isFile = kind === "file";

  return (
    <div
      className={`relative px-4 py-3 rounded-xl border ${
        selected
          ? "border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.4)] ring-1 ring-cyan-400"
          : theme.border
      } ${theme.bg} shadow-2xl min-w-[210px] text-xs transition-all duration-200 hover:-translate-y-1 cursor-pointer overflow-hidden group`}
    >
      {/* Left Bold Color Accent Strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accentBar}`} />

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-2 !border-black"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-2 !border-black"
      />

      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 pl-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
          <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
          <span
            className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-md border ${theme.tag} font-bold tracking-wider`}
          >
            {kind}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono font-medium">
          L{data.start_line}
        </span>
      </div>

      <div className="mt-2 pl-1">
        <div
          className={`font-mono text-[13px] truncate max-w-[185px] ${
            isFile ? "font-extrabold text-emerald-300" : "font-bold text-white group-hover:text-cyan-300"
          }`}
        >
          {data.label}
        </div>
        <div className="text-[10px] text-slate-400 truncate max-w-[185px] mt-0.5 font-mono">
          {data.file_path.split("/").slice(-2).join("/")}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-2 !border-black"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-2 !border-black"
      />
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";