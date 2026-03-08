
import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';

// --- Configuration ---
const PARTICLE_COUNT = 5500; // More particles for detail
const PARTICLE_SIZE = 0.06;
const MORPH_SPEED = 0.02; // Reduced acceleration
const MAX_SPEED = 0.006;   // Strongly capped maximum movement per frame
const MOUSE_INFLUENCE = 1.0;

type ShapeType =
    'sphere' | 'face' | 'terrain' | 'house' |
    'heart' | 'rings' | 'cloud' | 'skyline' | 'galaxy' | 'flower' | 'family';

// --- Shape Generators ---

function getSpherePoints(count: number, radius: number = 2.2) {
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

function getTerrainPoints(count: number, width: number = 10, height: number = 8) {
    const points = new Float32Array(count * 3);
    const complex = Math.floor(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
        const x = (i % complex) / complex * width - width / 2;
        const z = Math.floor(i / complex) / complex * height - height / 2;
        const y = Math.sin(x * 0.8) + Math.cos(z * 0.6) * 1.5 + Math.sin(x * 2.5 + z * 1.5) * 0.3 - 2.5;
        points[i * 3] = x + (Math.random() - 0.5) * 0.1;
        points[i * 3 + 1] = y;
        points[i * 3 + 2] = z + (Math.random() - 0.5) * 0.1;
    }
    return points;
}

function getHousePoints(count: number) {
    const points = new Float32Array(count * 3);
    const baseCount = Math.floor(count * 0.6);
    const roofCount = count - baseCount;

    let idx = 0;
    // Base
    for (let i = 0; i < baseCount; i++) {
        const s = 3;
        points[idx++] = (Math.random() - 0.5) * s;
        points[idx++] = (Math.random() - 0.5) * s - 1;
        points[idx++] = (Math.random() - 0.5) * s;
    }
    // Roof
    for (let i = 0; i < roofCount; i++) {
        const h = 2; const w = 3.2;
        const y = Math.random() * h;
        const scale = 1 - (y / h);
        points[idx++] = (Math.random() - 0.5) * w * scale;
        points[idx++] = y + 0.5;
        points[idx++] = (Math.random() - 0.5) * w * scale;
    }
    return points;
}

function getFacePoints(count: number) {
    const points = new Float32Array(count * 3);
    const skullCount = Math.floor(count * 0.7);
    const jawCount = count - skullCount;
    let idx = 0;
    // Skull
    for (let i = 0; i < skullCount; i++) {
        const r = 2.0;
        const phi = Math.acos(-1 + (2 * i) / skullCount);
        const theta = Math.sqrt(skullCount * Math.PI) * phi;
        points[idx++] = r * 0.9 * Math.cos(theta) * Math.sin(phi);
        points[idx++] = (r * Math.sin(theta) * Math.sin(phi)) + 0.5;
        points[idx++] = r * Math.cos(phi);
    }
    // Jaw
    for (let i = 0; i < jawCount; i++) {
        const w = 1.6; const h = 1.5; const d = 1.8;
        const yProg = Math.random();
        const taper = 1 - (yProg * 0.5);
        points[idx++] = (Math.random() - 0.5) * w * taper;
        points[idx++] = -1.0 - (yProg * h);
        points[idx++] = (Math.random() - 0.5) * d * taper + 0.2;
    }
    return points;
}

function getHeartPoints(count: number) {
    const points = new Float32Array(count * 3);
    // Parametric Heart: 
    // x = 16sin^3(t)
    // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
    // z = slight depth
    for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const scale = 0.15;
        const r = Math.random(); // volume fill
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

        // Add volume inside
        const vol = Math.pow(r, 1 / 3); // bias towards surface

        points[i * 3] = x * scale * vol;
        points[i * 3 + 1] = y * scale * vol + 0.5; // center
        points[i * 3 + 2] = (Math.random() - 0.5) * 1.5 * vol; // Thickness
    }
    return points;
}

function getRingsPoints(count: number) {
    const points = new Float32Array(count * 3);
    const ring1 = Math.floor(count * 0.5);
    const ring2 = count - ring1;
    let idx = 0;

    // Ring 1 (Horizontal)
    for (let i = 0; i < ring1; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = 2.5 + (Math.random() - 0.5) * 0.5; // Thickness
        points[idx++] = Math.cos(t) * r;
        points[idx++] = (Math.random() - 0.5) * 0.2; // Flat
        points[idx++] = Math.sin(t) * r;
    }
    // Ring 2 (Vertical interlocked)
    for (let i = 0; i < ring2; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = 2.5 + (Math.random() - 0.5) * 0.5;
        points[idx++] = Math.cos(t) * r;      // x
        points[idx++] = Math.sin(t) * r;      // y -> vertical
        points[idx++] = (Math.random() - 0.5) * 0.2; // z flat
    }
    return points;
}

