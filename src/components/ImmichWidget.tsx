import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Camera } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface Photo {
    id: string;
    url: string;
    date: string;
}

export default function ImmichWidget() {
    const { users, activeUserId } = useAppStore();
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);

    const activeUser = users.find(u => u.id === activeUserId);
    const immichConfig = activeUser?.immichConfig;

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await fetch('/api/photos/on-this-day', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imUrl: immichConfig?.url,
                        imApiKey: immichConfig?.apiKey
                    })
                });
                if (!res.ok) throw new Error('Failed to fetch photos');
                const data = await res.json();
                setPhotos(data.photos || []);
            } catch (e) {
                console.error('Immich error', e);
            } finally {
                setLoading(false);
            }
        };
        fetchPhotos();
    }, [activeUserId]);

    return (
        <div className="flex flex-col h-full overflow-hidden group">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 select-none">
                    <Camera size={16} className="text-pink-400" /> On this Day
                </h2>
            </div>

            <div className="flex-1 relative pb-2 overflow-x-auto custom-scrollbar flex gap-4 items-center">
                {loading ? (
                    <div className="w-full flex justify-center items-center text-gray-500 gap-2">
                        <ImageIcon className="animate-pulse" size={20} /> <span className="text-sm font-medium">Lade Erinnerungen...</span>
                    </div>
                ) : photos.length === 0 ? (
                    <div className="w-full flex flex-col justify-center items-center text-gray-600 gap-2 h-full">
                        <ImageIcon size={32} className="opacity-20 text-pink-400" />
                        <span className="text-sm font-medium mt-1">Keine Fotos für heute.</span>
                    </div>
                ) : (
                    photos.map((photo, i) => (
                        <motion.div
                            key={photo.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1, ease: "easeOut" }}
                            className="flex-shrink-0 w-48 h-full rounded-2xl overflow-hidden relative shadow-lg"
                        >
                            <img src={photo.url} alt="Memory" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <p className="text-[13px] text-white font-semibold flex items-center gap-1.5">
                                    <Camera size={12} className="text-pink-400" />
                                    {new Date(photo.date).getFullYear()}
                                </p>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
