import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowLeft, Delete, Sparkles } from 'lucide-react';
import ParticleBackground from './ParticleBackground';

export default function ProfileSelectionScreen() {
    const users = useAppStore(state => state.users);
    const switchUser = useAppStore(state => state.switchUser);
    const verifyPin = useAppStore(state => state.verifyPin);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [pinEntry, setPinEntry] = useState('');
    const [isError, setIsError] = useState(false);

    const targetUser = users.find(u => u.id === selectedUserId);

    const handleUserSelect = (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (user && !user.pin) {
            switchUser(userId, true);
        } else {
            setSelectedUserId(userId);
            setPinEntry('');
            setIsError(false);
        }
    };

    const handlePinPress = (num: string) => {
        if (pinEntry.length < 4) {
            const newPin = pinEntry + num;
            setPinEntry(newPin);
            setIsError(false);

            if (newPin.length === 4) {
                if (verifyPin(selectedUserId!, newPin)) {
                    switchUser(selectedUserId!, true);
                } else {
                    setIsError(true);
                    setPinEntry('');
                }
            }
        }
    };

    const handleDelete = () => {
        setPinEntry(prev => prev.slice(0, -1));
        setIsError(false);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden text-white font-sans flex items-center justify-center bg-[#0f1115]">
            <div className="absolute inset-0 z-0">
                <ParticleBackground />
            </div>

            <div className="z-10 w-full max-w-4xl px-4">
                <AnimatePresence mode="wait">
                    {!selectedUserId ? (
                        <motion.div
                            key="user-grid"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex flex-col items-center"
                        >
                            <div className="mb-12 flex flex-col items-center">
                                <div className="text-cyan-500 mb-4">
                                    <Sparkles size={48} />
                                </div>
                                <h1 className="text-4xl font-light tracking-[0.3em] uppercase">DaSilva OS</h1>
                                <p className="text-gray-500 mt-4 font-mono text-sm tracking-widest uppercase">Willkommen. Bitte Profil wählen.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                                {users.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleUserSelect(user.id)}
                                        className="group flex flex-col items-center gap-4 transition-all hover:scale-105"
                                    >
                                        <div className="w-28 h-28 rounded-[38px] bg-white/5 backdrop-blur-md flex items-center justify-center text-4xl border-2 border-white/5 group-hover:border-white/20 transition-all shadow-2xl relative">
                                            {user.avatar.startsWith('http') ? (
                                                <img src={user.avatar} className="w-full h-full object-cover rounded-[36px]" />
                                            ) : (
                                                <span>{user.avatar}</span>
                                            )}
                                            {user.pin && (
                                                <div className="absolute -top-2 -right-2 bg-indigo-500 p-1.5 rounded-full border-4 border-[#1a1b1e]">
                                                    <Shield size={12} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-lg font-bold tracking-wide text-white/80 group-hover:text-white transition-colors">
                                            {user.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pin-pad"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-black/60 backdrop-blur-3xl p-12 rounded-[3rem] border border-white/10 shadow-2xl mx-auto max-w-md flex flex-col items-center"
                        >
                            <button
                                onClick={() => setSelectedUserId(null)}
                                className="absolute top-8 left-8 flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Zurück</span>
                            </button>

                            <div className="w-24 h-24 rounded-3xl bg-[#2a2b30] flex items-center justify-center text-4xl mb-6 shadow-xl border border-white/5 overflow-hidden">
                                {targetUser?.avatar.startsWith('http') ? (
                                    <img src={targetUser.avatar} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{targetUser?.avatar}</span>
                                )}
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2 tracking-wide uppercase">{targetUser?.name}</h2>
                            <p className="text-gray-400 text-sm mb-10 font-medium tracking-widest uppercase">PIN erforderlich</p>

                            <motion.div
                                key={isError ? 'error' : 'normal'}
                                animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
                                className="flex gap-4 mb-10"
                            >
                                {[0, 1, 2, 3].map(i => (
                                    <div
                                        key={i}
                                        className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pinEntry.length > i
                                            ? (isError ? 'bg-rose-500 border-rose-500 scale-125' : 'bg-[#3b82f6] border-[#3b82f6] scale-110')
                                            : 'border-white/20 bg-black/20'
                                            }`}
                                    />
                                ))}
                            </motion.div>

                            <div className="grid grid-cols-3 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => handlePinPress(n.toString())}
                                        className="w-16 h-16 rounded-[1.2rem] bg-white/5 hover:bg-white/10 active:bg-white/20 text-xl font-light text-white transition-all flex items-center justify-center border border-white/5 shadow-inner"
                                    >
                                        {n}
                                    </button>
                                ))}
                                <div className="w-16 h-16" />
                                <button
                                    onClick={() => handlePinPress('0')}
                                    className="w-16 h-16 rounded-[1.2rem] bg-white/5 hover:bg-white/10 active:bg-white/20 text-xl font-light text-white transition-all flex items-center justify-center border border-white/5 shadow-inner"
                                >
                                    0
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-16 h-16 rounded-[1.2rem] bg-white/5 hover:bg-rose-500/20 active:bg-rose-500/30 text-gray-400 hover:text-rose-400 transition-all flex items-center justify-center border border-white/5"
                                >
                                    <Delete size={20} />
                                </button>
                            </div>

                            {isError && (
                                <p className="mt-8 text-rose-500 text-xs font-bold animate-pulse uppercase tracking-[0.2em]">Falsche PIN</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
