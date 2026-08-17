"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  RotateCcw,
  Sparkles,
  Minus,
  Plus,
  Compass,
  Eye,
  EyeOff,
  Crosshair,
  Layers,
  Search,
  ExternalLink,
  Zap,
  Activity,
  Box,
  X,
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

const KIND_COLORS: Record<string, { hex: number; str: string; label: string; glow: number }> = {
  file: { hex: 0x3fb950, str: "#3fb950", label: "MODULE", glow: 0x2ea043 },
  module: { hex: 0x3fb950, str: "#3fb950", label: "MODULE", glow: 0x2ea043 },
  class: { hex: 0xd29922, str: "#d29922", label: "CLASS", glow: 0xbb8009 },
  interface: { hex: 0xd29922, str: "#d29922", label: "INTERFACE", glow: 0xbb8009 },
  struct: { hex: 0xd29922, str: "#d29922", label: "STRUCT", glow: 0xbb8009 },
  function: { hex: 0x58a6ff, str: "#58a6ff", label: "FUNCTION", glow: 0x1f6feb },
  import: { hex: 0xa371f7, str: "#a371f7", label: "IMPORT", glow: 0x8957e5 },
  call: { hex: 0x8b949e, str: "#8b949e", label: "CALL", glow: 0x6e7681 },
};

