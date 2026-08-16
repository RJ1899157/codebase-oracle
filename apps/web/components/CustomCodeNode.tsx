"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, FileCode, Zap, ArrowRightLeft, Code2 } from "lucide-react";

interface CustomCodeNodeProps {
  data: {
    label: string;
    kind: "file" | "class" | "function" | "import" | "call" | "interface" | "struct" | "type" | string;
    file_path?: string;
    start_line?: number;
    end_line?: number;
  };
  selected?: boolean;
}

const KIND_CONFIG: Record<
  string,
  {
    label: string;
    badgeBg: string;
    indicatorColor: string;
    icon: React.ElementType;
  }
> = {
  file: {
    label: "MODULE",
    badgeBg: "bg-emerald-950/40 border border-emerald-800/40 text-emerald-300",
    indicatorColor: "#10b981",
    icon: FileCode,
  },
  class: {
    label: "CLASS",
    badgeBg: "bg-amber-950/40 border border-amber-800/40 text-amber-300",
    indicatorColor: "#f59e0b",
    icon: Box,
  },
  interface: {
    label: "INTERFACE",
    badgeBg: "bg-amber-950/40 border border-amber-800/40 text-amber-300",
    indicatorColor: "#f59e0b",
    icon: Box,
  },
  struct: {
    label: "STRUCT",
    badgeBg: "bg-amber-950/40 border border-amber-800/40 text-amber-300",
    indicatorColor: "#f59e0b",
    icon: Box,
  },
  function: {
    label: "FUNCTION",
    badgeBg: "bg-blue-950/40 border border-blue-800/40 text-blue-300",
    indicatorColor: "#3b82f6",
    icon: Zap,
  },
  import: {
    label: "IMPORT",
    badgeBg: "bg-zinc-800/60 border border-zinc-700/60 text-zinc-300",
    indicatorColor: "#8b949e",
    icon: ArrowRightLeft,
  },
  call: {
    label: "CALL",
    badgeBg: "bg-zinc-800/60 border border-zinc-700/60 text-zinc-300",
    indicatorColor: "#8b949e",
    icon: Code2,
  },
};

export const CustomCodeNode = memo(({ data, selected }: CustomCodeNodeProps) => {
  const config = KIND_CONFIG[data.kind] || {
    label: (data.kind || "SYMBOL").toUpperCase(),
    badgeBg: "bg-zinc-800 border border-zinc-700 text-zinc-300",
    indicatorColor: "#8b949e",
    icon: Code2,
  };

  const Icon = config.icon;
  const fileName = data.file_path ? data.file_path.split("/").pop() : "";

  return (
    <div
      className={`group relative min-w-[210px] max-w-[280px] rounded-lg p-3 transition-all duration-150 ${
        selected
          ? "bg-[#1f242c] border-2 border-blue-500 shadow-md"
          : "bg-[#161b22] hover:bg-[#1c2128] border border-[#30363d] hover:border-[#484f58]"
      }`}
    >
      {/* Top, Bottom, Left, Right Handles */}
      <Handle type="target" position={Position.Top} className="!bg-[#8b949e]" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#8b949e]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-[#8b949e]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-[#8b949e]" />

      {/* Header: Kind Badge & Line Count */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${config.badgeBg}`}
        >
          <Icon className="w-3 h-3" />
          <span>{config.label}</span>
        </div>

        {data.start_line && (
          <span className="text-[10px] font-mono text-[#8b949e] font-medium">
            L{data.start_line}
            {data.end_line && data.end_line !== data.start_line ? `–${data.end_line}` : ""}
          </span>
        )}
      </div>

      {/* Symbol Name */}
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: config.indicatorColor }}
        />
        <h3
          className="text-xs font-semibold text-[#f0f6fc] font-mono tracking-tight truncate group-hover:text-blue-300 transition"
          title={data.label}
        >
          {data.label}
        </h3>
      </div>

      {/* Subtitle File Path */}
      {data.file_path && (
        <div className="mt-2 pt-1.5 border-t border-[#30363d] flex items-center justify-between text-[10px] font-mono text-[#8b949e]">
          <span className="truncate max-w-[170px]" title={data.file_path}>
            {fileName || data.file_path}
          </span>
          <span className="text-[9px] text-[#6e7681] font-semibold uppercase">AST</span>
        </div>
      )}
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";