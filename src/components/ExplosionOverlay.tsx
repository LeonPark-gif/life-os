import { useEffect, useRef } from 'react';
import { explosionEvents } from '../utils/explosionEvents';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    life: number;
    size: number;
}

export default function ExplosionOverlay() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particles = useRef<Particle[]>([]);
    const reqId = useRef<number>(0);

    useEffect(() => {
        const handleExplode = (e: Event) => {
            const { x, y, color } = (e as CustomEvent).detail;
            spawnExplosion(x, y, color);
        };

        explosionEvents.addEventListener('explode', handleExplode);

        // Start loop
        const loop = () => {
            update();
            reqId.current = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            explosionEvents.removeEventListener('explode', handleExplode);
            cancelAnimationFrame(reqId.current);
        };
    }, []);

    const spawnExplosion = (x: number, y: number, color: string) => {
        const count = 40; // Shards
        for (let i = 0; i < count; i++) {
            const speed = Math.random() * 5 + 2;
            const angle = Math.random() * Math.PI * 2;
            particles.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                life: 1.0,
                size: Math.random() * 4 + 2,
            });
        }
    };

    const update = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize if needed (naive)
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.current.length - 1; i >= 0; i--) {
            const p = particles.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // Gravity
            p.life -= 0.02;

            if (p.life <= 0) {
                particles.current.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size); // Shards are squares
        }
        ctx.globalAlpha = 1;
    };

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-50 pointer-events-none"
        />
    );
}
