"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Code, FileCode, Layers, Terminal } from "lucide-react";

const KIND_COLORS: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  class: {
    bg: "bg-purple-950/80",
    border: "border-purple-500",
    text: "text-purple-300",
    icon: Layers,
  },
  function: {
    bg: "bg-blue-950/80",
    border: "border-blue-500",
    text: "text-blue-300",
    icon: Code,
  },
  file: {
    bg: "bg-emerald-950/80",
    border: "border-emerald-500",
    text: "text-emerald-300",
    icon: FileCode,
  },
  import: {
    bg: "bg-amber-950/80",
    border: "border-amber-500",
    text: "text-amber-300",
    icon: Box,
  },
  call: {
    bg: "bg-rose-950/80",
    border: "border-rose-500",
    text: "text-rose-300",
    icon: Terminal,
  },
};

export const CustomCodeNode = memo(({ data }: { data: any }) => {
  const kind = (data.kind || "function").toLowerCase();
  const theme = KIND_COLORS[kind] || KIND_COLORS.function;
  const Icon = theme.icon;

  return (
    <div
      className={`px-3 py-2 rounded-lg border ${theme.border} ${theme.bg} shadow-lg backdrop-blur-md min-w-[140px] text-xs transition-all hover:scale-105 cursor-pointer`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${theme.text}`} />
        <div>
          <div className="font-semibold text-slate-100 truncate max-w-[130px]">
            {data.label}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {kind} • L{data.start_line}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";