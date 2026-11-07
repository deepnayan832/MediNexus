/**
 * Hero 3D Component
 * Interactive medical-themed 3D hero for MediNexus
 */

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { designTokens } from '../../design-tokens';
import { useBreakpoint } from '../../hooks/useScrollAnimations';

// Medical DNA Helix - represents genetics/precision medicine
function DNAHelix({ position = [0, 0, 0], scale = 1, speed = 0.5 }: { position?: [number, number, number]; scale?: number; speed?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += speed * 0.001 * delta;
      groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.3) * 0.1;
    }
  });

  // Create DNA helix geometry
  const createHelix = () => {
    const group = new THREE.Group();
    const radius = 0.8 * scale;
    const height = 4 * scale;
    const turns = 3;
    const pointsPerTurn = 20;
    const totalPoints = turns * pointsPerTurn;
    
    // Two strands
    const strandGeometry = new THREE.BufferGeometry();
    const strandPositions = new Float32Array(totalPoints * 3 * 2);
    const strandColors = new Float32Array(totalPoints * 3 * 2);
    
    for (let i = 0; i < totalPoints; i++) {
      const t = (i / totalPoints) * turns * Math.PI * 2;
      const y = (i / totalPoints) * height - height / 2;
      
      // Strand 1
      const x1 = Math.cos(t) * radius;
      const z1 = Math.sin(t) * radius;
      strandPositions[i * 6] = x1;
      strandPositions[i * 6 + 1] = y;
      strandPositions[i * 6 + 2] = z1;
      strandColors[i * 6] = 0.1;
      strandColors[i * 6 + 1] = 0.8;
      strandColors[i * 6 + 2] = 0.85;
      
      // Strand 2
      const x2 = Math.cos(t + Math.PI) * radius;
      const z2 = Math.sin(t + Math.PI) * radius;
      strandPositions[i * 6 + 3] = x2;
      strandPositions[i * 6 + 4] = y;
      strandPositions[i * 6 + 5] = z2;
      strandColors[i * 6 + 3] = 0.46;
      strandColors[i * 6 + 4] = 0.38;
      strandColors[i * 6 + 5] = 0.93;
    }
    
    strandGeometry.setAttribute('position', new THREE.BufferAttribute(strandPositions, 3));
    strandGeometry.setAttribute('color', new THREE.BufferAttribute(strandColors, 3));
    
    const strandMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
    });
    
    const strand1 = new THREE.Line(strandGeometry, strandMaterial);
    group.add(strand1);
    
    // Base pairs (rungs)
    const rungGeometry = new THREE.BufferGeometry();
    const rungPositions = new Float32Array(turns * 4 * 3 * 2);
    const rungColors = new Float32Array(turns * 4 * 3 * 2);
    
    for (let turn = 0; turn < turns; turn++) {
      for (let pair = 0; pair < 4; pair++) {
        const t = (turn + pair / 4) * Math.PI * 2;
        const y = ((turn + pair / 4) / turns) * height - height / 2;
        const pairIndex = turn * 4 + pair;
        
        const x1 = Math.cos(t) * radius;
        const z1 = Math.sin(t) * radius;
        const x2 = Math.cos(t + Math.PI) * radius;
        const z2 = Math.sin(t + Math.PI) * radius;
        
        rungPositions[pairIndex * 6] = x1;
        rungPositions[pairIndex * 6 + 1] = y;
        rungPositions[pairIndex * 6 + 2] = z1;
        rungPositions[pairIndex * 6 + 3] = x2;
        rungPositions[pairIndex * 6 + 4] = y;
        rungPositions[pairIndex * 6 + 5] = z2;
        
        const hue = (pair / 4) * 0.3 + 0.5; // Cyan to purple
        const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
        rungColors[pairIndex * 6] = color.r;
        rungColors[pairIndex * 6 + 1] = color.g;
        rungColors[pairIndex * 6 + 2] = color.b;
        rungColors[pairIndex * 6 + 3] = color.r;
        rungColors[pairIndex * 6 + 4] = color.g;
        rungColors[pairIndex * 6 + 5] = color.b;
      }
    }
    
    rungGeometry.setAttribute('position', new THREE.BufferAttribute(rungPositions, 3));
    rungGeometry.setAttribute('color', new THREE.BufferAttribute(rungColors, 3));
    
    const rungMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      linewidth: 2,
    });
    
    const rungs = new THREE.LineSegments(rungGeometry, rungMaterial);
    group.add(rungs);
    
    // Glowing particles at base pairs
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(turns * 4 * 3);
    const particleSizes = new Float32Array(turns * 4);
    const particleColors = new Float32Array(turns * 4 * 3);
    
    for (let turn = 0; turn < turns; turn++) {
      for (let pair = 0; pair < 4; pair++) {
        const t = (turn + pair / 4) * Math.PI * 2;
        const y = ((turn + pair / 4) / turns) * height - height / 2;
        const pairIndex = turn * 4 + pair;
        
        const x = Math.cos(t) * radius * 0.5;
        const z = Math.sin(t) * radius * 0.5;
        
        particlePositions[pairIndex * 3] = x;
        particlePositions[pairIndex * 3 + 1] = y;
        particlePositions[pairIndex * 3 + 2] = z;
        particleSizes[pairIndex] = 8 * scale;
        
        const hue = (pair / 4) * 0.3 + 0.5;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
        particleColors[pairIndex * 3] = color.r;
        particleColors[pairIndex * 3 + 1] = color.g;
        particleColors[pairIndex * 3 + 2] = color.b;
      }
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.08 * scale,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);
    
    // Animate particles
    useFrame((state) => {
      const time = state.clock.getElapsedTime();
      const positions = particleGeometry.attributes.position.array as Float32Array;
      const sizes = particleGeometry.attributes.size.array as Float32Array;
      
      for (let i = 0; i < turns * 4; i++) {
        const baseSize = sizes[i];
        const pulse = Math.sin(time * 3 + i * 0.5) * 0.3 + 1;
        // Update size via material would require shader, so we'll use scale on group
      }
    });
    
    return group;
  };

  useEffect(() => {
    if (groupRef.current) {
      const helix = createHelix();
      groupRef.current.add(helix);
    }
  }, []);

  return (
    <group ref={groupRef} position={position}>
      <Html
        transform
        style={{
          pointerEvents: 'none',
        }}
      >
        <div style={{ opacity: 0 }} />
      </Html>
    </group>
  );
}

