import { useState, useEffect } from 'react';
import { haService } from '../utils/haService';
import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';

interface MediaControllerProps {
    entityId: string;
}

export default function MediaController({ entityId }: MediaControllerProps) {
    const [mediaState, setMediaState] = useState<any>(null);

    // Poll HA for media player state
    useEffect(() => {
        if (!entityId) return;

        const fetchState = async () => {
            try {
                const state = await haService.getEntityState(entityId);
                setMediaState(state);
            } catch (e) {
                console.error("Failed to fetch media state", e);
            }
        };

        fetchState();
        const interval = setInterval(fetchState, 5000); // Poll every 5s for now
        return () => clearInterval(interval);
    }, [entityId]);

    if (!mediaState) {
        return (
            <div className="w-full h-full bg-white/5 rounded-3xl flex items-center justify-center p-6 border border-white/5">
                <p className="text-gray-500 text-sm">Media Player nicht gefunden</p>
            </div>
        );
    }

    const { state, attributes } = mediaState;
    const isPlaying = state === 'playing';

    // Construct the absolute URL for the album art if it's a relative path from HA
    const haUrl = import.meta.env.VITE_HA_URL || '';
    const albumArtUrl = attributes.entity_picture
        ? (attributes.entity_picture.startsWith('http') ? attributes.entity_picture : `${haUrl}${attributes.entity_picture}`)
        : null;

    const togglePlay = () => {
        haService.callService('media_player', 'media_play_pause', { entity_id: entityId });
        setMediaState({ ...mediaState, state: isPlaying ? 'paused' : 'playing' });
    };

    const nextTrack = () => haService.callService('media_player', 'media_next_track', { entity_id: entityId });
    const prevTrack = () => haService.callService('media_player', 'media_previous_track', { entity_id: entityId });

    return (
        <div className="w-full h-full rounded-3xl overflow-hidden relative flex flex-col justify-end p-6 border border-white/10 shadow-2xl group">
            {/* Dynamic Background */}
            {albumArtUrl ? (
                <>
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105 group-hover:scale-110"
                        style={{ backgroundImage: `url(${albumArtUrl})` }}
                    />
                    {/* Glassy Overlay to make text readable */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent backdrop-blur-[2px]" />
                </>
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-80" />
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col gap-2">
                <div className="flex justify-between items-end mb-2">
                    <div className="min-w-0 flex-1 pr-4">
                        <h3 className="text-xl font-bold text-white truncate drop-shadow-md">
                            {attributes.media_title || attributes.friendly_name || 'Keine Wiedergabe'}
                        </h3>
                        <p className="text-sm font-medium text-gray-300 truncate drop-shadow-md">
                            {attributes.media_artist || attributes.media_album_name || 'Unbekannt'}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-4 mt-2">
                    <div className="flex items-center gap-4">
                        <button onClick={prevTrack} className="text-white/70 hover:text-white transition-colors">
                            <SkipBack size={24} fill="currentColor" />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                        >
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                        </button>
                        <button onClick={nextTrack} className="text-white/70 hover:text-white transition-colors">
                            <SkipForward size={24} fill="currentColor" />
                        </button>
                    </div>
                    {/* Optional Volume Placeholder */}
                    <div className="flex items-center gap-2 text-white/50 hover:text-white transition-colors cursor-pointer">
                        <Volume2 size={18} />
                    </div>
                </div>
            </div>
        </div>
    );
}
