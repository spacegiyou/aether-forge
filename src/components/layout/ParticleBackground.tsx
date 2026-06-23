"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { generateParticlePositions } from "@/lib/particles/generate-positions";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/** Simple cosmic particle field — Three.js via R3F */
function Particles({
  positions,
  animate,
}: {
  positions: Float32Array;
  animate: boolean;
}) {
  const ref = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (!animate || !ref.current) return;
    ref.current.rotation.y += delta * 0.02;
    ref.current.rotation.x += delta * 0.005;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#22d3ee" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export function ParticleBackground() {
  // Lazy init — positions generated once, outside render path (A1)
  const [positions] = useState(() => generateParticlePositions(1200));
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return (
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-30 dark:opacity-40 cosmic-bg"
        data-testid="particle-canvas"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 dark:opacity-60" data-testid="particle-canvas">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.2} />
        <Particles positions={positions} animate={!reducedMotion} />
      </Canvas>
    </div>
  );
}