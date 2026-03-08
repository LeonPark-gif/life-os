
import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';


// --- Configuration ---
const PARTICLE_COUNT = 4000;
const PARTICLE_SIZE = 0.05;
const MORPH_SPEED = 0.03;
const MOUSE_INFLUENCE = 0.5;

type ShapeType = 'sphere' | 'cube' | 'terrain' | 'ring';

// --- Shape Generators ---

function getSpherePoints(count: number, radius: number = 2) {
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        points[i * 3] = radius * Math.cos(theta) * Math.sin(phi);
        points[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
        points[i * 3 + 2] = radius * Math.cos(phi);
    }
    return points;
}

function getCubePoints(count: number, size: number = 3) {
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        points[i * 3] = (Math.random() - 0.5) * size;
        points[i * 3 + 1] = (Math.random() - 0.5) * size;
        points[i * 3 + 2] = (Math.random() - 0.5) * size;
    }
    return points;
}

function getTerrainPoints(count: number, width: number = 8, height: number = 8) {
    const points = new Float32Array(count * 3);
    const complex = Math.sqrt(count);
    for (let i = 0; i < count; i++) {
        const x = (i % complex) / complex * width - width / 2;
        const z = Math.floor(i / complex) / complex * height - height / 2;
        // Simple noise approximation: sin/cos waves
        const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 1.5 - 2;

        points[i * 3] = x + (Math.random() - 0.5) * 0.2; // Jitter
        points[i * 3 + 1] = y + (Math.random() - 0.5) * 0.2;
        points[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
    }
    return points;
}

function getRingPoints(count: number, radius: number = 3, tube: number = 0.4) {
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const p = Math.random() * Math.PI * 2;
        // Torus math
        const x = (radius + tube * Math.cos(p)) * Math.cos(t);
        const y = (radius + tube * Math.cos(p)) * Math.sin(t);
        const z = tube * Math.sin(p);
        points[i * 3] = x;
        points[i * 3 + 1] = y; // Rotated to face camera? logic
        points[i * 3 + 2] = z;
    }
    return points;
}

// --- Component ---

function Particles({ shape }: { shape: ShapeType }) {
    const pointsRef = useRef<THREE.Points>(null);
    const { viewport, mouse } = useThree();

    // Data buffers
    const [positions] = useState<Float32Array>(() => getSpherePoints(PARTICLE_COUNT));

    // Target Shapes Cache
    const shapes = useMemo(() => ({
        sphere: getSpherePoints(PARTICLE_COUNT),
        cube: getCubePoints(PARTICLE_COUNT),
        terrain: getTerrainPoints(PARTICLE_COUNT),
        ring: getRingPoints(PARTICLE_COUNT)
    }), []);

    // Current Target
    const targetRef = useRef<Float32Array>(shapes.sphere);

    // Update target when prop changes
    useEffect(() => {
        targetRef.current = shapes[shape];
    }, [shape, shapes]);

    useFrame((state) => {
        if (!pointsRef.current) return;

        const positionsAttribute = pointsRef.current.geometry.attributes.position;
        const currentPositions = positionsAttribute.array as Float32Array;
        const targetPositions = targetRef.current;
        const time = state.clock.getElapsedTime();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const idx = i * 3;

            // 1. Morph Logic (Move to target)
            currentPositions[idx] += (targetPositions[idx] - currentPositions[idx]) * MORPH_SPEED;
            currentPositions[idx + 1] += (targetPositions[idx + 1] - currentPositions[idx + 1]) * MORPH_SPEED;
            currentPositions[idx + 2] += (targetPositions[idx + 2] - currentPositions[idx + 2]) * MORPH_SPEED;

            // 2. "Life" / Breathing Logic (Noise)
            // Use time and index to create unique offsets
            // Simple sine wave jitter
            // const noise = 0.02 * Math.sin(time * 2 + i * 0.1); // Unused

            // 3. Mouse Interaction (Repulsion)
            // Mouse is in normalized coords (-1 to 1), map to viewport world units
            const mx = (mouse.x * viewport.width) / 2;
            const my = (mouse.y * viewport.height) / 2;

            const dx = mx - currentPositions[idx];
            const dy = my - currentPositions[idx + 1];
            const distSq = dx * dx + dy * dy;

            // Apply mouse force if close enough
            if (distSq < 4) { // Interaction radius squared
                const force = (1 - distSq / 4) * MOUSE_INFLUENCE;
                currentPositions[idx] -= dx * force; // Repel
                currentPositions[idx + 1] -= dy * force;
            }

            // Add subtle breathing to the finalized position (visual only, doesn't accumulate)
            // Actually, modifying currentPositions directly accumulates, so noise should be transient or carefully managed.
            // Let's rely on the morph target being steady, and the 'noise' is just the perpetual 'wobble' around the target.
            // Since we interpolate constantly to target, adding noise here works if target is static.

            // Let's add swirl for the 'Ring' or 'Sphere' specifically? 
            // Keep it simple: global slight floaty movement
            currentPositions[idx] += Math.sin(time + i) * 0.002;
        }

        positionsAttribute.needsUpdate = true;

        // Rotate entire cloud slowly
        pointsRef.current.rotation.y = time * 0.05;
        pointsRef.current.rotation.z = time * 0.02;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={PARTICLE_COUNT}
                    array={positions}
                    itemSize={3}
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={PARTICLE_SIZE}
                color="#00ffff"
                transparent
                opacity={0.8}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

export default function LivingParticles() {
    // State to cycle shapes for testing, or user control
    const [currentShape, setCurrentShape] = useState<ShapeType>('sphere');

    // Cycle shapes automatically for demo (User requested "forms things")
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentShape(prev => {
                if (prev === 'sphere') return 'ring';
                if (prev === 'ring') return 'terrain';
                if (prev === 'terrain') return 'cube';
                return 'sphere';
            });
        }, 8000); // Change every 8 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className="fixed inset-0 z-[-1] bg-gradient-to-br from-[#050510] to-[#1a0b2e]" // Fallback dark bg
            style={{ pointerEvents: 'none' }} // Let clicks pass through to app
        >
            <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
                {/* Lights for later if we use meshes */}
                <ambientLight intensity={0.5} />
                <Particles shape={currentShape} />
            </Canvas>

            {/* Optional: Debug Controls (Can remove later) */}
            <div className="absolute bottom-4 left-4 flex gap-2 pointer-events-auto">
                {['sphere', 'cube', 'terrain', 'ring'].map(s => (
                    <button
                        key={s}
                        onClick={() => setCurrentShape(s as ShapeType)}
                        className={`text-xs px-2 py-1 rounded border ${currentShape === s ? 'bg-white text-black border-white' : 'text-white/30 border-white/10 hover:border-white/50'}`}
                    >
                        {s.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
}
