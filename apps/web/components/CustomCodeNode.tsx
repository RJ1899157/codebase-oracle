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
    badgeText: string;
    indicatorColor: string;
    icon: React.ElementType;
  }
> = {
  file: {
    label: "MODULE",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#10b981]",
    badgeText: "text-[#10b981]",
    indicatorColor: "#10b981",
    icon: FileCode,
  },
  class: {
    label: "CLASS",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#f59e0b]",
    badgeText: "text-[#f59e0b]",
    indicatorColor: "#f59e0b",
    icon: Box,
  },
  interface: {
    label: "INTERFACE",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#f59e0b]",
    badgeText: "text-[#f59e0b]",
    indicatorColor: "#f59e0b",
    icon: Box,
  },
  struct: {
    label: "STRUCT",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#f59e0b]",
    badgeText: "text-[#f59e0b]",
    indicatorColor: "#f59e0b",
    icon: Box,
  },
  function: {
    label: "FUNCTION",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#38bdf8]",
    badgeText: "text-[#38bdf8]",
    indicatorColor: "#38bdf8",
    icon: Zap,
  },
  import: {
    label: "IMPORT",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#a1a1aa]",
    badgeText: "text-[#a1a1aa]",
    indicatorColor: "#a1a1aa",
    icon: ArrowRightLeft,
  },
  call: {
    label: "CALL",
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#a1a1aa]",
    badgeText: "text-[#a1a1aa]",
    indicatorColor: "#a1a1aa",
    icon: Code2,
  },
};

export const CustomCodeNode = memo(({ data, selected }: CustomCodeNodeProps) => {
  const config = KIND_CONFIG[data.kind] || {
    label: (data.kind || "SYMBOL").toUpperCase(),
    badgeBg: "bg-[#111111] border border-[#27272a] text-[#a1a1aa]",
    badgeText: "text-[#a1a1aa]",
    indicatorColor: "#a1a1aa",
    icon: Code2,
  };

  const Icon = config.icon;
  const fileName = data.file_path ? data.file_path.split("/").pop() : "";

  return (
    <div
      className={`group relative min-w-[210px] max-w-[280px] rounded-lg p-3 transition-all duration-150 ${
        selected
          ? "bg-[#141414] border-2 border-white shadow-xl scale-[1.02]"
          : "bg-[#0a0a0a] hover:bg-[#111111] border border-[#222222] hover:border-[#383838]"
      }`}
    >
      {/* Top, Bottom, Left, Right Handles */}
      <Handle type="target" position={Position.Top} className="!bg-[#71717a]" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#71717a]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-[#71717a]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-[#71717a]" />

      {/* Header: Kind Badge & Line Count */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider ${config.badgeBg}`}
        >
          <Icon className="w-3 h-3" />
          <span>{config.label}</span>
        </div>

        {data.start_line && (
          <span className="text-[10px] font-mono text-[#71717a] font-semibold">
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
          className="text-xs font-bold text-white font-mono tracking-tight truncate group-hover:text-[#38bdf8] transition"
          title={data.label}
        >
          {data.label}
        </h3>
      </div>

      {/* Subtitle File Path */}
      {data.file_path && (
        <div className="mt-2 pt-1.5 border-t border-[#1f1f1f] flex items-center justify-between text-[10px] font-mono text-[#71717a]">
          <span className="truncate max-w-[170px]" title={data.file_path}>
            {fileName || data.file_path}
          </span>
          <span className="text-[9px] text-[#52525b] font-bold uppercase">AST</span>
        </div>
      )}
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";