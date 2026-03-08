import { useState } from 'react';
import { Smartphone, Monitor, Laptop, Clock, AlertTriangle, Play, Pause, RefreshCw, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock data to simulate screen time until we have a real backend integration
const MOCK_DEVICES = [
    { id: '1', name: 'Galaxy Tab S9', type: 'tablet', usedToday: 120, limit: 180, active: true },
    { id: '2', name: 'Gaming PC', type: 'desktop', usedToday: 210, limit: 120, active: false },
    { id: '3', name: 'iPhone 15', type: 'mobile', usedToday: 45, limit: 120, active: false },
];

export default function ScreentimeModule() {
    const [devices, setDevices] = useState(MOCK_DEVICES);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const toggleDeviceLock = (id: string, currentStatus: boolean) => {
        setDevices(devices.map(d => d.id === id ? { ...d, active: !currentStatus } : d));
        // Here we would call Home Assistant to physically lock/unlock networks or devices
        // haService.callService('switch', currentStatus ? 'turn_off' : 'turn_on', { entity_id: `switch.device_${id}_internet` })
    };

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="w-full h-full p-8 flex flex-col text-white overflow-hidden font-sans">
            <div className="flex justify-between items-end mb-8 relative z-10 shrink-0 px-2 lg:px-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Gerätesteuerung</h2>
                    <p className="text-gray-400">Bildschirmzeit und Netzwerkzugriff verwalten</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 bg-[#2a2b30] hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-white/5"
                >
                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> Sync
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 lg:px-8 custom-scrollbar pb-24">

                {/* Overall Summary Card */}
                <div className="bg-[#1e1f23] rounded-[24px] border border-white/5 p-8 mb-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
                    <div className="w-40 h-40 shrink-0 relative flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                            {/* Background circle */}
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[#2a2b30]" />
                            {/* Progress circle */}
                            <circle
                                cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                                strokeDasharray={`${2 * Math.PI * 40}`}
                                strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.min(1, 375 / 420))}`} // Mock total
                                strokeLinecap="round"
                                className="text-[#3b82f6] transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-white">6h 15m</span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Heute Gesamt</span>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <div className="bg-[#2a2b30] p-4 rounded-2xl flex items-center gap-4">
                            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl"><AlertTriangle size={20} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-400">Limit erreicht</h4>
                                <p className="text-lg font-bold text-white">1 Gerät</p>
                            </div>
                        </div>
                        <div className="bg-[#2a2b30] p-4 rounded-2xl flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><BarChart2 size={20} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-400">Durchschnitt</h4>
                                <p className="text-lg font-bold text-white">4h 30m</p>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">Überwachte Geräte</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {devices.map(device => {
                        const pct = Math.min(100, Math.round((device.usedToday / device.limit) * 100));
                        const isOver = device.usedToday > device.limit;

                        return (
                            <motion.div
                                key={device.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-[#1e1f23] rounded-[24px] border p-6 flex flex-col gap-6 transition-colors
                                ${isOver ? 'border-red-500/30 shadow-[0_4px_20px_rgba(239,68,68,0.1)]' : 'border-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-4 rounded-2xl flex items-center justify-center 
                                            ${device.type === 'desktop' ? 'bg-purple-500/10 text-purple-400' :
                                                device.type === 'tablet' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            {device.type === 'desktop' && <Monitor size={24} />}
                                            {device.type === 'tablet' && <Laptop size={24} />}
                                            {device.type === 'mobile' && <Smartphone size={24} />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{device.name}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1 font-medium">
                                                <span className={`w-2 h-2 rounded-full ${device.active ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                                                {device.active ? 'Online' : 'Offline / Gesperrt'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleDeviceLock(device.id, device.active)}
                                        className={`p-3 rounded-xl transition-all ${device.active ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
                                        title={device.active ? "Internet pausieren" : "Internet fortsetzen"}
                                    >
                                        {device.active ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                    </button>
                                </div>

                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className={isOver ? 'text-red-400' : 'text-gray-400'} />
                                            <span className={`text-2xl font-bold ${isOver ? 'text-red-400' : 'text-white'}`}>
                                                {formatTime(device.usedToday)}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-500">von {formatTime(device.limit)} Limit</span>
                                    </div>

                                    {/* Custom Progress Bar */}
                                    <div className="h-3 w-full bg-[#2a2b30] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-[#3b82f6]'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    {isOver && (
                                        <p className="text-xs text-red-400 font-bold mt-2 flex items-center gap-1">
                                            <AlertTriangle size={12} /> Limit überschritten. Gerät sollte über den Router gesperrt werden.
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
