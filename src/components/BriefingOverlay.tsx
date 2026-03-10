import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Mic, Coffee, Loader2, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';

interface BriefingOverlayProps {
    onClose: () => void;
}

export default function BriefingOverlay({ onClose }: BriefingOverlayProps) {
    const [briefing, setBriefing] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    const events = useAppStore(state => state.events);
    const lists = useAppStore(state => state.lists);
    const habits = useAppStore(state => state.habits);

    useEffect(() => {
        const fetchBriefing = async () => {
            try {
                setIsLoading(true);
                const todayStr = format(new Date(), 'yyyy-MM-dd');

                // Gather data
                const todaysEvents = events.filter(e => {
                    try {
                        return format(new Date(e.date), 'yyyy-MM-dd') === todayStr;
                    } catch {
                        return false;
                    }
                });
                const allTasks = lists.flatMap(l => l.tasks).filter(t => !t.completed);
                const todaysHabits = habits;

                const systemConfig = useAppStore.getState().systemConfig;

                const res = await fetch('/api/briefing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: todayStr,
                        ollamaUrl: systemConfig.ollamaUrl,
                        model: systemConfig.ollamaModel,
                        calendarEvents: todaysEvents.map(e => ({ title: e.title, time: e.time })),
                        tasks: allTasks.map(t => t.text).slice(0, 5), // top 5 tasks
                        habits: todaysHabits.map(h => ({ name: h.name, completionsTotal: Object.keys(h.completedDates || {}).length }))
                    })
                });

                const data = await res.json();
                if (!res.ok || data.error_detail) {
                    console.error("Briefing API Error:", data.error_detail);
                }
                setBriefing(data.briefing || 'Kein Briefing erhalten.');
            } catch (e: any) {
                console.error("Briefing failed", e);
                setBriefing(`MACS ist offline. Verbindung zu Ollama fehlgeschlagen: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBriefing();
    }, [events, lists, habits]);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col"
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                            <Coffee size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Tagesbriefing</h2>
                            <p className="text-sm text-indigo-300/70 font-mono">{format(new Date(), 'dd.MM.yyyy')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 min-h-[200px] flex items-center justify-center">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-4 text-indigo-400">
                            <Loader2 size={40} className="animate-spin" />
                            <p className="font-mono text-sm tracking-widest animate-pulse">DASILVA ANALYSIERT...</p>
                        </div>
                    ) : (
                        <div className="text-xl md:text-2xl text-gray-200 font-light leading-relaxed whitespace-pre-wrap flex gap-4">
                            <Sparkles className="text-indigo-400 flex-shrink-0 mt-1" />
                            <p>{briefing}</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 flex justify-center">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider">
                        <Mic size={16} /> Antworten
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
