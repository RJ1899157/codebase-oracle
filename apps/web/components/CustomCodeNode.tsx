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
    accent: string;
  }
> = {
  class: {
    bg: "bg-[#111322]",
    border: "border-purple-500/30 hover:border-purple-400",
    text: "text-purple-300",
    tag: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    icon: Layers,
    accent: "bg-purple-500",
  },
  function: {
    bg: "bg-[#0b1420]",
    border: "border-sky-500/30 hover:border-sky-400",
    text: "text-sky-300",
    tag: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    icon: Code,
    accent: "bg-sky-500",
  },
  file: {
    bg: "bg-[#0c1815]",
    border: "border-emerald-500/40 hover:border-emerald-400",
    text: "text-emerald-300",
    tag: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    icon: FileCode,
    accent: "bg-emerald-500",
  },
  import: {
    bg: "bg-[#17140e]",
    border: "border-amber-500/30 hover:border-amber-400",
    text: "text-amber-300",
    tag: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    icon: Box,
    accent: "bg-amber-500",
  },
  call: {
    bg: "bg-[#181014]",
    border: "border-rose-500/30 hover:border-rose-400",
    text: "text-rose-300",
    tag: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    icon: Terminal,
    accent: "bg-rose-500",
  },
};

export const CustomCodeNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
  const kind = (data.kind || "function").toLowerCase();
  const theme = KIND_THEMES[kind] || KIND_THEMES.function;
  const Icon = theme.icon;
  const isFile = kind === "file";

  return (
    <div
      className={`px-3.5 py-2.5 rounded-lg border ${
        selected ? "border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400" : theme.border
      } ${theme.bg} shadow-md min-w-[200px] text-xs transition-all duration-150 cursor-pointer relative group`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-600 !w-2 !h-2 !border-none"
      />

      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${theme.accent}`} />
          <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
          <span
            className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${theme.tag} font-semibold`}
          >
            {kind}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          L{data.start_line}
        </span>
      </div>

      <div className="mt-1.5">
        <div
          className={`font-mono text-[12px] truncate max-w-[180px] ${
            isFile ? "font-bold text-emerald-300" : "font-semibold text-slate-100"
          }`}
        >
          {data.label}
        </div>
        <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5 font-mono">
          {data.file_path.split("/").slice(-2).join("/")}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-600 !w-2 !h-2 !border-none"
      />
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";