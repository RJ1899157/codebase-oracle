"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Code2, FileCode, Zap, ArrowRightLeft } from "lucide-react";

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
    color: string;
    borderGlow: string;
    badgeBg: string;
    badgeText: string;
    icon: React.ElementType;
  }
> = {
  file: {
    label: "MODULE",
    color: "#00ff66",
    borderGlow: "rgba(0, 255, 102, 0.4)",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-400",
    icon: FileCode,
  },
  class: {
    label: "CLASS",
    color: "#ffb700",
    borderGlow: "rgba(255, 183, 0, 0.4)",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-400",
    icon: Box,
  },
  interface: {
    label: "INTERFACE",
    color: "#ffb700",
    borderGlow: "rgba(255, 183, 0, 0.4)",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-400",
    icon: Box,
  },
  struct: {
    label: "STRUCT",
    color: "#ffb700",
    borderGlow: "rgba(255, 183, 0, 0.4)",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-400",
    icon: Box,
  },
  function: {
    label: "FUNCTION",
    color: "#00f0ff",
    borderGlow: "rgba(0, 240, 255, 0.4)",
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-400",
    icon: Zap,
  },
  import: {
    label: "IMPORT",
    color: "#ff3366",
    borderGlow: "rgba(255, 51, 102, 0.4)",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-400",
    icon: ArrowRightLeft,
  },
  call: {
    label: "CALL",
    color: "#ff3366",
    borderGlow: "rgba(255, 51, 102, 0.4)",
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-400",
    icon: Code2,
  },
};

export const CustomCodeNode = memo(({ data, selected }: CustomCodeNodeProps) => {
  const config = KIND_CONFIG[data.kind] || {
    label: (data.kind || "SYMBOL").toUpperCase(),
    color: "#00f0ff",
    borderGlow: "rgba(0, 240, 255, 0.3)",
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-400",
    icon: Code2,
  };

  const Icon = config.icon;
  const fileName = data.file_path ? data.file_path.split("/").pop() : "";

  return (
    <div
      className={`group relative min-w-[210px] max-w-[280px] rounded-2xl p-3 transition-all duration-300 ${
        selected
          ? "bg-[#0c101c]/90 border-2 shadow-[0_0_30px_rgba(0,240,255,0.45)] scale-105"
          : "bg-[#090c15]/85 hover:bg-[#0d1222]/90 border border-white/10 hover:border-white/25 hover:shadow-[0_12px_28px_rgba(0,0,0,0.8)]"
      }`}
      style={{
        borderColor: selected ? config.color : undefined,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Top / Bottom / Left / Right Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-400"
        style={{ background: config.color }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-400"
        style={{ background: config.color }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-cyan-400"
        style={{ background: config.color }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-cyan-400"
        style={{ background: config.color }}
      />

      {/* Ambient Top Glow Line */}
      <div
        className="absolute inset-x-3 top-0 h-[2px] rounded-full opacity-75 transition-opacity group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        }}
      />

      {/* Header: Kind Badge & Line Count */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono tracking-wider ${config.badgeBg} ${config.badgeText}`}
        >
          <Icon className="w-3 h-3" />
          <span>{config.label}</span>
        </div>

        {data.start_line && (
          <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 font-semibold transition">
            L{data.start_line}
            {data.end_line && data.end_line !== data.start_line ? `–${data.end_line}` : ""}
          </span>
        )}
      </div>

      {/* Symbol Name */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0 shadow-sm"
          style={{
            backgroundColor: config.color,
            boxShadow: `0 0 8px ${config.color}`,
          }}
        />
        <h3
          className="text-xs font-bold text-white font-mono tracking-tight truncate group-hover:text-cyan-300 transition"
          title={data.label}
        >
          {data.label}
        </h3>
      </div>

      {/* Subtitle File Path */}
      {data.file_path && (
        <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span className="truncate max-w-[170px]" title={data.file_path}>
            {fileName || data.file_path}
          </span>
          <span className="text-[9px] text-zinc-600 font-bold uppercase">AST</span>
        </div>
      )}
    </div>
  );
});

CustomCodeNode.displayName = "CustomCodeNode";