// Medical Network Visualization - represents connected care
function MedicalNetwork({ position = [0, 0, 0], scale = 1 }: { position?: [number, number, number]; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Mesh[]>([]);
  const linesRef = useRef<THREE.Line[]>([]);
  
    useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    
    if (groupRef.current) {
        groupRef.current.rotation.y += 0.0003 * delta;
      groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.05;
    }
    
    // Pulse nodes
    nodesRef.current.forEach((node, i) => {
      const pulse = Math.sin(time * 2 + i * 0.8) * 0.15 + 1;
      node.scale.setScalar(pulse * scale);
      
      // Animate material opacity
      if (node.material instanceof THREE.MeshBasicMaterial) {
        node.material.opacity = 0.6 + Math.sin(time * 3 + i) * 0.2;
      }
    });
    
    // Animate line opacity
    linesRef.current.forEach((line, i) => {
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.opacity = 0.2 + Math.sin(time * 1.5 + i * 0.5) * 0.15;
      }
    });
  });

  useEffect(() => {
    if (!groupRef.current) return;
    
    const group = groupRef.current;
    const nodeCount = 12;
    const radius = 2.5 * scale;
    
    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      const geometry = new THREE.SphereGeometry(0.12 * scale, 16, 16);
      const hue = (i / nodeCount) * 0.3 + 0.5;
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      nodesRef.current.push(mesh);
      group.add(mesh);
      
      // Add glow sprite
      const spriteMaterial = new THREE.SpriteMaterial({
        color: new THREE.Color().setHSL(hue, 0.8, 0.6),
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0.4 * scale, 0.4 * scale, 0.4 * scale);
      sprite.position.set(x, y, z);
      group.add(sprite);
    }
    
    // Create connections (lines between nearby nodes)
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodesRef.current[i].position.distanceTo(nodesRef.current[j].position);
        if (dist < 3.5 * scale) {
          linePositions.push(
            nodesRef.current[i].position.x,
            nodesRef.current[i].position.y,
            nodesRef.current[i].position.z,
            nodesRef.current[j].position.x,
            nodesRef.current[j].position.y,
            nodesRef.current[j].position.z
          );
        }
      }
    }
    
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x19c5d1,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    linesRef.current.push(lines);
    group.add(lines);
  }, [scale]);

  return <group ref={groupRef} position={position} />;
}

