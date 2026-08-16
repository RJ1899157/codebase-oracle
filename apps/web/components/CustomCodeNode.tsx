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
    badgeBg: "bg-[#238636]/15 border border-[#3fb950]/30 text-[#3fb950]",
    indicatorColor: "#3fb950",
    icon: FileCode,
  },
  class: {
    label: "CLASS",
    badgeBg: "bg-[#d29922]/15 border border-[#d29922]/30 text-[#d29922]",
    indicatorColor: "#d29922",
    icon: Box,
  },
  interface: {
    label: "INTERFACE",
    badgeBg: "bg-[#d29922]/15 border border-[#d29922]/30 text-[#d29922]",
    indicatorColor: "#d29922",
    icon: Box,
  },
  struct: {
    label: "STRUCT",
    badgeBg: "bg-[#d29922]/15 border border-[#d29922]/30 text-[#d29922]",
    indicatorColor: "#d29922",
    icon: Box,
  },
  function: {
    label: "FUNCTION",
    badgeBg: "bg-[#1f6feb]/15 border border-[#58a6ff]/30 text-[#58a6ff]",
    indicatorColor: "#58a6ff",
    icon: Zap,
  },
  import: {
    label: "IMPORT",
    badgeBg: "bg-[#8957e5]/15 border border-[#a371f7]/30 text-[#a371f7]",
    indicatorColor: "#a371f7",
    icon: ArrowRightLeft,
  },
  call: {
    label: "CALL",
    badgeBg: "bg-[#21262d] border border-[#30363d] text-[#8b949e]",
    indicatorColor: "#8b949e",
    icon: Code2,
  },
};

export const CustomCodeNode = memo(({ data, selected }: CustomCodeNodeProps) => {
  const config = KIND_CONFIG[data.kind] || {
    label: (data.kind || "SYMBOL").toUpperCase(),
    badgeBg: "bg-[#21262d] border border-[#30363d] text-[#8b949e]",
    indicatorColor: "#8b949e",
    icon: Code2,
  };

  const Icon = config.icon;
  const fileName = data.file_path ? data.file_path.split("/").pop() : "";

  return (
    <div
      className={`group relative min-w-[200px] max-w-[270px] rounded-md p-3 transition-all duration-150 ${
        selected
          ? "bg-[#1f242c] border-2 border-[#58a6ff] shadow-xl scale-[1.02]"
          : "bg-[#161b22] hover:bg-[#1c2128] border border-[#30363d] hover:border-[#484f58]"
      }`}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!bg-[#8b949e]" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#8b949e]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-[#8b949e]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-[#8b949e]" />

      {/* Header: Kind Badge & Line Count */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono tracking-wide ${config.badgeBg}`}
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
          className="text-xs font-semibold text-[#f0f6fc] font-mono tracking-tight truncate group-hover:text-[#58a6ff] transition"
          title={data.label}
        >
          {data.label}
        </h3>
      </div>

      {/* Subtitle File Path */}
      {data.file_path && (
        <div className="mt-2 pt-1.5 border-t border-[#21262d] flex items-center justify-between text-[10px] font-mono text-[#8b949e]">
          <span className="truncate max-w-[160px]" title={data.file_path}>
            {fileName || data.file_path}
          </span>
          <span className="text-[9px] text-[#484f58] font-bold uppercase">AST</span>
        </div>
      )}
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";