import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Clock, MapPin } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import TabbieFace from './TabbieFace';
import { motion } from 'framer-motion';

export default function EntranceDashboard() {
    const allEvents = useAppStore(state => state.getVisibleEvents());
    const checklists = useAppStore(state => state.lists);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Filter shared content only
    const sharedEvents = allEvents.filter(e =>
        e.sharedWith.includes('all') &&
        (isSameDay(new Date(e.date), time) || isSameDay(new Date(e.date), new Date(time.getTime() + 86400000)))
    ).slice(0, 4);

    const sharedTasks = checklists
        .filter(l => l.sharedWith.includes('all'))
        .flatMap(l => l.tasks)
        .filter(t => !t.completed)
        .slice(0, 6);

    return (
        <div className="w-full h-screen bg-[#090a0c] text-white flex flex-col p-12 overflow-hidden relative font-sans">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
            </div>

            {/* Header: Clock and Date */}
            <div className="flex justify-between items-start z-10 mb-16">
                <div className="flex flex-col">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-8xl font-light tracking-tighter text-white"
                    >
                        {format(time, 'HH:mm')}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-2xl text-gray-400 font-medium uppercase tracking-[0.2em] mt-2"
                    >
                        {format(time, 'EEEE, d. MMMM', { locale: de })}
                    </motion.p>
                </div>

                <div className="text-right">
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Haus DaSilva</p>
                    <div className="flex items-center gap-2 text-cyan-400 mt-2 font-mono text-xl justify-end">
                        <MapPin size={20} />
                        <span>Flur</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area: Eyes in center, Info on sides */}
            <div className="flex-1 flex items-center justify-between gap-12 z-10 pb-12">

                {/* Left Side: Shared Calendar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-1/3 flex flex-col gap-6"
                >
                    <h3 className="text-xs font-bold tracking-[0.3em] text-cyan-500 uppercase">Anstehend</h3>
                    <div className="space-y-4">
                        {sharedEvents.length === 0 ? (
                            <p className="text-gray-600 italic">Keine shared Termine.</p>
                        ) : (
                            sharedEvents.map(evt => (
                                <div key={evt.id} className="bg-white/5 border border-white/5 rounded-[24px] p-6 hover:bg-white/10 transition-colors group">
                                    <p className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{evt.title}</p>
                                    <div className="flex items-center gap-3 text-gray-400 text-sm">
                                        <Clock size={16} className="text-cyan-500" />
                                        <span>{evt.isAllDay ? 'Ganztägig' : evt.time}</span>
                                        {isSameDay(new Date(evt.date), time) ? (
                                            <span className="text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-md">HEUTE</span>
                                        ) : (
                                            <span className="text-blue-400 font-bold px-2 py-0.5 bg-blue-500/10 rounded-md">MORGEN</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Center: The Face */}
                <div className="flex-1 flex flex-col items-center justify-center">
                    <TabbieFace />
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="mt-8 text-gray-500 font-mono text-xs uppercase tracking-[0.4em] animate-pulse"
                    >
                        Tabbie Online
                    </motion.div>
                </div>

                {/* Right Side: Shared Tasks */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-1/3 flex flex-col gap-6"
                >
                    <h3 className="text-xs font-bold tracking-[0.3em] text-indigo-400 uppercase text-right">Aufgaben</h3>
                    <div className="space-y-3">
                        {sharedTasks.length === 0 ? (
                            <p className="text-gray-600 italic text-right">Alles erledigt!</p>
                        ) : (
                            sharedTasks.map(task => (
                                <div key={task.id} className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-[18px] p-4 justify-end hover:bg-white/10 transition-colors">
                                    <span className="text-lg text-gray-300 font-medium truncate">{task.text}</span>
                                    <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 flex items-center justify-center shrink-0" />
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

            </div>

            {/* Bottom: Voice Hint */}
            <div className="mt-auto mb-4 flex justify-center z-10">
                <div className="px-8 py-4 bg-white/5 rounded-full border border-white/5 backdrop-blur-3xl text-gray-500 text-sm font-medium tracking-wide">
                    "Tabbie, ich bin jetzt weg"
                </div>
            </div>
        </div>
    );
}
