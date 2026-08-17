"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  RotateCcw,
  Play,
  Pause,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Code2,
  Activity,
  Zap,
} from "lucide-react";

interface NodeData {
  id: string;
  label: string;
  kind: string;
  file_path?: string;
  start_line?: number;
  end_line?: number;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface CodeGraph3DProps {
  nodes: { id: string; data: NodeData }[];
  edges: EdgeData[];
  onNodeSelect: (nodeData: NodeData) => void;
  selectedNodeId?: string | null;
}

const KIND_COLORS: Record<string, { hex: number; str: string; label: string }> = {
  file: { hex: 0x3fb950, str: "#3fb950", label: "MODULE" },
  module: { hex: 0x3fb950, str: "#3fb950", label: "MODULE" },
  class: { hex: 0xd29922, str: "#d29922", label: "CLASS" },
  interface: { hex: 0xd29922, str: "#d29922", label: "INTERFACE" },
  struct: { hex: 0xd29922, str: "#d29922", label: "STRUCT" },
  function: { hex: 0x58a6ff, str: "#58a6ff", label: "FUNCTION" },
  import: { hex: 0xa371f7, str: "#a371f7", label: "IMPORT" },
  call: { hex: 0x8b949e, str: "#8b949e", label: "CALL" },
};

function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 256;
  canvas.height = 64;

  // Background rounded pill
  ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 56, 12);
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text label
  ctx.fillStyle = color;
  ctx.font = "bold 20px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const display = text.length > 15 ? text.slice(0, 13) + ".." : text;
  ctx.fillText(display, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(36, 9, 1);
  return sprite;
}

