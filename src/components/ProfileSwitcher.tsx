import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, ArrowLeft, Delete } from 'lucide-react';

interface ProfileSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileSwitcher({ isOpen, onClose }: ProfileSwitcherProps) {
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [pinEntry, setPinEntry] = useState('');
    const [isError, setIsError] = useState(false);

    const switchUser = useAppStore(state => state.switchUser);
    const verifyPin = useAppStore(state => state.verifyPin);

    const allUsers = useAppStore(state => state.users);
    const activeUserId = useAppStore(state => state.activeUserId);
    const users = allUsers; // Show all users by default, including admin

    useEffect(() => {
        if (!isOpen) {
            setSelectedUser(null);
            setPinEntry('');
            setIsError(false);
        }
    }, [isOpen]);

    // Removed 5-click hidden logic
    const handleTitleClick = () => { };

    const handleUserSelect = (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        if (!user.pin) {
            // No PIN, switch immediately
            switchUser(userId);
            onClose();
        } else {
            setSelectedUser(userId);
            setPinEntry('');
        }
    };

    const handlePinPress = (num: string) => {
        if (pinEntry.length < 4) {
            const newPin = pinEntry + num;
            setPinEntry(newPin);
            setIsError(false);

            if (newPin.length === 4) {
                if (verifyPin(selectedUser!, newPin)) {
                    switchUser(selectedUser!, true);
                    onClose();
                } else {
                    setIsError(true);
                    setPinEntry('');
                    // shake effect handled by framer motion via key
                }
            }
        }
    };

    const handleDelete = () => {
        setPinEntry(prev => prev.slice(0, -1));
        setIsError(false);
    };

    const targetUser = users.find(u => u.id === selectedUser);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-2xl p-4"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all"
                    >
                        <X size={24} />
                    </button>

                    <div className="w-full max-w-lg">
                        <AnimatePresence mode="wait">
                            {!selectedUser ? (
                                <motion.div
                                    key="user-grid"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="text-center"
                                >
                                    <h2 onClick={handleTitleClick} className="text-3xl font-light text-white mb-12 tracking-widest uppercase cursor-default select-none">Profil wählen</h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                                        {users.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => handleUserSelect(user.id)}
                                                className={`group flex flex-col items-center gap-4 transition-all ${activeUserId === user.id ? 'opacity-100' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                                            >
                                                <div className={`w-24 h-24 rounded-[32px] bg-[#2a2b30] flex items-center justify-center text-4xl shadow-2xl border-2 transition-all group-hover:border-white/20 ${activeUserId === user.id ? 'border-[#3b82f6] shadow-[#3b82f6]/20' : 'border-transparent'}`}>
                                                    {user.avatar.startsWith('http') ? (
                                                        <img src={user.avatar} className="w-full h-full object-cover rounded-[30px]" />
                                                    ) : (
                                                        <span>{user.avatar}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-white font-bold tracking-wide">{user.name}</span>
                                                    {user.pin && <Shield size={12} className="text-gray-500 mt-1" />}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="pin-pad"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col items-center"
                                >
                                    <button
                                        onClick={() => setSelectedUser(null)}
                                        className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors"
                                    >
                                        <ArrowLeft size={16} />
                                        <span className="text-sm font-bold uppercase tracking-widest">Zurück</span>
                                    </button>

                                    <div className="w-20 h-20 rounded-3xl bg-[#2a2b30] flex items-center justify-center text-3xl mb-6 shadow-xl border border-white/5">
                                        {targetUser?.avatar}
                                    </div>
                                    <h2 className="text-xl font-bold text-white mb-2">{targetUser?.name}</h2>
                                    <p className="text-gray-500 text-sm mb-12">Bitte gib deine PIN ein</p>

                                    {/* PIN Display */}
                                    <motion.div
                                        key={isError ? 'error' : 'normal'}
                                        animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
                                        className="flex gap-4 mb-12"
                                    >
                                        {[0, 1, 2, 3].map(i => (
                                            <div
                                                key={i}
                                                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pinEntry.length > i
                                                    ? (isError ? 'bg-rose-500 border-rose-500 scale-125' : 'bg-[#3b82f6] border-[#3b82f6] scale-110')
                                                    : 'border-white/20'
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
                                                className="w-20 h-20 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-2xl font-light text-white transition-all flex items-center justify-center border border-white/5"
                                            >
                                                {n}
                                            </button>
                                        ))}
                                        <div className="w-20 h-20" />
                                        <button
                                            onClick={() => handlePinPress('0')}
                                            className="w-20 h-20 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-2xl font-light text-white transition-all flex items-center justify-center border border-white/5"
                                        >
                                            0
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            className="w-20 h-20 rounded-2xl bg-white/5 hover:bg-rose-500/20 active:bg-rose-500/30 text-gray-400 hover:text-rose-400 transition-all flex items-center justify-center border border-white/5"
                                        >
                                            <Delete size={24} />
                                        </button>
                                    </div>

                                    {isError && (
                                        <p className="mt-8 text-rose-500 text-sm font-bold animate-pulse uppercase tracking-widest">Falsche PIN</p>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
