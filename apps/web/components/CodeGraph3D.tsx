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
  Search,
  ExternalLink,
  Zap,
  Box,
  HelpCircle,
  Maximize2,
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
  onNodeSelect: (nodeData: NodeData | null) => void;
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

  ctx.strokeStyle = "rgba(88, 166, 255, 0.32)";
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
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [cameraPreset, setCameraPreset] = useState<"orbit" | "birdseye" | "core">("orbit");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>("all");
  const [activeFocusedNode, setActiveFocusedNode] = useState<NodeData | null>(null);

  // References for Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const hitMeshesRef = useRef<THREE.Mesh[]>([]);
  const posMapRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const selectionRingRef = useRef<THREE.Mesh | null>(null);

  // Smooth camera glide animation state
  const isGlidingRef = useRef(false);
  const glideTargetPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const glideTargetLookAt = useRef<THREE.Vector3>(new THREE.Vector3());
  const glideStartTime = useRef<number>(0);
  const glideStartCamPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const glideStartTarget = useRef<THREE.Vector3>(new THREE.Vector3());

  // Subsystems list for quick surfing
  const subsystems = useMemo(() => {
    const mods = Array.from(
      new Set(nodes.map((n) => n.data.file_path?.split("/")[0] || "root"))
    );
    return mods.slice(0, 6);
  }, [nodes]);

  // Telemetry Metrics
  const stats = useMemo(() => {
    const modules = new Set(nodes.map((n) => n.data.file_path?.split("/")[0] || "root")).size;
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      moduleCount: modules,
    };
  }, [nodes, edges]);

  // Trigger smooth glide to position
  const triggerGlide = useCallback((targetCam: THREE.Vector3, targetLook: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    glideStartCamPos.current.copy(cameraRef.current.position);
    glideStartTarget.current.copy(controlsRef.current.target);
    glideTargetPos.current.copy(targetCam);
    glideTargetLookAt.current.copy(targetLook);
    glideStartTime.current = performance.now();
    isGlidingRef.current = true;
  }, []);

  // Setup High-Performance Three.js Scene
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

    // 3. Renderer with power-preference and clamped pixel ratio
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.maxDistance = 2000;
    controls.minDistance = 20;
    controlsRef.current = controls;

    // Stop glide when user manually interacts
    controls.addEventListener("start", () => {
      isGlidingRef.current = false;
    });

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x58a6ff, 2.0, 1600);
    cyanLight.position.set(250, 350, 300);
    scene.add(cyanLight);

    const amberLight = new THREE.PointLight(0xd29922, 1.6, 1600);
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

    const stars1 = createStarLayer(800, 2.0, 0xd0e8ff, 2500);
    const stars2 = createStarLayer(400, 3.0, 0x58a6ff, 1800);
    scene.add(stars1);
    scene.add(stars2);

    // 7. Shared Geometries and Materials for 60fps performance
    const moduleGeo = new THREE.SphereGeometry(9, 24, 24);
    const classGeo = new THREE.SphereGeometry(6.5, 20, 20);
    const functionGeo = new THREE.SphereGeometry(4.5, 16, 16);
    const defaultGeo = new THREE.SphereGeometry(4.0, 14, 14);
    const hitGeo = new THREE.SphereGeometry(18, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    const sharedMaterials: Record<string, { sphereMat: THREE.MeshStandardMaterial; glowMat: THREE.MeshBasicMaterial }> = {};
    Object.entries(KIND_COLORS).forEach(([kind, conf]) => {
      sharedMaterials[kind] = {
        sphereMat: new THREE.MeshStandardMaterial({
          color: conf.hex,
          emissive: conf.hex,
          emissiveIntensity: 0.65,
          roughness: 0.2,
          metalness: 0.85,
        }),
        glowMat: new THREE.MeshBasicMaterial({
          color: conf.glow,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      };
    });

    // 8. Calculate 3D Orbital Positions
    const posMap = new Map<string, THREE.Vector3>();
    const hitMeshes: THREE.Mesh[] = [];
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
      const modRadius = 240 + (modIdx % 2) * 45;
      const modCenter = new THREE.Vector3(
        Math.cos(modAngle) * modRadius,
        Math.sin(modIdx * 1.6) * 55 + ((modIdx % 3) - 1) * 35,
        Math.sin(modAngle) * modRadius
      );

      // Subsystem Ring Loop
      const ringGeo = new THREE.RingGeometry(65, 66, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3fb950,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.15,
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
            modCenter.x + Math.cos(subAngle) * subRadius,
            modCenter.y + Math.sin(subAngle) * (subRadius * 0.7),
            modCenter.z + Math.sin(subAngle) * subRadius
          );
        }

        posMap.set(node.id, nodePos);

        const config = KIND_COLORS[kind] || { hex: 0x8b949e, str: "#8b949e", label: "SYMBOL", glow: 0x8b949e };
        const geo = kind === "file" || kind === "module" ? moduleGeo : kind === "class" ? classGeo : kind === "function" ? functionGeo : defaultGeo;
        const mats = sharedMaterials[kind] || sharedMaterials["function"];

        // Core Sphere
        const mesh = new THREE.Mesh(geo, mats.sphereMat);
        mesh.position.copy(nodePos);
        scene.add(mesh);

        // Outer Glow Halo
        const glowRadius = (kind === "file" || kind === "module" ? 9 : kind === "class" ? 6.5 : 4.5) * 1.55;
        const glowGeo = new THREE.SphereGeometry(glowRadius, 12, 12);
        const glowMesh = new THREE.Mesh(glowGeo, mats.glowMat);
        mesh.add(glowMesh);

        // Invisible Fast Hit Sphere
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.copy(nodePos);
        hitMesh.userData = { ...node.data, id: node.id };
        scene.add(hitMesh);
        hitMeshes.push(hitMesh);

        // 3D Text Sprite Billboard
        const sprite = createTextSprite(node.data.label, config.str);
        sprite.position.set(nodePos.x, nodePos.y + glowRadius + 6, nodePos.z);
        sprite.visible = showLabels;
        scene.add(sprite);
        sprites.push(sprite);
      });
    });

    posMapRef.current = posMap;
    hitMeshesRef.current = hitMeshes;
    spritesRef.current = sprites;

    // 9. Pre-Sampled 3D Curved Arc Edges with Instant Lookup
    const CURVE_SAMPLES = 40;
    const sampledCurves: THREE.Vector3[][] = [];
    const particlePositions: Float32Array = new Float32Array(edges.length * 3);

    edges.forEach((edge, idx) => {
      const p1 = posMap.get(edge.source);
      const p2 = posMap.get(edge.target);
      if (!p1 || !p2) return;

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dist = p1.distanceTo(p2);
      mid.y += Math.min(dist * 0.2, 40);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const curvePoints = curve.getPoints(20);
      sampledCurves.push(curve.getPoints(CURVE_SAMPLES));

      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x58a6ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      const p = curvePoints[0];
      particlePositions[idx * 3] = p.x;
      particlePositions[idx * 3 + 1] = p.y;
      particlePositions[idx * 3 + 2] = p.z;
    });

    // Fast Particle System
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

    // 10. Animated Selection Halo Mesh
    const selRingGeo = new THREE.TorusGeometry(14, 1.0, 16, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff,
      transparent: true,
      opacity: 0.85,
    });
    const selRingMesh = new THREE.Mesh(selRingGeo, selRingMat);
    selRingMesh.visible = false;
    scene.add(selRingMesh);
    selectionRingRef.current = selRingMesh;

    // 11. Throttled Pointer-based Raycasting (Zero Lag)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let currentHoveredId: string | null = null;

    const getRaycastHit = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(hitMeshes, false);
      return intersects.length > 0 ? (intersects[0].object.userData as NodeData) : null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const hitData = getRaycastHit(e.clientX, e.clientY);
      const hitId = hitData ? (hitData as any).id : null;

      if (hitId !== currentHoveredId) {
        currentHoveredId = hitId;
        if (hitData) {
          container.style.cursor = "pointer";
          setHoveredNode(hitData);
        } else {
          container.style.cursor = "grab";
          setHoveredNode(null);
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 8) return; // User was dragging/orbiting

      const hitData = getRaycastHit(e.clientX, e.clientY);
      if (hitData) {
        onNodeSelect(hitData);
        setActiveFocusedNode(hitData);

        const pos = posMap.get((hitData as any).id);
        if (pos) {
          triggerGlide(
            new THREE.Vector3(pos.x + 40, pos.y + 30, pos.z + 85),
            pos.clone()
          );

          selRingMesh.position.copy(pos);
          selRingMesh.visible = true;
        }
      } else {
        if (selRingMesh.visible) {
          selRingMesh.visible = false;
        }
        onNodeSelect(null);
        setActiveFocusedNode(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove, { passive: true });
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 12. 60 FPS Ultra-Smooth Animation Loop
    let animationFrameId: number;
    let frameStep = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      stars1.rotation.y += 0.0001;
      stars2.rotation.y -= 0.00015;

      frameStep = (frameStep + 1) % CURVE_SAMPLES;
      const posAttr = particleGeo.getAttribute("position") as THREE.BufferAttribute;
      
      if (sampledCurves.length > 0) {
        for (let i = 0; i < sampledCurves.length; i++) {
          const pt = sampledCurves[i][frameStep];
          if (pt) {
            posAttr.setXYZ(i, pt.x, pt.y, pt.z);
          }
        }
        posAttr.needsUpdate = true;
      }

      // Smooth camera glide
      if (isGlidingRef.current) {
        const elapsed = (performance.now() - glideStartTime.current) / 650;
        if (elapsed >= 1.0) {
          camera.position.copy(glideTargetPos.current);
          controls.target.copy(glideTargetLookAt.current);
          isGlidingRef.current = false;
        } else {
          const t = 1 - Math.pow(1 - elapsed, 3);
          camera.position.lerpVectors(glideStartCamPos.current, glideTargetPos.current, t);
          controls.target.lerpVectors(glideStartTarget.current, glideTargetLookAt.current, t);
        }
      }

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
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.dispose();
      stars1.geometry.dispose();
      stars2.geometry.dispose();
    };
  }, [nodes, edges, autoRotate, showLabels, onNodeSelect, triggerGlide]);

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

  // Focus and Glide on external node selection (e.g. from Search dropdown)
  useEffect(() => {
    if (selectedNodeId && posMapRef.current && cameraRef.current && controlsRef.current) {
      const pos = posMapRef.current.get(selectedNodeId);
      if (pos) {
        triggerGlide(
          new THREE.Vector3(pos.x + 40, pos.y + 30, pos.z + 85),
          pos.clone()
        );
        if (selectionRingRef.current) {
          selectionRingRef.current.position.copy(pos);
          selectionRingRef.current.visible = true;
        }
      }
    }
  }, [selectedNodeId, triggerGlide]);

  // Camera Presets
  const applyCameraPreset = (preset: "orbit" | "birdseye" | "core") => {
    setCameraPreset(preset);
    setActiveFocusedNode(null);
    if (selectionRingRef.current) selectionRingRef.current.visible = false;

    if (preset === "orbit") {
      triggerGlide(new THREE.Vector3(0, 150, 480), new THREE.Vector3(0, 0, 0));
    } else if (preset === "birdseye") {
      triggerGlide(new THREE.Vector3(0, 560, 0), new THREE.Vector3(0, 0, 0));
    } else if (preset === "core") {
      triggerGlide(new THREE.Vector3(0, 40, 220), new THREE.Vector3(0, 0, 0));
    }
  };

  // Fly-to Searched Node in 3D
  const handleSearchFlyTo = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return;

    const q = query.toLowerCase();
    const matchedNode = nodes.find(
      (n) => n.data.label.toLowerCase().includes(q) || n.data.file_path?.toLowerCase().includes(q)
    );

    if (matchedNode) {
      const pos = posMapRef.current.get(matchedNode.id);
      if (pos) {
        onNodeSelect(matchedNode.data);
        setActiveFocusedNode(matchedNode.data);

        triggerGlide(new THREE.Vector3(pos.x + 40, pos.y + 30, pos.z + 85), pos.clone());

        if (selectionRingRef.current) {
          selectionRingRef.current.position.copy(pos);
          selectionRingRef.current.visible = true;
        }
      }
    }
  };

  // Subsystem Surfer - Glide to selected module cluster
  const handleFlyToSubsystem = (subsystemName: string) => {
    setSelectedSubsystem(subsystemName);
    const modNode = nodes.find((n) => (n.data.file_path || "").startsWith(subsystemName));
    if (modNode) {
      const pos = posMapRef.current.get(modNode.id);
      if (pos) {
        onNodeSelect(modNode.data);
        setActiveFocusedNode(modNode.data);

        triggerGlide(new THREE.Vector3(pos.x + 50, pos.y + 40, pos.z + 100), pos.clone());

        if (selectionRingRef.current) {
          selectionRingRef.current.position.copy(pos);
          selectionRingRef.current.visible = true;
        }
      }
    }
  };

  const handleZoom = (direction: "in" | "out") => {
    if (cameraRef.current && controlsRef.current) {
      const factor = direction === "in" ? 0.75 : 1.3;
      const targetPos = cameraRef.current.position.clone().multiplyScalar(factor);
      triggerGlide(targetPos, controlsRef.current.target.clone());
    }
  };

  const handleResetOrbit = () => {
    setActiveFocusedNode(null);
    if (selectionRingRef.current) selectionRingRef.current.visible = false;
    triggerGlide(new THREE.Vector3(0, 150, 480), new THREE.Vector3(0, 0, 0));
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#f0f6fc] tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#58a6ff]" />
                3D Cosmos Engine
              </h3>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                {activeFocusedNode ? `Focused: ${activeFocusedNode.label}` : "Interactive 3D Galaxy"}
              </p>
            </div>
            {activeFocusedNode && (
              <button
                onClick={handleResetOrbit}
                className="px-1.5 py-0.5 rounded text-[10px] bg-[#161616] hover:bg-[#222222] text-[#58a6ff] border border-[#27272a] transition"
                title="Reset to full cosmos view"
              >
                Reset
              </button>
            )}
          </div>

          <div className="h-[1px] bg-[#1f1f1f]" />

          {/* 3D Search & Fly-To */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b949e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchFlyTo(e.target.value)}
              placeholder="3D Search & Glide To..."
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
                onClick={handleResetOrbit}
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
              cameraPreset === "orbit" && !activeFocusedNode
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
      {/* SUBSYSTEM QUICK-SURFING PILLS (Top Right) */}
      {/* ===================================================================== */}
      {subsystems.length > 0 && (
        <div className="absolute top-4 right-4 z-20 hidden xl:flex items-center gap-1.5 bg-[#0a0a0a]/85 backdrop-blur-xl border border-[#222222] p-1.5 rounded-lg font-mono text-[11px] shadow-2xl">
          <span className="text-[10px] text-[#8b949e] px-1.5 uppercase font-bold">Surf Subsystem:</span>
          {subsystems.map((sub) => (
            <button
              key={sub}
              onClick={() => handleFlyToSubsystem(sub)}
              className={`px-2 py-1 rounded transition text-[10px] truncate max-w-[100px] ${
                selectedSubsystem === sub
                  ? "bg-[#161616] text-[#3fb950] border border-[#3fb950]/30 font-semibold"
                  : "text-[#c9d1d9] hover:bg-[#161616] border border-transparent"
              }`}
              title={`Glide to ${sub}`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

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
        <div className="absolute top-20 right-4 z-20 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#27272a] p-3 rounded-lg font-mono text-xs text-white shadow-2xl pointer-events-none max-w-sm animate-in fade-in duration-100">
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
