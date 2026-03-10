import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';
import { Shield, Delete } from 'lucide-react';
import ParticleBackground from './ParticleBackground';

export default function LockScreen() {
    const activeUserId = useAppStore(state => state.activeUserId);
    const users = useAppStore(state => state.users);
    const unlockSession = useAppStore(state => state.unlockSession);

    const activeUser = users.find(u => u.id === activeUserId) || users[0];

    const [pinEntry, setPinEntry] = useState('');
    const [isError, setIsError] = useState(false);

    // Initial check: If no PIN is required, unlock immediately
    // This is a failsafe, as App.tsx shouldn't render LockScreen if no PIN exists
    useEffect(() => {
        if (!activeUser?.pin) {
            unlockSession('');
        }
    }, [activeUser, unlockSession]);

    const handlePinPress = (num: string) => {
        if (pinEntry.length < 4) {
            const newPin = pinEntry + num;
            setPinEntry(newPin);
            setIsError(false);

            if (newPin.length === 4) {
                const success = unlockSession(newPin);
                if (!success) {
                    setIsError(true);
                    setPinEntry('');
                    // Shake effect is handled by framer motion via key change on error
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
            {/* Background Particles behind the lock screen */}
            <div className={`absolute inset-0 z-0 transition-colors duration-1000 ${activeUser.id === 'admin' ? 'bg-red-950/20' : 'bg-[#0f1115]'}`}>
                <ParticleBackground />
            </div>

            <motion.div
                key="pin-pad"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="z-10 flex flex-col items-center bg-black/60 backdrop-blur-3xl p-12 rounded-[3rem] border border-white/10 shadow-2xl"
            >
                <div className="w-24 h-24 rounded-3xl bg-[#2a2b30] flex items-center justify-center text-4xl mb-6 shadow-xl border border-white/5 relative">
                    {activeUser.avatar.startsWith('http') ? (
                        <img src={activeUser.avatar} className="w-full h-full object-cover rounded-3xl" />
                    ) : (
                        <span>{activeUser.avatar}</span>
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-indigo-500 w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#1a1b1e]">
                        <Shield size={14} className="text-white" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2 tracking-wide uppercase">{activeUser.name}</h2>
                <p className="text-gray-400 text-sm mb-10 font-medium">Sitzung gesperrt. Bitte PIN eingeben.</p>

                {/* PIN Dots Display */}
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

                {/* Num Pad */}
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button
                            key={n}
                            onClick={() => handlePinPress(n.toString())}
                            className="w-20 h-20 rounded-[1.5rem] bg-white/5 hover:bg-white/10 active:bg-white/20 text-2xl font-light text-white transition-all flex items-center justify-center border border-white/5 shadow-inner"
                        >
                            {n}
                        </button>
                    ))}
                    <div className="w-20 h-20" /> {/* Empty spacer */}
                    <button
                        onClick={() => handlePinPress('0')}
                        className="w-20 h-20 rounded-[1.5rem] bg-white/5 hover:bg-white/10 active:bg-white/20 text-2xl font-light text-white transition-all flex items-center justify-center border border-white/5 shadow-inner"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="w-20 h-20 rounded-[1.5rem] bg-white/5 hover:bg-rose-500/20 active:bg-rose-500/30 text-gray-400 hover:text-rose-400 transition-all flex items-center justify-center border border-white/5"
                    >
                        <Delete size={24} />
                    </button>
                </div>

                {isError && (
                    <p className="mt-8 text-rose-500 text-sm font-bold animate-pulse uppercase tracking-widest">Falsche PIN</p>
                )}
            </motion.div>
        </div>
    );
}