function getCloudPoints(count: number) {
    const points = new Float32Array(count * 3);
    // 3 blobs
    const blobs = [
        { x: -1.5, y: 0, z: 0, r: 1.2 },
        { x: 0, y: 0.5, z: 0.5, r: 1.5 },
        { x: 1.5, y: 0, z: -0.2, r: 1.1 }
    ];
    for (let i = 0; i < count; i++) {
        const b = blobs[Math.floor(Math.random() * blobs.length)];
        // Random point in sphere
        const u = Math.random(); const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random()) * b.r;

        points[i * 3] = b.x + (r * Math.sin(phi) * Math.cos(theta));
        points[i * 3 + 1] = b.y + (r * Math.sin(phi) * Math.sin(theta));
        points[i * 3 + 2] = b.z + (r * Math.cos(phi));
    }
    return points;
}

function getSkylinePoints(count: number) {
    const points = new Float32Array(count * 3);
    const buildings = 7;
    let idx = 0;
    const spacing = 1.0;
    const startX = -((buildings * spacing) / 2);

    for (let b = 0; b < buildings; b++) {
        const h = 1.5 + Math.random() * 3.0; // random height
        const w = 0.8;
        const d = 0.8 + Math.random() * 0.5;
        const bX = startX + b * spacing + (Math.random() * 0.2);

        const bParticles = Math.floor(count / buildings);

        for (let i = 0; i < bParticles && idx < count * 3; i++) {
            points[idx++] = bX + (Math.random() - 0.5) * w;
            points[idx++] = (Math.random() * h) - 2; // ground is -2
            points[idx++] = (Math.random() - 0.5) * d;
        }
    }
    // Fill remainder
    while (idx < count * 3) points[idx++] = 0;
    return points;
}

function getGalaxyPoints(count: number) {
    const points = new Float32Array(count * 3);
    // Spiral
    for (let i = 0; i < count; i++) {
        const arms = 3;
        const armIndex = i % arms;
        const r = Math.random() * 4;
        const spin = r * 2; // Twist
        const angle = (armIndex / arms) * Math.PI * 2 + spin + (Math.random() * 0.5);

        points[i * 3] = Math.cos(angle) * r;
        points[i * 3 + 1] = (Math.random() - 0.5) * (0.5 / (r + 0.1)); // Flattened disk
        points[i * 3 + 2] = Math.sin(angle) * r;
    }
    return points;
}

function getFlowerPoints(count: number) {
    const points = new Float32Array(count * 3);
    // Stem
    const stemCount = Math.floor(count * 0.2);
    const petalCount = count - stemCount;
    let idx = 0;

    // Stem
    for (let i = 0; i < stemCount; i++) {
        points[idx++] = (Math.random() - 0.5) * 0.1;
        points[idx++] = (Math.random() * 3) - 3;
        points[idx++] = (Math.random() - 0.5) * 0.1;
    }

    // Petals (Rose curve approx)
    const petals = 5;
    for (let i = 0; i < petalCount; i++) {
        const t = Math.random() * Math.PI * 2;
        const k = petals;
        const r = Math.cos(k * t) * 1.5 + (Math.random() * 0.5); // Petal shape + volume

        // Cup shape
        const cup = Math.sqrt(r);

        points[idx++] = r * Math.cos(t);
        points[idx++] = cup * 0.5 + (Math.random() * 0.5); // lift up
        points[idx++] = r * Math.sin(t);
    }
    return points;
}

function getFamilyPoints(count: number) {
    const points = new Float32Array(count * 3);
    // 4 blobbies
    const people = [
        { h: 2.2, x: -1.5 }, // Dad
        { h: 2.0, x: -0.5 }, // Mom
        { h: 1.4, x: 0.5 },  // Kid 1
        { h: 1.1, x: 1.2 }   // Kid 2
    ];
    let idx = 0;
    const perPerson = Math.floor(count / 4);

    people.forEach(p => {
        for (let i = 0; i < perPerson && idx < count * 3; i++) {
            // Pill shape
            const w = 0.5;
            const y = Math.random() * p.h;
            points[idx++] = p.x + (Math.random() - 0.5) * w;
            points[idx++] = y - 1; // Center vertically
            points[idx++] = (Math.random() - 0.5) * w;
        }
    });
    // fill
    while (idx < count * 3) points[idx++] = 0;
    return points;
}

// --- Component ---

