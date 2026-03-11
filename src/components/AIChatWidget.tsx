import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, X, MessageSquare, Mic, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { nextcloudService, type NextcloudFile } from '../utils/nextcloudService';
import { haService } from '../utils/haService';
import { useAppStore, type ChatMessage } from '../store/useAppStore';
import { Folder, File, Paperclip } from 'lucide-react';

export default function AIChatWidget() {
    const currentUser = useAppStore(state => state.currentUser);
    const addChatMessage = useAppStore(state => state.addChatMessage);
    const clearChatHistory = useAppStore(state => state.clearChatHistory);
    const systemConfig = useAppStore(state => state.systemConfig);
    const userObj = currentUser();
    const aiSettings = userObj.aiSettings;
    const messages = userObj.chatHistory || [];

    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showFileBrowser, setShowFileBrowser] = useState(false);
    const [files, setFiles] = useState<NextcloudFile[]>([]);
    const [currentPath, setCurrentPath] = useState('/');
    const [attachedFile, setAttachedFile] = useState<NextcloudFile | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        if (showFileBrowser) {
            loadFiles(currentPath);
        }
    }, [showFileBrowser, currentPath]);

    const loadFiles = async (path: string) => {
        const list = await nextcloudService.listFiles(path);
        setFiles(list);
    };

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
            let isHACommand = false;

            // 1. First Pass: Is it a HA command?
            const haKeywords = ['licht', 'lampe', 'schalte', 'mach', 'heizung', 'rollo', 'steckdose', 'thermostat', 'temperatur', 'luftfeuchtigkeit', 'öffne', 'schließe'];
            const lowerInput = userMsg.text.toLowerCase();
            isHACommand = haKeywords.some(kw => lowerInput.includes(kw));

            // If a file is attached, ALWAYS use the general AI to analyze it
            if (attachedFile) {
                isHACommand = false;
            }

            if (isHACommand) {
                // Route directly to Home Assistant's native intent parser
                const haRes = await haService.processConversation(userMsg.text);
                const haSpeech = haRes?.response?.speech?.plain?.speech || haRes?.speech?.plain?.speech;

                if (haSpeech && !haSpeech.toLowerCase().includes('entschuldigung, ich habe das nicht verstanden')) {
                    replyText = haSpeech;
                } else {
                    isHACommand = false; // Fallback to Ollama if HA failed to understand
                }
            }

            // 2. Second Pass: Route to General LLM Backend (Ollama)
            if (!isHACommand) {
                let fileContent = null;
                if (attachedFile) {
                    fileContent = await nextcloudService.getFileContent(attachedFile.path);
                }

                // Call our backend proxy instead of HA directly to enable file context injection
                const res = await fetch('/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: messages.map(m => ({ role: m.role, content: m.text })).concat([{ role: 'user', content: userMsg.text }]),
                        fileContext: fileContent,
                        fileName: attachedFile?.name,
                        model: aiSettings?.geminiModel || systemConfig.ollamaModel,
                        stream: false
                    })
                });

                if (!res.ok) throw new Error('Backend error');
                const data = await res.json();
                replyText = data.choices[0]?.message?.content || "Befehl ausgeführt.";
            }

            // Clear attachment after sending
            setAttachedFile(null);

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

    // --- AUDIO RECORDING (Web Speech API) ---
    const handleAudioRecord = () => {
        if (isRecording) {
            // Stopping is handled by the browser automatically when speech ends,
            // or we could force stop it if we kept a reference.
            setIsRecording(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Dein Browser unterstützt die native Spracherkennung leider nicht.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsRecording(true);
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            setIsRecording(false);
            if (transcript) {
                await processCommand(transcript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsRecording(false);
            if (event.error !== 'no-speech') {
                alert("Spracherkennung fehlgeschlagen: " + event.error);
            }
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        try {
            recognition.start();
        } catch (err) {
            console.error("Could not start speech recognition", err);
            setIsRecording(false);
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

                        {/* File Browser Overlay */}
                        <AnimatePresence>
                            {showFileBrowser && (
                                <motion.div
                                    initial={{ opacity: 0, y: 100 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 100 }}
                                    className="absolute inset-0 bg-black/90 z-20 flex flex-col p-4"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-white font-bold text-sm">Nextcloud Browser</h3>
                                        <button onClick={() => setShowFileBrowser(false)} className="text-gray-400 hover:text-white">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-2 scrollbar-none">
                                        {currentPath !== '/' && (
                                            <button
                                                onClick={() => setCurrentPath(currentPath.split('/').slice(0, -2).join('/') + '/')}
                                                className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-2 text-indigo-300 text-sm"
                                            >
                                                <Folder size={14} /> ..
                                            </button>
                                        )}
                                        {files.map(file => (
                                            <button
                                                key={file.path}
                                                onClick={() => {
                                                    if (file.type === 'directory') {
                                                        setCurrentPath(file.path + '/');
                                                    } else {
                                                        setAttachedFile(file);
                                                        setShowFileBrowser(false);
                                                    }
                                                }}
                                                className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-2 text-gray-300 text-sm overflow-hidden"
                                            >
                                                {file.type === 'directory' ? <Folder size={14} className="text-indigo-400" /> : <File size={14} className="text-gray-400" />}
                                                <span className="truncate">{file.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Attached File Preview */}
                        {attachedFile && (
                            <div className="px-4 py-2 bg-indigo-500/10 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-indigo-300">
                                    <Paperclip size={12} />
                                    <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                                </div>
                                <button onClick={() => setAttachedFile(null)} className="text-gray-500 hover:text-rose-400">
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-3 border-t border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 bg-black/40 rounded-full px-4 py-2 border border-white/10 focus-within:border-indigo-500/50 transition-colors">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={attachedFile ? "Frage zur Datei..." : "Schreibe dem DaSilva..."}
                                    className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-gray-500"
                                    disabled={isProcessing}
                                />
                                <button
                                    onClick={() => setShowFileBrowser(true)}
                                    className="text-gray-500 hover:text-white transition-colors"
                                    title="Datei aus Nextcloud anhängen"
                                >
                                    <Paperclip size={16} />
                                </button>
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
