import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function TabbieFace() {
    const [blink, setBlink] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Automatic blinking
        const blinkInterval = setInterval(() => {
            if (Math.random() > 0.7) {
                setBlink(true);
                setTimeout(() => setBlink(false), 150);
            }
        }, 3000);

        // Track "attention" (mouse movement for now, in prod could be presence/movement)
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 40;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;
            setMousePos({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            clearInterval(blinkInterval);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Outer Glow */}
            <div className="absolute inset-0 bg-cyan-500/10 blur-[100px] rounded-full animate-pulse" />

            {/* Face Container */}
            <div className="relative flex gap-12 items-center justify-center">
                {/* Left Eye */}
                <motion.div
                    className="relative"
                    animate={{ x: mousePos.x, y: mousePos.y }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <motion.div
                        className="w-16 h-20 bg-[#1a1b1e] border-2 border-cyan-400/30 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                        animate={{ height: blink ? 2 : 80 }}
                        transition={{ duration: 0.1 }}
                    >
                        <motion.div
                            className="w-6 h-6 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                            animate={{ scale: blink ? 0 : 1 }}
                        />
                    </motion.div>
                </motion.div>

                {/* Right Eye */}
                <motion.div
                    className="relative"
                    animate={{ x: mousePos.x, y: mousePos.y }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <motion.div
                        className="w-16 h-20 bg-[#1a1b1e] border-2 border-cyan-400/30 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                        animate={{ height: blink ? 2 : 80 }}
                        transition={{ duration: 0.1 }}
                    >
                        <motion.div
                            className="w-6 h-6 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                            animate={{ scale: blink ? 0 : 1 }}
                        />
                    </motion.div>
                </motion.div>
            </div>

            {/* Subtle "Cheek" Glows */}
            <div className="absolute -bottom-4 left-4 w-12 h-4 bg-cyan-500/10 blur-xl rounded-full" />
            <div className="absolute -bottom-4 right-4 w-12 h-4 bg-cyan-500/10 blur-xl rounded-full" />
        </div>
    );
}