function Particles({ shape, accentColor }: { shape: ShapeType, accentColor?: string }) {
    const pointsRef = useRef<THREE.Points>(null);
    const { viewport, mouse } = useThree();

    // Data buffers
    const [positions] = useState<Float32Array>(() => getSpherePoints(PARTICLE_COUNT));

    // Target Shapes Cache
    const shapes = useMemo(() => ({
        sphere: getSpherePoints(PARTICLE_COUNT),
        face: getFacePoints(PARTICLE_COUNT),
        terrain: getTerrainPoints(PARTICLE_COUNT),
        house: getHousePoints(PARTICLE_COUNT),
        heart: getHeartPoints(PARTICLE_COUNT),
        rings: getRingsPoints(PARTICLE_COUNT),
        cloud: getCloudPoints(PARTICLE_COUNT),
        skyline: getSkylinePoints(PARTICLE_COUNT),
        galaxy: getGalaxyPoints(PARTICLE_COUNT),
        flower: getFlowerPoints(PARTICLE_COUNT),
        family: getFamilyPoints(PARTICLE_COUNT),
    }), []);

    const targetRef = useRef<Float32Array>(shapes.sphere);

    useEffect(() => {
        targetRef.current = shapes[shape];
    }, [shape, shapes]);

    useFrame((state) => {
        if (!pointsRef.current) return;

        const positionsAttribute = pointsRef.current.geometry.attributes.position;
        const currentPositions = positionsAttribute.array as Float32Array;
        const targetPositions = targetRef.current;
        const time = state.clock.getElapsedTime();

        const mx = mouse.x * (viewport.width / 2);
        const my = mouse.y * (viewport.height / 2);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const idx = i * 3;

            // 1. Morph Logic (Constant Speed Cap)
            // Goal: Move towards target, but max X units per frame
            const tx = targetPositions[idx];
            const ty = targetPositions[idx + 1];
            const tz = targetPositions[idx + 2];

            const dx = tx - currentPositions[idx];
            const dy = ty - currentPositions[idx + 1];
            const dz = tz - currentPositions[idx + 2];

            // Standard Lerp
            let moveX = dx * MORPH_SPEED;
            let moveY = dy * MORPH_SPEED;
            let moveZ = dz * MORPH_SPEED;

            // Velocity Cap (Smooths out the 'explosion' effect when target is far)
            // This ensures particles never zip across screen instantly
            const speedSq = moveX * moveX + moveY * moveY + moveZ * moveZ;
            if (speedSq > MAX_SPEED * MAX_SPEED) {
                const scale = MAX_SPEED / Math.sqrt(speedSq);
                moveX *= scale;
                moveY *= scale;
                moveZ *= scale;
            }

            currentPositions[idx] += moveX;
            currentPositions[idx + 1] += moveY;
            currentPositions[idx + 2] += moveZ;

            // 2. "Life" (Breathing)
            const jitter = Math.sin(time * 1.5 + i * 0.1) * 0.003;
            currentPositions[idx] += jitter;
            currentPositions[idx + 1] += jitter;

            // 3. Mouse Interaction (Cylinder)
            const pdx = mx - currentPositions[idx];
            const pdy = my - currentPositions[idx + 1];
            const distSq = pdx * pdx + pdy * pdy;

            if (distSq < 2) {
                const force = (1 - distSq / 2) * MOUSE_INFLUENCE;
                currentPositions[idx] -= pdx * force * 0.15;
                currentPositions[idx + 1] -= pdy * force * 0.15;
                currentPositions[idx + 2] -= force * 0.2;
            }

            // 4. Centre Repulsion (Content Awareness)
            // Push particles slightly away from the center where text usually is, 
            // so they "hang out" at the edges of the tiles.
            // Center is (0,0). Safe zone is radius ~2.5.
            const cx = currentPositions[idx];
            const cy = currentPositions[idx + 1];
            const centerDistSq = cx * cx + cy * cy;

            if (centerDistSq < 6.0) { // Radius ~2.45
                // Calculate force to push OUT
                const pushForce = (6.0 - centerDistSq) * 0.002; // Gentle push
                // Normalize direction roughly
                currentPositions[idx] += cx * pushForce;
                currentPositions[idx + 1] += cy * pushForce;
            }

            // 5. Edge Play (Fun)
            // Occasionally pull particles to the extreme edges
            const timeSlow = time * 0.5;
            if (Math.sin(timeSlow + i * 0.01) > 0.98) {
                // Pull to nearest horizontal edge
                const dir = cx > 0 ? 1 : -1;
                currentPositions[idx] += dir * 0.01;
            }
        }

        positionsAttribute.needsUpdate = true;

        // Slow Rotation
        pointsRef.current.rotation.y = time * 0.02;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={PARTICLE_SIZE}
                color={accentColor || "#00ffff"}
                transparent
                opacity={0.35}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

export default function ParticleBackground() {
    const themeConfig = useAppStore(state => state.currentUser()?.themeConfig);
    const accentColor = themeConfig?.accentColor;
    const [currentShape, setCurrentShape] = useState<ShapeType>('galaxy');

    // Auto-Cycle Shapes 
    useEffect(() => {
        const shapes: ShapeType[] = [
            'sphere', 'galaxy', 'face', 'skyline',
            'heart', 'rings', 'flower', 'terrain',
            'cloud', 'house', 'family'
        ];
        let idx = 0;
        const interval = setInterval(() => {
            idx = (idx + 1) % shapes.length;
            setCurrentShape(shapes[idx]);
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className="fixed inset-0 z-[-1]"
            style={{
                pointerEvents: 'none',
                background: themeConfig?.wallpaper
                    ? `url(${themeConfig.wallpaper}) center/cover no-repeat`
                    : 'linear-gradient(to br, #050510, #1a0b2e)'
            }}
        >
            <Canvas camera={{ position: [0, 0, 7.5], fov: 60 }}>
                <Particles shape={currentShape} accentColor={accentColor} />
            </Canvas>

            {/* Shape Indicator */}
            <div className="absolute bottom-4 left-4 text-[10px] text-white/10 uppercase tracking-widest pointer-events-none font-mono opacity-50">
                AI Core: {currentShape}
            </div>
        </div>
    );
}