export default function CodeGraph3D({
  nodes,
  edges,
  onNodeSelect,
  selectedNodeId,
}: CodeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // References for Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const spritesRef = useRef<THREE.Sprite[]>([]);

  // Telemetry Metrics
  const stats = useMemo(() => {
    const modules = new Set(nodes.map((n) => n.data.file_path?.split("/")[0] || "root")).size;
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      moduleCount: modules,
    };
  }, [nodes, edges]);

  // Setup Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.set(0, 160, 480);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.8;
    controls.maxDistance = 1600;
    controls.minDistance = 60;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x58a6ff, 1.6);
    dirLight1.position.set(250, 350, 250);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xd29922, 1.3);
    dirLight2.position.set(-250, -250, -250);
    scene.add(dirLight2);

    // 6. Starfield Atmosphere
    const starCount = 800;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1800;
      starPositions[i + 1] = (Math.random() - 0.5) * 1800;
      starPositions[i + 2] = (Math.random() - 0.5) * 1800;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x30363d,
      size: 2,
      transparent: true,
      opacity: 0.6,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // 7. Calculate 3D Orbital Positions
    const posMap = new Map<string, THREE.Vector3>();
    const meshMap = new Map<string, THREE.Mesh>();
    const sprites: THREE.Sprite[] = [];

    const moduleGroups: Record<string, { id: string; data: NodeData }[]> = {};
    nodes.forEach((n) => {
      const mod = n.data.file_path ? n.data.file_path.split("/")[0] : "root";
      if (!moduleGroups[mod]) moduleGroups[mod] = [];
      moduleGroups[mod].push(n);
    });

    const moduleKeys = Object.keys(moduleGroups);
    const modCount = moduleKeys.length;

    moduleKeys.forEach((modKey, modIdx) => {
      const modAngle = (modIdx / Math.max(modCount, 1)) * Math.PI * 2;
      const modRadius = 240 + (modIdx % 2) * 50;
      const modCenter = new THREE.Vector3(
        Math.cos(modAngle) * modRadius,
        Math.sin(modIdx * 1.5) * 60 + (modIdx % 3 - 1) * 40,
        Math.sin(modAngle) * modRadius
      );

      const groupNodes = moduleGroups[modKey];
      groupNodes.forEach((node, nodeIdx) => {
        let nodePos: THREE.Vector3;
        const kind = node.data.kind;

        if (kind === "file" || kind === "module") {
          nodePos = modCenter.clone();
        } else {
          const subAngle = (nodeIdx / groupNodes.length) * Math.PI * 2;
          const subRadius = kind === "class" ? 38 : 70 + (nodeIdx % 3) * 15;
          nodePos = new THREE.Vector3(
            modCenter.x + Math.cos(subAngle) * subRadius + (Math.random() - 0.5) * 8,
            modCenter.y + Math.sin(subAngle) * (subRadius * 0.7) + (Math.random() - 0.5) * 12,
            modCenter.z + Math.sin(subAngle) * subRadius + (Math.random() - 0.5) * 8
          );
        }

        posMap.set(node.id, nodePos);

        const config = KIND_COLORS[kind] || { hex: 0x8b949e, str: "#8b949e", label: "SYMBOL" };
        const radius = kind === "file" || kind === "module" ? 7.5 : kind === "class" ? 5.5 : 4;

        // Node Mesh
        const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: config.hex,
          emissive: config.hex,
          emissiveIntensity: 0.45,
          roughness: 0.25,
          metalness: 0.85,
        });

        const mesh = new THREE.Mesh(sphereGeo, sphereMat);
        mesh.position.copy(nodePos);
        mesh.userData = node.data;
        scene.add(mesh);
        meshMap.set(node.id, mesh);

        // 3D Text Sprite Billboard
        const sprite = createTextSprite(node.data.label, config.str);
        sprite.position.set(nodePos.x, nodePos.y + radius + 7, nodePos.z);
        sprite.visible = showLabels;
        scene.add(sprite);
        sprites.push(sprite);
      });
    });

    nodeMeshMap.current = meshMap;
    spritesRef.current = sprites;

    // 8. 3D Edge Links
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x30363d,
      transparent: true,
      opacity: 0.45,
    });

    edges.forEach((edge) => {
      const p1 = posMap.get(edge.source);
      const p2 = posMap.get(edge.target);
      if (!p1 || !p2) return;

      const points = [p1, p2];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMaterial);
      scene.add(line);
    });

    // 9. Raycasting (Hover & Click)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(meshMap.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        container.style.cursor = "pointer";
        const hitData = intersects[0].object.userData as NodeData;
        setHoveredNode(hitData);
      } else {
        container.style.cursor = "grab";
        setHoveredNode(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(meshMap.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hitData = intersects[0].object.userData as NodeData;
        onNodeSelect(hitData);
      }
    };

    renderer.domElement.addEventListener("mousemove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleClick);

    // 10. Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 11. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousemove", handlePointerMove);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    };
  }, [nodes, edges, onNodeSelect]);

  // Handle Auto-Rotate toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Handle Show/Hide 3D Labels
  useEffect(() => {
    spritesRef.current.forEach((s) => {
      s.visible = showLabels;
    });
  }, [showLabels]);

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 160, 480);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handleZoom = (direction: "in" | "out") => {
    if (cameraRef.current && controlsRef.current) {
      const factor = direction === "in" ? 0.8 : 1.25;
      cameraRef.current.position.multiplyScalar(factor);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-full bg-[#000000] overflow-hidden select-none">
      {/* Three.js Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D HUD Controls (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#0a0a0a]/90 backdrop-blur-md border border-[#222222] p-1.5 rounded-lg font-mono text-xs shadow-2xl">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#161616] rounded border border-[#27272a] text-[#58a6ff]">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-semibold text-[11px]">3D Cosmos</span>
        </div>

        <div className="h-4 w-[1px] bg-[#222222]" />

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 text-[11px] ${
            autoRotate
              ? "bg-[#161616] text-[#3fb950] border border-[#3fb950]/30"
              : "text-[#8b949e] hover:text-white"
          }`}
          title="Toggle 3D Orbital Rotation"
        >
          {autoRotate ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
          <span>{autoRotate ? "Orbiting" : "Paused"}</span>
        </button>

        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-2 py-1 rounded transition flex items-center gap-1 text-[11px] ${
            showLabels
              ? "bg-[#161616] text-[#58a6ff] border border-[#27272a]"
              : "text-[#8b949e] hover:text-white"
          }`}
          title="Toggle 3D Floating Labels"
        >
          {showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>3D Labels</span>
        </button>

        <div className="h-4 w-[1px] bg-[#222222]" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => handleZoom("in")}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#161616]"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom("out")}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#161616]"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetCamera}
            className="p-1 rounded text-[#8b949e] hover:text-white hover:bg-[#161616]"
            title="Reset Camera View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating 3D Telemetry & Legend HUD (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-[#0a0a0a]/90 backdrop-blur-md border border-[#222222] px-3.5 py-2 rounded-lg font-mono text-[11px] text-[#8b949e] shadow-2xl">
        <div className="flex items-center gap-2 pr-3 border-r border-[#222222]">
          <span className="text-[#f0f6fc] font-bold">{stats.nodeCount}</span>
          <span>Nodes</span>
          <span className="text-[#30363d]">•</span>
          <span className="text-[#f0f6fc] font-bold">{stats.edgeCount}</span>
          <span>Links</span>
          <span className="text-[#30363d]">•</span>
          <span className="text-[#f0f6fc] font-bold">{stats.moduleCount}</span>
          <span>Subsystems</span>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
            <span className="text-[#c9d1d9]">Modules</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#d29922]" />
            <span className="text-[#c9d1d9]">Classes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#58a6ff]" />
            <span className="text-[#c9d1d9]">Functions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#a371f7]" />
            <span className="text-[#c9d1d9]">Imports</span>
          </div>
        </div>
      </div>

      {/* Hovered Node Floating Tooltip */}
      {hoveredNode && (
        <div className="absolute top-16 left-4 z-20 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#27272a] p-3 rounded-lg font-mono text-xs text-white shadow-2xl pointer-events-none max-w-sm animate-in fade-in duration-100">
          <div className="flex items-center justify-between gap-2 border-b border-[#1f1f1f] pb-1.5 mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: KIND_COLORS[hoveredNode.kind]?.str || "#8b949e",
                }}
              />
              <strong className="text-white truncate max-w-[180px]">{hoveredNode.label}</strong>
            </div>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#161616] text-[#58a6ff] border border-[#27272a]">
              {hoveredNode.kind}
            </span>
          </div>
          {hoveredNode.file_path && (
            <p className="text-[10px] text-[#8b949e] truncate" title={hoveredNode.file_path}>
              {hoveredNode.file_path}
            </p>
          )}
          {hoveredNode.start_line && (
            <p className="text-[10px] text-[#52525b] mt-0.5">
              Lines: L{hoveredNode.start_line}
              {hoveredNode.end_line && hoveredNode.end_line !== hoveredNode.start_line
                ? `–L${hoveredNode.end_line}`
                : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