function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "rgba(10, 10, 10, 0.88)";
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 52, 14);
  ctx.fill();

  ctx.strokeStyle = "rgba(88, 166, 255, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "bold 21px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const display = text.length > 14 ? text.slice(0, 12) + ".." : text;
  ctx.fillText(display, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(34, 8.5, 1);
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
  const [particleSpeed, setParticleSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [cameraPreset, setCameraPreset] = useState<"orbit" | "birdseye" | "core">("orbit");
  const [searchQuery, setSearchQuery] = useState("");

  // References for Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const posMapRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const selectionRingRef = useRef<THREE.Mesh | null>(null);

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
    scene.fog = new THREE.FogExp2(0x000000, 0.0005);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 4500);
    camera.position.set(0, 150, 480);
    cameraRef.current = camera;

    // 3. Renderer with High Dynamic Range Tone Mapping
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.7;
    controls.maxDistance = 2000;
    controls.minDistance = 40;
    controlsRef.current = controls;

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x58a6ff, 2.2, 1600);
    cyanLight.position.set(250, 350, 300);
    scene.add(cyanLight);

    const amberLight = new THREE.PointLight(0xd29922, 1.8, 1600);
    amberLight.position.set(-250, -200, -250);
    scene.add(amberLight);

    // 6. Multi-Layer Cosmic Starfield Dust
    const createStarLayer = (count: number, size: number, color: number, range: number) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i += 3) {
        pos[i] = (Math.random() - 0.5) * range;
        pos[i + 1] = (Math.random() - 0.5) * range;
        pos[i + 2] = (Math.random() - 0.5) * range;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: color,
        size: size,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      return new THREE.Points(geo, mat);
    };

    const stars1 = createStarLayer(1000, 2.0, 0xd0e8ff, 2500);
    const stars2 = createStarLayer(600, 3.0, 0x58a6ff, 1800);
    const stars3 = createStarLayer(300, 2.5, 0xd29922, 1500);
    scene.add(stars1);
    scene.add(stars2);
    scene.add(stars3);

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

    // Create concentric subtle planetary orbital rings for modules
    moduleKeys.forEach((modKey, modIdx) => {
      const modAngle = (modIdx / Math.max(modCount, 1)) * Math.PI * 2;
      const modRadius = 240 + (modIdx % 2) * 45;
      const modCenter = new THREE.Vector3(
        Math.cos(modAngle) * modRadius,
        Math.sin(modIdx * 1.6) * 55 + ((modIdx % 3) - 1) * 35,
        Math.sin(modAngle) * modRadius
      );

      // Subsystem Ring Loop
      const ringGeo = new THREE.RingGeometry(65, 66, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3fb950,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.12,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(modCenter);
      ringMesh.rotation.x = Math.PI / 2;
      scene.add(ringMesh);

      const groupNodes = moduleGroups[modKey];
      groupNodes.forEach((node, nodeIdx) => {
        let nodePos: THREE.Vector3;
        const kind = node.data.kind;

        if (kind === "file" || kind === "module") {
          nodePos = modCenter.clone();
        } else {
          const subAngle = (nodeIdx / groupNodes.length) * Math.PI * 2;
          const subRadius = kind === "class" ? 38 : 68 + (nodeIdx % 3) * 14;
          nodePos = new THREE.Vector3(
            modCenter.x + Math.cos(subAngle) * subRadius + (Math.random() - 0.5) * 8,
            modCenter.y + Math.sin(subAngle) * (subRadius * 0.7) + (Math.random() - 0.5) * 10,
            modCenter.z + Math.sin(subAngle) * subRadius + (Math.random() - 0.5) * 8
          );
        }

        posMap.set(node.id, nodePos);

        const config = KIND_COLORS[kind] || { hex: 0x8b949e, str: "#8b949e", label: "SYMBOL", glow: 0x8b949e };
        const radius = kind === "file" || kind === "module" ? 9 : kind === "class" ? 6.5 : 4.5;

        // Core Glowing Celestial Sphere
        const sphereGeo = new THREE.SphereGeometry(radius, 32, 32);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: config.hex,
          emissive: config.hex,
          emissiveIntensity: 0.65,
          roughness: 0.2,
          metalness: 0.85,
        });

        const mesh = new THREE.Mesh(sphereGeo, sphereMat);
        mesh.position.copy(nodePos);
        mesh.userData = node.data;
        scene.add(mesh);
        meshMap.set(node.id, mesh);

        // Outer Additive Glow Halo
        const glowGeo = new THREE.SphereGeometry(radius * 1.55, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
          color: config.glow,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        mesh.add(glowMesh);

        // 3D Text Sprite Billboard
        const sprite = createTextSprite(node.data.label, config.str);
        sprite.position.set(nodePos.x, nodePos.y + radius + 8, nodePos.z);
        sprite.visible = showLabels;
        scene.add(sprite);
        sprites.push(sprite);
      });
    });

    posMapRef.current = posMap;
    nodeMeshMap.current = meshMap;
    spritesRef.current = sprites;

    // 8. 3D Curved Arc Edges with Moving Energy Particles
    const curves: THREE.QuadraticBezierCurve3[] = [];
    const particlePositions: Float32Array = new Float32Array(edges.length * 3);

    edges.forEach((edge, idx) => {
      const p1 = posMap.get(edge.source);
      const p2 = posMap.get(edge.target);
      if (!p1 || !p2) return;

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      mid.y += Math.min(dist * 0.2, 40);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      curves.push(curve);

      const curvePoints = curve.getPoints(24);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x58a6ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      // Initial particle position
      const p = curve.getPoint(0);
      particlePositions[idx * 3] = p.x;
      particlePositions[idx * 3 + 1] = p.y;
      particlePositions[idx * 3 + 2] = p.z;
    });

    // Particle System traveling on curves
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x58a6ff,
      size: 4,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 9. Animated Selection Halo Mesh
    const selRingGeo = new THREE.TorusGeometry(12, 0.8, 16, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff,
      transparent: true,
      opacity: 0.8,
    });
    const selRingMesh = new THREE.Mesh(selRingGeo, selRingMat);
    selRingMesh.visible = false;
    scene.add(selRingMesh);
    selectionRingRef.current = selRingMesh;

    // 10. Raycasting
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

        // Position selection ring
        const targetMesh = intersects[0].object as THREE.Mesh;
        selRingMesh.position.copy(targetMesh.position);
        selRingMesh.visible = true;
      }
    };

    renderer.domElement.addEventListener("mousemove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleClick);

    // 11. Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 12. Animation Loop with Particle Flow
    let animationFrameId: number;
    let progress = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate starfields
      stars1.rotation.y += 0.0001;
      stars2.rotation.y -= 0.00015;

      // Animate energy particles along curves
      const speed = particleSpeed === "fast" ? 0.008 : particleSpeed === "slow" ? 0.002 : 0.005;
      progress = (progress + speed) % 1;

      const posAttr = particleGeo.getAttribute("position") as THREE.BufferAttribute;
      curves.forEach((c, i) => {
        const pt = c.getPoint(progress);
        posAttr.setXYZ(i, pt.x, pt.y, pt.z);
      });
      posAttr.needsUpdate = true;

      // Spin selection ring
      if (selRingMesh.visible) {
        selRingMesh.rotation.x += 0.02;
        selRingMesh.rotation.y += 0.03;
      }

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
      stars1.geometry.dispose();
      stars2.geometry.dispose();
      stars3.geometry.dispose();
    };
  }, [nodes, edges, onNodeSelect, particleSpeed]);

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

  // Camera Presets
  const applyCameraPreset = (preset: "orbit" | "birdseye" | "core") => {
    setCameraPreset(preset);
    if (!cameraRef.current || !controlsRef.current) return;

    if (preset === "orbit") {
      cameraRef.current.position.set(0, 150, 480);
      controlsRef.current.target.set(0, 0, 0);
    } else if (preset === "birdseye") {
      cameraRef.current.position.set(0, 560, 0);
      controlsRef.current.target.set(0, 0, 0);
    } else if (preset === "core") {
      cameraRef.current.position.set(0, 40, 220);
      controlsRef.current.target.set(0, 0, 0);
    }
    controlsRef.current.update();
  };

  // Fly-to Searched Node in 3D
  const handleSearchFlyTo = (query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !cameraRef.current || !controlsRef.current) return;

    const q = query.toLowerCase();
    const matchedNode = nodes.find(
      (n) => n.data.label.toLowerCase().includes(q) || n.data.file_path?.toLowerCase().includes(q)
    );

    if (matchedNode) {
      const pos = posMapRef.current.get(matchedNode.id);
      if (pos) {
        controlsRef.current.target.copy(pos);
        cameraRef.current.position.set(pos.x + 40, pos.y + 30, pos.z + 80);
        controlsRef.current.update();
        onNodeSelect(matchedNode.data);

        if (selectionRingRef.current) {
          selectionRingRef.current.position.copy(pos);
          selectionRingRef.current.visible = true;
        }
      }
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
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* ===================================================================== */}
      {/* 3D COSMOS TOP BAR: SEARCH & FLY-TO + CAMERA PRESETS */}
      {/* ===================================================================== */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        {/* Floating 3D HUD Card */}
        <div className="w-64 rounded-xl bg-[#0a0a0a]/85 backdrop-blur-xl border border-[#222222] p-3.5 font-mono text-xs shadow-2xl space-y-3">
          {/* Header */}
          <div>
            <h3 className="text-xs font-bold text-[#f0f6fc] tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#58a6ff]" />
              3D Cosmos Engine
            </h3>
            <p className="text-[10px] text-[#8b949e] mt-0.5">3D cosmos knowledge graph</p>
          </div>

          <div className="h-[1px] bg-[#1f1f1f]" />

          {/* 3D Search & Fly-To */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b949e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchFlyTo(e.target.value)}
              placeholder="3D Search & Fly To..."
              className="w-full pl-7 pr-2 py-1 rounded bg-[#161616] border border-[#27272a] text-[11px] text-[#f0f6fc] placeholder-[#52525b] focus:outline-none focus:border-[#58a6ff]"
            />
          </div>

          {/* Auto-Orbit Toggle Switch */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#c9d1d9] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#8b949e]" />
              Auto-Orbit
            </span>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                autoRotate ? "bg-[#1f6feb]" : "bg-[#21262d]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  autoRotate ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 3D Labels Toggle Switch */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#c9d1d9] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8b949e]" />
              3D Labels
            </span>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                showLabels ? "bg-[#1f6feb]" : "bg-[#21262d]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  showLabels ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Zoom Stepper Control */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[#c9d1d9]">Zoom</span>
            <div className="flex items-center bg-[#161616] border border-[#27272a] rounded-md overflow-hidden">
              <button
                onClick={() => handleZoom("out")}
                className="px-2 py-1 text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#222222] transition"
                title="Zoom Out"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => applyCameraPreset("orbit")}
                className="px-2 py-1 text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#222222] border-x border-[#27272a] transition text-[10px]"
                title="Reset View"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => handleZoom("in")}
                className="px-2 py-1 text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#222222] transition"
                title="Zoom In"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Camera Presets Selector */}
        <div className="flex items-center gap-1 bg-[#0a0a0a]/85 backdrop-blur-xl border border-[#222222] p-1.5 rounded-lg font-mono text-xs shadow-2xl">
          <span className="text-[10px] text-[#8b949e] px-1.5 uppercase font-bold">Preset:</span>
          <button
            onClick={() => applyCameraPreset("orbit")}
            className={`px-2.5 py-1 rounded text-[11px] transition ${
              cameraPreset === "orbit"
                ? "bg-[#161616] text-[#58a6ff] border border-[#27272a] font-semibold"
                : "text-[#8b949e] hover:text-[#c9d1d9]"
            }`}
          >
            Constellation
          </button>
          <button
            onClick={() => applyCameraPreset("birdseye")}
            className={`px-2.5 py-1 rounded text-[11px] transition ${
              cameraPreset === "birdseye"
                ? "bg-[#161616] text-[#58a6ff] border border-[#27272a] font-semibold"
                : "text-[#8b949e] hover:text-[#c9d1d9]"
            }`}
          >
            Birdseye
          </button>
          <button
            onClick={() => applyCameraPreset("core")}
            className={`px-2.5 py-1 rounded text-[11px] transition ${
              cameraPreset === "core"
                ? "bg-[#161616] text-[#58a6ff] border border-[#27272a] font-semibold"
                : "text-[#8b949e] hover:text-[#c9d1d9]"
            }`}
          >
            Core Focus
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FLOATING 3D TELEMETRY PILL (Bottom Center) */}
      {/* ===================================================================== */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[#0a0a0a]/85 backdrop-blur-xl border border-[#222222] px-4 py-2 rounded-full font-mono text-[11px] shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-[#161616] border border-[#27272a] text-[#58a6ff] font-semibold text-[10px]">
            3D Telemetry Bar
          </span>
        </div>

        <div className="flex items-center gap-3 text-[#8b949e]">
          <span>
            Nodes: <strong className="text-[#f0f6fc]">{stats.nodeCount}</strong>
          </span>
          <span className="text-[#30363d]">•</span>
          <span>
            Links: <strong className="text-[#f0f6fc]">{stats.edgeCount}</strong>
          </span>
          <span className="text-[#30363d]">•</span>
          <span>
            Subsystems: <strong className="text-[#f0f6fc]">{stats.moduleCount}</strong>
          </span>
        </div>
      </div>

      {/* Hovered Node Floating Tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 right-4 z-20 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#27272a] p-3 rounded-lg font-mono text-xs text-white shadow-2xl pointer-events-none max-w-sm animate-in fade-in duration-100">
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
