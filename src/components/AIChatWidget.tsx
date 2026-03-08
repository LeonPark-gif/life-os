import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, X, MessageSquare, Mic, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { haService } from '../utils/haService';
import { ollamaService } from '../utils/ollamaService';
import { useAppStore, type ChatMessage } from '../store/useAppStore';

export default function AIChatWidget() {
    const currentUser = useAppStore(state => state.currentUser);
    const addChatMessage = useAppStore(state => state.addChatMessage);
    const clearChatHistory = useAppStore(state => state.clearChatHistory);
    const userObj = currentUser();
    const aiSettings = userObj.aiSettings;
    const messages = userObj.chatHistory || [];

    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    if (!aiSettings?.enabled || !aiSettings?.chatEnabled) return null;

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;
        await processCommand(input.trim());
    };

    const processCommand = async (commandText: string) => {
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: commandText,
            timestamp: new Date().toISOString()
        };

        addChatMessage(userObj.id, userMsg);
        setInput('');
        setIsProcessing(true);

        try {
            let replyText = "Befehl ausgeführt.";

            // ALWAYS route manual chat through Home Assistant.
            // Why? Because Gemini alone cannot control local Smart Home devices.
            // The Home Assistant Intent Engine needs to process it.

            // We ONLY inject context if context-awareness is on AND we know
            // we are talking to a smart agent (we'll assume the user put the right agent ID in HA)
            // Actually, we learned earlier that HA intent parser breaks with wrapped text.
            // So for chat, we ALWAYS send the raw text exactly as the user typed it.

            const response = await haService.processConversation(userMsg.text, aiSettings?.agentId);
            replyText = response?.response?.speech?.plain?.speech || response?.speech?.plain?.speech || response?.speech?.speech || "Befehl ausgeführt.";

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: replyText,
                timestamp: new Date().toISOString()
            };
            addChatMessage(userObj.id, aiMsg);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: "Entschuldigung, ich konnte Home Assistant nicht erreichen.",
                timestamp: new Date().toISOString()
            };
            addChatMessage(userObj.id, errorMsg);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- AUDIO RECORDING ---
    const handleAudioRecord = async () => {
        if (!userObj.aiSettings?.geminiApiKey) {
            alert("Ein Gemini API Key wird in den Einstellungen benötigt, um Audio-befehle nativ zu transkribieren.");
            return;
        }

        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    // Clean up tracks to stop mic indicator in browser
                    stream.getTracks().forEach(track => track.stop());

                    setIsProcessing(true);
                    try {
                        const reader = new FileReader();
                        reader.readAsDataURL(audioBlob);
                        reader.onloadend = async () => {
                            const base64Audio = reader.result as string;
                            const transcribedText = await ollamaService.analyzeAudio(base64Audio, audioBlob.type);

                            if (transcribedText && transcribedText !== "Unverständliches Audio.") {
                                await processCommand(transcribedText);
                            } else {
                                setIsProcessing(false);
                            }
                        };
                    } catch (error) {
                        console.error("Audio recording processing failed", error);
                        setIsProcessing(false);
                    }
                };

                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                console.error("Microphone access error", err);
                alert("Mikrofon-Zugriff fehlgeschlagen. Bitte erlaube den Zugriff.");
            }
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl w-80 md:w-96 h-[500px] shadow-2xl flex flex-col overflow-hidden mb-4"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-amber-400" />
                                <span className="font-bold text-white text-sm tracking-wide">{userObj.name}'s DaSilva-Assistent</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {messages.length > 0 && (
                                    <button onClick={() => clearChatHistory(userObj.id)} className="text-gray-500 hover:text-rose-400 transition-colors mr-2" title="Chatverlauf leeren">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                            {messages.length === 0 && (
                                <div className="text-center text-gray-500 text-sm italic mt-8">
                                    Frag {userObj.name}'s DaSilva-Assistenten etwas...
                                </div>
                            )}
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                        {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                    </div>
                                    <div className={`rounded-2xl p-3 text-sm max-w-[80%] ${msg.role === 'user'
                                        ? 'bg-indigo-600/20 text-indigo-100 rounded-tr-none'
                                        : 'bg-white/5 text-gray-200 rounded-tl-none border border-white/5'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isProcessing && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                                        <Loader2 size={14} className="animate-spin" />
                                    </div>
                                    <div className="bg-white/5 text-gray-400 text-xs rounded-2xl rounded-tl-none p-3 border border-white/5 flex items-center gap-1">
                                        Analysiere Daten<span className="animate-pulse">...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 bg-black/40 rounded-full px-4 py-2 border border-white/10 focus-within:border-indigo-500/50 transition-colors">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Schreibe dem DaSilva..."
                                    className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-gray-500"
                                    disabled={isProcessing}
                                />
                                <button
                                    onClick={handleAudioRecord}
                                    className={`transition-colors p-2 rounded-full ${isRecording ? 'text-rose-500 bg-rose-500/20 animate-pulse' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                                    disabled={isProcessing}
                                >
                                    <Mic size={16} />
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isProcessing}
                                    className={`ml-1 p-1.5 rounded-full transition-all ${input.trim() ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/5 text-gray-600'
                                        }`}
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center text-white border border-white/20 hover:border-white/40 transition-all group"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} className="group-hover:animate-pulse" />}
            </motion.button>
        </div>
    );
}
