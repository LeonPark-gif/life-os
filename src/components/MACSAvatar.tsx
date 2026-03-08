import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { BrainCircuit, Book } from 'lucide-react';

export default function MACSAvatar() {
    const sparkSuggestion = useAppStore(state => state.sparkSuggestion);
    const showSparkBubble = useAppStore(state => state.showSparkBubble);
    const latestMqttEvent = useAppStore(state => state.latestMqttEvent);
    const activeFocusTaskId = useAppStore(state => state.activeFocusTaskId);
    const focusStartTime = useAppStore(state => state.focusStartTime);
    const focusDurationMinutes = useAppStore(state => state.focusDurationMinutes);

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const isSpeaking = showSparkBubble && sparkSuggestion?.action === 'tip';
    const isFocusing = activeFocusTaskId !== null && focusStartTime !== null;

    let focusTimeLeft = '';
    if (isFocusing) {
        const elapsed = Date.now() - focusStartTime;
        const totalMs = focusDurationMinutes * 60 * 1000;
        const remaining = Math.max(0, totalMs - elapsed);
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        focusTimeLeft = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        // Auto-stop if time is up would usually happen in a higher level component, but for now we just show 00:00
    }

    return (
        <div className="relative w-full h-full min-h-[300px] flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden group">

            {/* Background Glow */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${isSpeaking ? 'opacity-30' : isFocusing ? 'opacity-40' : 'opacity-10'}`}>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] transition-colors duration-1000
                    ${isSpeaking ? 'bg-cyan-500/30' : isFocusing ? 'bg-indigo-600/40' : 'bg-cyan-500/30'}`} />
                <div className={`absolute top-1/2 left-1/4 -translate-y-1/2 w-48 h-48 rounded-full blur-[80px] transition-colors duration-1000
                    ${isSpeaking ? 'bg-purple-500/20' : isFocusing ? 'bg-violet-600/30' : 'bg-purple-500/20'}`} />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-lg p-6 text-center">

                {/* The Orb / Face */}
                <motion.div
                    animate={{
                        scale: isSpeaking ? [1, 1.05, 1] : isFocusing ? [1, 1.02, 1] : [1, 1.02, 1],
                        rotate: isSpeaking ? [0, 2, -2, 0] : 0
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: isSpeaking ? 2 : isFocusing ? 6 : 4,
                        ease: "easeInOut"
                    }}
                    className={`
                        w-32 h-32 rounded-full border-2 shadow-2xl flex items-center justify-center mb-8 relative transition-colors duration-1000
                        ${isSpeaking ? 'border-cyan-400 bg-cyan-900/30 shadow-[0_0_30px_rgba(34,211,238,0.5)]'
                            : isFocusing ? 'border-indigo-400 bg-indigo-900/30 shadow-[0_0_40px_rgba(99,102,241,0.4)]'
                                : 'border-white/20 bg-white/5'}
                    `}
                >
                    {isFocusing ? (
                        <Book size={48} className="text-indigo-300 animate-pulse" />
                    ) : (
                        <BrainCircuit size={48} className={isSpeaking ? "text-cyan-300 animate-pulse" : "text-gray-500"} />
                    )}

                    {/* Speech Rings */}
                    <AnimatePresence>
                        {isSpeaking && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: [0, 0.5, 0], scale: [1, 1.5, 2] }}
                                    transition={{ repeat: Infinity, duration: 2, delay: 0 }}
                                    className="absolute inset-0 rounded-full border border-cyan-400/50"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: [0, 0.3, 0], scale: [1, 1.8, 2.5] }}
                                    transition={{ repeat: Infinity, duration: 2, delay: 1 }}
                                    className="absolute inset-0 rounded-full border border-cyan-400/30"
                                />
                            </>
                        )}
                        {isFocusing && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: [0, 0.2, 0], scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 6 }}
                                className="absolute inset-0 rounded-full border-[4px] border-indigo-400/50"
                            />
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Content Area */}
                <div className="h-32 flex flex-col items-center justify-center w-full">
                    <AnimatePresence mode="wait">
                        {isSpeaking ? (
                            <motion.div
                                key="speech"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-xl md:text-2xl font-medium text-cyan-100 italic"
                            >
                                "{sparkSuggestion?.message}"
                            </motion.div>
                        ) : isFocusing ? (
                            <motion.div
                                key="focus"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col items-center justify-center w-full text-indigo-200"
                            >
                                <div className="text-6xl md:text-8xl font-mono font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 to-purple-500">
                                    {focusTimeLeft}
                                </div>
                                <div className="text-sm uppercase tracking-[0.2em] mt-2 opacity-70 font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> Deep Focus
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="time"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col items-center justify-center text-gray-400"
                            >
                                <div className="text-5xl md:text-7xl font-mono font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-gray-500">
                                    {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-sm uppercase tracking-[0.2em] mt-2 opacity-50 font-bold">
                                    MACS Online
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Debug/Info Overlay */}
            {latestMqttEvent && !isSpeaking && !isFocusing && (
                <div className="absolute top-4 right-4 text-[10px] text-white/20 font-mono text-right pointer-events-none w-48 truncate">
                    Letztes Event:<br />{latestMqttEvent.topic}
                </div>
            )}
        </div>
    );
}