// Floating Medical Icons - subtle ambient elements
function FloatingIcons({ count = 8, radius = 4, speed = 0.2 }: { count?: number; radius?: number; speed?: number }) {
  const iconsRef = useRef<THREE.Mesh[]>([]);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    iconsRef.current.forEach((icon, i) => {
      const angle = time * speed + (i / iconsRef.current.length) * Math.PI * 2;
      const yOffset = Math.sin(time * 0.7 + i) * 0.3;
      
      icon.position.x = Math.cos(angle) * radius;
      icon.position.z = Math.sin(angle) * radius;
      icon.position.y = yOffset;
      icon.rotation.y = time * 0.3;
      icon.rotation.x = Math.sin(time + i) * 0.2;
    });
  });

  useEffect(() => {
    // Icons are created in the component body
  }, []);

  const iconShapes = [
    // Heart
    () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.15);
      shape.bezierCurveTo(0.15, 0.25, 0.25, 0.05, 0, -0.15);
      shape.bezierCurveTo(-0.25, 0.05, -0.15, 0.25, 0, 0.15);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    },
    // Cross
    () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.03, 0.15);
      shape.lineTo(0.03, 0.15);
      shape.lineTo(0.03, 0.03);
      shape.lineTo(0.15, 0.03);
      shape.lineTo(0.15, -0.03);
      shape.lineTo(0.03, -0.03);
      shape.lineTo(0.03, -0.15);
      shape.lineTo(-0.03, -0.15);
      shape.lineTo(-0.03, -0.03);
      shape.lineTo(-0.15, -0.03);
      shape.lineTo(-0.15, 0.03);
      shape.lineTo(-0.03, 0.03);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    },
    // Pill
    () => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 0.1, 0, Math.PI * 2);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.03, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
    },
    // Brain hemisphere
    () => {
      const shape = new THREE.Shape();
      shape.moveTo(-0.12, 0);
      shape.bezierCurveTo(-0.12, 0.12, 0, 0.15, 0.12, 0.05);
      shape.bezierCurveTo(0.12, -0.05, 0, -0.15, -0.12, 0);
      return new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    },
  ];

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const shapeFn = iconShapes[i % iconShapes.length];
        const geometry = shapeFn();
        const hue = (i / count) * 0.3 + 0.5;
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(hue, 0.7, 0.55),
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        
        return (
          <mesh
            key={i}
            ref={(el) => { if (el) iconsRef.current[i] = el; }}
            geometry={geometry}
            material={material}
            scale={0.5}
          />
        );
      })}
    </group>
  );
}

// Main Hero 3D Scene
export function Hero3DScene({ 
  className = '', 
  isDark = true,
  onLoad 
}: { 
  className?: string; 
  isDark?: boolean;
  onLoad?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
    const isTablet = breakpoint === 'md';

  useEffect(() => {
    setMounted(true);
    onLoad?.();
  }, [onLoad]);

  if (!mounted) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '500px',
          background: isDark ? designTokens.colors.gradients.hero : designTokens.colors.gradients.heroLight,
        }}
        aria-hidden="true"
      />
    );
  }

  // Simplify 3D scene on mobile/tablet
  const dnaScale = isMobile ? 0.8 : isTablet ? 1.0 : 1.2;
  const networkScale = isMobile ? 0.7 : isTablet ? 0.9 : 1.0;
  const floatingIconsCount = isMobile ? 4 : isTablet ? 6 : 10;
  const starsCount = isMobile ? 500 : isTablet ? 1000 : 2000;
  const enableAutoRotate = !isMobile;

  return (
      <div className={className} style={{ width: '100%', height: '100%', minHeight: '500px' }}>
        <Canvas
          ref={canvasRef}
          camera={{
            position: [0, 0, 8],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
          }}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
          onCreated={({ gl, scene }) => {
            // Set fog on scene creation
            scene.fog = new THREE.Fog(
              isDark ? designTokens.threeD.scene.fogColor : designTokens.threeD.scene.fogColorLight,
              5,
              30
            );
          }}
        >
          {/* Ambient lighting */}
        <ambientLight 
          intensity={designTokens.threeD.lighting.ambientIntensity} 
          color={designTokens.threeD.lighting.ambientColor} 
        />
        
        {/* Main directional light */}
        <directionalLight
          position={[5, 10, 7]}
          intensity={designTokens.threeD.lighting.directionalIntensity}
          color={designTokens.threeD.lighting.directionalColor}
          castShadow
        />
        
        {/* Accent lights */}
        <pointLight
          position={[-5, 3, 5]}
          intensity={designTokens.threeD.lighting.pointIntensity}
          color={designTokens.threeD.lighting.pointColor}
          distance={20}
          decay={2}
        />
        <pointLight
          position={[5, -3, -5]}
          intensity={designTokens.threeD.lighting.pointIntensity * 0.5}
          color={designTokens.threeD.lighting.spotColor}
          distance={20}
          decay={2}
        />
        
        {/* Stars background */}
                <Stars
                  radius={50}
                  count={starsCount}
                />
        
        {/* Main DNA Helix - centerpiece */}
                <DNAHelix position={[0, 0, 0]} scale={dnaScale} speed={0.3} />
        
        {/* Medical Network - surrounding */}
                <MedicalNetwork position={[0, 0, 0]} scale={networkScale} />
        
        {/* Floating ambient icons */}
                <FloatingIcons count={floatingIconsCount} radius={5} speed={0.15} />
        
        {/* Contact shadows for grounding */}
        <ContactShadows 
          opacity={isDark ? 0.15 : 0.08} 
          scale={8} 
          blur={2}
          position={[0, -3, 0]}
        />
        
        {/* Orbit controls for interaction */}
        <OrbitControls
          enableDamping={designTokens.threeD.interaction.enableDamping}
          dampingFactor={designTokens.threeD.interaction.dampingFactor}
          rotateSpeed={designTokens.threeD.interaction.rotateSpeed}
          zoomSpeed={designTokens.threeD.interaction.zoomSpeed}
          panSpeed={designTokens.threeD.interaction.panSpeed}
          enablePan={false}
          minZoom={0.5}
          maxZoom={3}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI * 2 / 3}
                  autoRotate={enableAutoRotate}
          autoRotateSpeed={0.2}
        />
      </Canvas>
    </div>
  );
}

