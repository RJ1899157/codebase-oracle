"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  RotateCcw,
  Play,
  Pause,
  Maximize2,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Info,
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

const KIND_COLORS: Record<string, number> = {
  file: 0x3fb950, // Sage Emerald
  module: 0x3fb950,
  class: 0xd29922, // Warm Amber
  interface: 0xd29922,
  struct: 0xd29922,
  function: 0x58a6ff, // Ice Blue
  import: 0xa371f7, // Muted Lavender
  call: 0x8b949e, // Slate Gray
};

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

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const nodePositions = useRef<Map<string, THREE.Vector3>>(new Map());

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
    camera.position.set(0, 150, 450);
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
    controls.maxDistance = 1500;
    controls.minDistance = 50;
    controlsRef.current = controls;

    // 5. Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x58a6ff, 1.5);
    dirLight1.position.set(200, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xd29922, 1.2);
    dirLight2.position.set(-200, -200, -200);
    scene.add(dirLight2);

    // 6. Starfield Background Particle Dust
    const starCount = 600;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1600;
      starPositions[i + 1] = (Math.random() - 0.5) * 1600;
      starPositions[i + 2] = (Math.random() - 0.5) * 1600;
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

    // 7. Calculate 3D Force / Spherical Layout for Nodes
    const posMap = new Map<string, THREE.Vector3>();
    const meshMap = new Map<string, THREE.Mesh>();
    const nodeCount = nodes.length;

    // Golden Spiral 3D sphere distribution + module grouping
    const moduleGroups: Record<string, { id: string; data: NodeData }[]> = {};
    nodes.forEach((n) => {
      const mod = n.data.file_path ? n.data.file_path.split("/")[0] : "root";
      if (!moduleGroups[mod]) moduleGroups[mod] = [];
      moduleGroups[mod].push(n);
    });

    const moduleKeys = Object.keys(moduleGroups);
    const modCount = moduleKeys.length;

    moduleKeys.forEach((modKey, modIdx) => {
      // Position module center in orbital ring
      const modAngle = (modIdx / Math.max(modCount, 1)) * Math.PI * 2;
      const modRadius = 220 + (modIdx % 2) * 50;
      const modCenter = new THREE.Vector3(
        Math.cos(modAngle) * modRadius,
        (Math.sin(modIdx * 1.5) * 60) + (modIdx % 3 - 1) * 40,
        Math.sin(modAngle) * modRadius
      );

      const groupNodes = moduleGroups[modKey];
      groupNodes.forEach((node, nodeIdx) => {
        let nodePos: THREE.Vector3;
        const kind = node.data.kind;

        if (kind === "file" || kind === "module") {
          nodePos = modCenter.clone();
        } else {
          // Cluster classes and functions around module center
          const subAngle = (nodeIdx / groupNodes.length) * Math.PI * 2;
          const subRadius = kind === "class" ? 35 : 65 + (nodeIdx % 3) * 15;
          nodePos = new THREE.Vector3(
            modCenter.x + Math.cos(subAngle) * subRadius + (Math.random() - 0.5) * 10,
            modCenter.y + (Math.sin(subAngle) * (subRadius * 0.7)) + (Math.random() - 0.5) * 15,
            modCenter.z + Math.sin(subAngle) * subRadius + (Math.random() - 0.5) * 10
          );
        }

        posMap.set(node.id, nodePos);

        // Node 3D Mesh
        const color = KIND_COLORS[kind] || 0x8b949e;
        const radius = kind === "file" || kind === "module" ? 7 : kind === "class" ? 5.5 : 4;

        const sphereGeo = new THREE.SphereGeometry(radius, 20, 20);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.4,
          roughness: 0.3,
          metalness: 0.8,
        });

        const mesh = new THREE.Mesh(sphereGeo, sphereMat);
        mesh.position.copy(nodePos);
        mesh.userData = node.data;
        scene.add(mesh);
        meshMap.set(node.id, mesh);
      });
    });

    nodePositions.current = posMap;
    nodeMeshMap.current = meshMap;

    // 8. Draw 3D Splines for Edges
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

    // 9. Raycasting for Interaction (Hover & Click)
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

    // 10. Resize handler
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

    // Cleanup
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

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 150, 450);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-full bg-[#000000] overflow-hidden select-none">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D HUD Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#0a0a0a]/90 backdrop-blur-md border border-[#222222] p-1.5 rounded-lg font-mono text-xs shadow-xl">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#161616] rounded border border-[#27272a] text-[#58a6ff]">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-semibold text-[11px]">3D Cosmos Engine</span>
        </div>

        <div className="h-4 w-[1px] bg-[#222222]" />

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`p-1.5 rounded transition flex items-center gap-1 text-[11px] ${
            autoRotate
              ? "bg-[#161616] text-[#3fb950] border border-[#3fb950]/30"
              : "text-[#8b949e] hover:text-white"
          }`}
          title="Toggle 3D Auto-Rotation"
        >
          {autoRotate ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
          <span>{autoRotate ? "Orbiting" : "Paused"}</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#161616] transition flex items-center gap-1 text-[11px]"
          title="Reset Camera View"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Center</span>
        </button>

        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`p-1.5 rounded transition flex items-center gap-1 text-[11px] ${
            showLabels
              ? "bg-[#161616] text-[#58a6ff] border border-[#27272a]"
              : "text-[#8b949e] hover:text-white"
          }`}
          title="Toggle Node Labels"
        >
          {showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>Labels</span>
        </button>
      </div>

      {/* Floating 3D Telemetry HUD (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-20 bg-[#0a0a0a]/90 backdrop-blur-md border border-[#222222] px-3 py-2 rounded-lg font-mono text-[10px] text-[#8b949e] flex items-center gap-3 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
          <span>Module</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#d29922]" />
          <span>Class</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#58a6ff]" />
          <span>Function</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#a371f7]" />
          <span>Import</span>
        </div>
      </div>

      {/* Hovered Node Floating Tooltip */}
      {hoveredNode && (
        <div className="absolute top-16 left-4 z-20 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#27272a] p-2.5 rounded-lg font-mono text-xs text-white shadow-2xl pointer-events-none max-w-xs animate-in fade-in duration-100">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: KIND_COLORS[hoveredNode.kind]
                  ? `#${KIND_COLORS[hoveredNode.kind].toString(16).padStart(6, "0")}`
                  : "#8b949e",
              }}
            />
            <strong className="text-white truncate">{hoveredNode.label}</strong>
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#161616] text-[#8b949e] border border-[#27272a]">
              {hoveredNode.kind}
            </span>
          </div>
          {hoveredNode.file_path && (
            <p className="text-[10px] text-[#8b949e] mt-1 truncate">{hoveredNode.file_path}</p>
          )}
          {hoveredNode.start_line && (
            <p className="text-[9px] text-[#52525b] mt-0.5">
              Lines L{hoveredNode.start_line}
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
