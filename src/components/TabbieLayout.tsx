import React from 'react';
import { motion } from 'framer-motion';
import {
    Layout as LayoutIcon,
    Target,
    Flame,
    Calendar,
    Layers,
    Shield,
    Settings,
    Activity,
    Mail
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import ProfileSwitcher from './ProfileSwitcher';

type TabType = 'mission' | 'tasks' | 'habits' | 'chrono' | 'workspaces' | 'screentime' | 'mail' | 'admin';

interface TabbieLayoutProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    children: React.ReactNode;
    onOpenSettings: () => void;
}

export default function TabbieLayout({ activeTab, setActiveTab, children, onOpenSettings }: TabbieLayoutProps) {
    const user = useAppStore(state => state.currentUser());
    const activeUserId = useAppStore(state => state.activeUserId);
    const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = React.useState(false);

    const handleUserSwitch = () => {
        setIsProfileSwitcherOpen(true);
    };

    // Render Dock Item
    const renderDockItem = (id: TabType, Icon: any, label: string) => {
        const isActive = activeTab === id;
        return (
            <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative group p-3 rounded-2xl transition-all duration-300 hover:-translate-y-2
                    ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'}
                `}
                title={label}
            >
                <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                {isActive && (
                    <motion.div
                        layoutId="dock-indicator"
                        className={`absolute -bottom-1 left-1/2 w-1.5 h-1.5 ${highlightDotClass} rounded-full -translate-x-1/2 shadow-[0_0_8px_rgba(255,255,255,0.4)]`}
                    />
                )}
            </button>
        );
    };

    const themeConfig = user?.themeConfig || {};
    const wallpaper = themeConfig.wallpaper;
    const accentColor = themeConfig.accentColor || '#1a1b1e';
    const glassOpacity = themeConfig.glassOpacity !== undefined ? themeConfig.glassOpacity : 60;

    // Extract color name from tailwind class (e.g., text-indigo-400 -> indigo)
    const highlightColorClass = user?.color ? user.color.replace('text-', 'bg-').replace('-400', '') : 'bg-white';
    const highlightDotClass = highlightColorClass.includes('white') || highlightColorClass.includes('black')
        ? highlightColorClass
        : `${highlightColorClass}-400`;

    return (
        <div className="relative w-full h-screen overflow-hidden flex flex-col bg-black">

            {/* Custom Background Wallpaper or Tabbie default */}
            <div className={`absolute inset-0 z-0 bg-black moving-gradient-bg transition-all duration-1000 ${activeUserId === 'admin' ? 'bg-red-950/20' : ''}`}>
                {wallpaper ? (
                    <img src={wallpaper} className="w-full h-full object-cover opacity-80" alt="Wallpaper" />
                ) : (
                    <>
                        <div className="absolute top-0 left-0 w-2/3 h-2/3 bg-gradient-to-br from-indigo-500/40 via-purple-500/20 to-transparent blur-3xl opacity-50 rounded-full mix-blend-screen" />
                        <div className="absolute bottom-0 right-0 w-2/3 h-2/3 bg-gradient-to-tl from-emerald-500/30 via-cyan-500/20 to-transparent blur-3xl opacity-50 rounded-full mix-blend-screen" />
                        <div className="absolute top-1/2 left-1/4 w-1/2 h-1/2 bg-gradient-to-r from-rose-500/20 to-orange-500/20 blur-3xl opacity-30 rounded-full mix-blend-screen" />
                    </>
                )}
                {/* Subtle Glow Overlay (Effect Color) */}
                <div
                    className="absolute inset-x-0 top-0 h-64 opacity-20 pointer-events-none blur-[100px]"
                    style={{ background: `radial-gradient(circle at 50% -20%, ${accentColor} 0%, transparent 70%)` }}
                />
                {/* Personalization Veil */}
                <div className="personalization-veil" />
            </div>

            {/* Main Window (Full Screen Style) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ backgroundColor: `rgba(10, 11, 14, ${glassOpacity / 100})` }}
                className="relative z-10 w-full h-full backdrop-blur-3xl border-t border-white/10 flex flex-col overflow-hidden theme-muted"
            >
                {/* Window Top Bar (Minimalist) */}
                <div className="h-12 w-full flex items-center px-6 shrink-0 bg-[#1e1f23]/30 border-b border-white/5 justify-between">
                    {/* Window Title (Left) */}
                    <div className="flex items-center">
                        <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">{activeTab === 'mission' ? 'Dashboard' : activeTab}</span>
                    </div>

                    {/* Right side controls */}
                    <div className="flex justify-end items-center gap-4">
                        <button onClick={onOpenSettings} className="text-gray-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10">
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                {/* Window Content */}
                <div className="flex-1 overflow-hidden relative">
                    {children}
                </div>
            </motion.div>

            {/* Bottom Floating Dock */}
            <div className="absolute bottom-6 z-20">
                <div className="flex items-center gap-2 bg-[#1a1b1e]/80 backdrop-blur-2xl px-6 py-3 rounded-[32px] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    {renderDockItem('mission', LayoutIcon, 'Dashboard')}
                    {renderDockItem('tasks', Target, 'Aufgaben')}
                    {renderDockItem('workspaces', Layers, 'Workspaces')}
                    {renderDockItem('chrono', Calendar, 'Kalender')}
                    {renderDockItem('habits', Flame, 'Gewohnheiten')}
                    {renderDockItem('screentime', Activity, 'Bildschirmzeit')}
                    {renderDockItem('mail', Mail, 'Postfach')}
                    <div className="w-8 h-px bg-white/10 my-2" />

                    {/* User Profile in Dock */}
                    <button
                        onClick={handleUserSwitch}
                        className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-white/20 transition-all bg-[#2a2b30] flex items-center justify-center text-lg shadow-lg"
                    >
                        {user?.avatar.startsWith('http') || user?.avatar.startsWith('data') ? (
                            <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                        ) : (
                            <span>{user?.avatar || '👤'}</span>
                        )}
                    </button>

                    {activeUserId === 'admin' && (
                        renderDockItem('admin', Shield, 'Admin')
                    )}
                </div>
            </div>

            <ProfileSwitcher
                isOpen={isProfileSwitcherOpen}
                onClose={() => setIsProfileSwitcherOpen(false)}
            />
        </div>
    );
}
