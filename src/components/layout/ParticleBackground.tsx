"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Simple cosmic particle field — Three.js via R3F */
function Particles({ count = 1200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
      ref.current.rotation.x += delta * 0.005;
    }
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
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 dark:opacity-60" data-testid="particle-canvas">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.2} />
        <Particles />
      </Canvas>
    </div>
  );
}