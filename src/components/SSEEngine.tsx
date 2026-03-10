import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function SSEEngine() {
    const isHydrated = useAppStore(state => state.isHydrated);
    const currentUser = useAppStore(state => state.currentUser);
    const setLatestMqttEvent = useAppStore(state => state.setLatestMqttEvent);
    const setSparkSuggestion = useAppStore(state => state.setSparkSuggestion);
    const setShowSparkBubble = useAppStore(state => state.setShowSparkBubble);

    const activeUserId = useAppStore(state => state.activeUserId);
    const user = currentUser();

    useEffect(() => {
        if (!isHydrated) return;

        // Determine correct backend URL
        const mailConfig = user?.mailConfig;
        const bridgeUrl = mailConfig?.mailBridgeUrl || window.location.origin;

        let eventSource: EventSource | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout>;

        const connectSSE = () => {
            console.log('[SSEEngine] Connecting to Live Stream at', bridgeUrl);
            eventSource = new EventSource(`${bridgeUrl}/api/stream`);

            eventSource.onopen = () => {
                console.log('[SSEEngine] Connected.');
            };

            eventSource.onmessage = async (e) => {
                try {
                    const data = JSON.parse(e.data);

                    if (data.event === 'connected') {
                        return; // Initial ping
                    }

                    if (data.topic && data.payload) {
                        console.log('[SSEEngine] Received MQTT Event:', data.topic, data.payload);
                        setLatestMqttEvent({ topic: data.topic, payload: data.payload });

                        // Check if it's a Persona Engine response
                        if (data.topic === 'life_os/persona/speak' && user?.aiSettings?.enabled) {
                            try {
                                const payloadObj = JSON.parse(data.payload);
                                if (payloadObj.message) {
                                    setSparkSuggestion({
                                        action: payloadObj.action || 'tip',
                                        message: payloadObj.message
                                    });
                                    setShowSparkBubble(true);

                                    // Auto-hide after 10 seconds
                                    setTimeout(() => {
                                        setShowSparkBubble(false);
                                        setTimeout(() => setSparkSuggestion(null), 300);
                                    }, 10000);
                                }
                            } catch (err) {
                                console.error('[SSEEngine] Failed to parse persona speak payload:', err);
                            }
                        }
                    }
                } catch (error) {
                    console.error('[SSEEngine] Failed to parse message:', error, e.data);
                }
            };

            eventSource.onerror = (err) => {
                console.error('[SSEEngine] EventSource Error:', err);
                eventSource?.close();
                // Attempt to reconnect in 5 seconds
                reconnectTimeout = setTimeout(connectSSE, 5000);
            };
        };

        connectSSE();

        return () => {
            if (eventSource) eventSource.close();
            clearTimeout(reconnectTimeout);
        };
    }, [isHydrated, user?.aiSettings?.enabled, activeUserId]);

    return null; // Silent Engine Component
}
