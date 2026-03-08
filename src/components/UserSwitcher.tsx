import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function UserSwitcher() {
    const { users, activeUserId, switchUser } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);

    const currentUser = users.find(u => u.id === activeUserId);
    const visibleUsers = users.filter(u => !u.isHidden);

    if (!currentUser) return null;

    return (
        <div className="relative z-50">
            {/* Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white/20 flex items-center justify-center text-xl shadow-lg transition-transform hover:scale-105"
            >
                {currentUser.avatar}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-12 w-48 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-4">
                        <div className="px-3 py-2 border-b border-white/10 mb-2">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Profil wechseln</p>
                        </div>
                        <div className="space-y-1">
                            {visibleUsers.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => {
                                        switchUser(user.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors
                                        ${activeUserId === user.id ? 'bg-white/10' : 'hover:bg-white/5'}
                                    `}
                                >
                                    <span className="text-xl">{user.avatar}</span>
                                    <span className={`text-sm font-bold ${user.color}`}>{user.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