// Fallback static hero for reduced motion / no WebGL
export function Hero3DFallback({ 
  className = '', 
  isDark = true 
}: { 
  className?: string; 
  isDark?: boolean;
}) {
  return (
    <div 
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '500px',
        background: isDark 
          ? designTokens.colors.gradients.hero 
          : designTokens.colors.gradients.heroLight,
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* CSS-based animated background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(25, 197, 209, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(117, 97, 238, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(55, 211, 174, 0.1) 0%, transparent 70%)
        `,
        animation: 'float 20s ease-in-out infinite',
      }} />
      
      {/* DNA helix SVG animation */}
      <svg 
        viewBox="0 0 200 400" 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px',
          height: '600px',
          opacity: 0.3,
        }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="strand1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#19c5d1" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#7561ee" stopOpacity="0.8"/>
          </linearGradient>
          <linearGradient id="strand2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7561ee" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#37d3ae" stopOpacity="0.6"/>
          </linearGradient>
          <animate 
            attributeName="opacity" 
            values="0.3;0.6;0.3" 
            dur="4s" 
            repeatCount="indefinite" 
          />
        </defs>
        
        {/* Strand 1 */}
        <path 
          d="M100,20 
             Q130,60 100,100 
             Q70,140 100,180 
             Q130,220 100,260 
             Q70,300 100,340 
             Q130,380 100,380"
          fill="none" 
          stroke="url(#strand1)" 
          strokeWidth="3"
        >
          <animateTransform 
            attributeName="transform" 
            type="rotate" 
            from="0 100 200" 
            to="360 100 200" 
            dur="20s" 
            repeatCount="indefinite" 
          />
        </path>
        
        {/* Strand 2 */}
        <path 
          d="M100,20 
             Q70,60 100,100 
             Q130,140 100,180 
             Q70,220 100,260 
             Q130,300 100,340 
             Q70,380 100,380"
          fill="none" 
          stroke="url(#strand2)" 
          strokeWidth="2"
        >
          <animateTransform 
            attributeName="transform" 
            type="rotate" 
            from="360 100 200" 
            to="0 100 200" 
            dur="20s" 
            repeatCount="indefinite" 
          />
        </path>
        
        {/* Base pairs */}
        <g stroke="url(#strand1)" strokeWidth="1.5" opacity="0.5">
          {[60, 100, 140, 180, 220, 260, 300, 340].map((y, i) => (
            <line 
              key={i}
              x1="70" 
              y1={y} 
              x2="130" 
              y2={y}
              strokeDasharray="4,4"
            >
              <animate 
                attributeName="strokeDashoffset" 
                values="0;8;0" 
                dur="3s" 
                repeatCount="indefinite" 
                begin={`${i * 0.2}s`} 
              />
            </line>
          ))}
        </g>
        
        {/* Glowing particles at intersections */}
        <g>
          {[60, 100, 140, 180, 220, 260, 300, 340].map((y, i) => (
            <circle 
              key={i}
              cx="100" 
              cy={y} 
              r="4"
              fill="#19c5d1"
              opacity="0.7"
            >
              <animate 
                attributeName="r" 
                values="3;6;3" 
                dur="2s" 
                repeatCount="indefinite" 
                begin={`${i * 0.15}s`} 
              />
              <animate 
                attributeName="opacity" 
                values="0.4;0.8;0.4" 
                dur="2s" 
                repeatCount="indefinite" 
                begin={`${i * 0.15}s`} 
              />
            </circle>
          ))}
        </g>
      </svg>
      
            <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, -20px) rotate(1deg); }
          50% { transform: translate(-10px, 30px) rotate(-1deg); }
          75% { transform: translate(30px, 10px) rotate(0.5deg); }
        }
      `}</style>
    </div>
  );
}

export default Hero3DScene;