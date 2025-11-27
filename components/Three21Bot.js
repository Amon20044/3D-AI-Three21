import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import html2canvas from 'html2canvas';
import AIPromptGenerator from './AIPromptGenerator';
import chatStorageManager from './ChatStorageManager';
import { Mic, MicOff, Send, Camera, X } from 'react-feather';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
// Error Boundary for Markdown rendering
class MarkdownErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Markdown rendering error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Fallback to displaying raw text if markdown fails
            return (
                <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-200 p-2 border border-red-500/30 rounded bg-red-500/10">
                    {this.props.content}
                </div>
            );
        }

        return this.props.children;
    }
}

// Memoized Markdown Component to prevent re-renders
const MarkdownMessage = React.memo(({ content }) => {
    // console.log('📝 MarkdownMessage rendering:', { contentLength: content?.length, preview: content?.substring(0, 20) });
    return (
        <MarkdownErrorBoundary content={content}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    h1: ({ children }) => <h1 className="markdown-h1">{children}</h1>,
                    h2: ({ children }) => <h2 className="markdown-h2">{children}</h2>,
                    h3: ({ children }) => <h3 className="markdown-h3">{children}</h3>,
                    h4: ({ children }) => <h4 className="markdown-h4">{children}</h4>,
                    h5: ({ children }) => <h5 className="markdown-h5">{children}</h5>,
                    h6: ({ children }) => <h6 className="markdown-h6">{children}</h6>,
                    p: ({ children }) => <p className="markdown-p">{children}</p>,
                    ul: ({ children }) => <ul className="markdown-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="markdown-ol">{children}</ol>,
                    li: ({ children }) => <li className="markdown-li">{children}</li>,
                    strong: ({ children }) => <strong className="markdown-strong">{children}</strong>,
                    em: ({ children }) => <em className="markdown-em">{children}</em>,
                    code: ({ inline, children }) =>
                        inline ? (
                            <code className="markdown-code-inline">{children}</code>
                        ) : (
                            <code className="markdown-code-block">{children}</code>
                        ),
                    pre: ({ children }) => <pre className="markdown-pre">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="markdown-blockquote">{children}</blockquote>,
                    a: ({ href, children }) => (
                        <a href={href} className="markdown-link" target="_blank" rel="noopener noreferrer">
                            {children}
                        </a>
                    ),
                    table: ({ children }) => (
                        <div className="table-wrapper">
                            <table className="markdown-table">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="markdown-thead">{children}</thead>,
                    tbody: ({ children }) => <tbody className="markdown-tbody">{children}</tbody>,
                    tr: ({ children }) => <tr className="markdown-tr">{children}</tr>,
                    th: ({ children }) => <th className="markdown-th">{children}</th>,
                    td: ({ children }) => <td className="markdown-td">{children}</td>,
                    hr: () => <hr className="markdown-hr" />,
                    del: ({ children }) => <del className="markdown-del">{children}</del>,
                    input: ({ checked, ...props }) => (
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled
                            className="markdown-checkbox"
                            {...props}
                        />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </MarkdownErrorBoundary>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if content length changes significantly or if it's the final update
    // This helps with streaming performance but we must be careful not to block updates
    return prevProps.content === nextProps.content;
});

export default function Three21Bot({
    isOpen,
    onClose,
    modelInfo,
    demoConfig = null,
    selectedPart,
    onScreenshot,
    sceneAnalysis = null,
    autoScreenshot = null
}) {
    // const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [screenshot, setScreenshot] = useState(autoScreenshot);
    const [chatLoaded, setChatLoaded] = useState(false);
    const [aiPromptGenerator] = useState(() => new AIPromptGenerator());
    const [autoSendTimer, setAutoSendTimer] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speechTranscript, setSpeechTranscript] = useState('');
    const [speechError, setSpeechError] = useState('');
    const [currentSelectedPart, setCurrentSelectedPart] = useState(selectedPart); // Track selected part locally
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const recognitionRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const inputMessageRef = useRef(''); // Keep track of current input message
    const isLoadingHistoryRef = useRef(false); // Track if we're loading chat history
    const lastMessageCountRef = useRef(0); // Track message count to detect new messages

    const { messages, sendMessage: sendMsg, setMessages, status } = useChat({
        transport: new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: ({ messages }) => {
                // Filter out empty messages and convert to model format
                const validMessages = messages
                    .filter(msg => {
                        const text = msg.parts?.map(p => p.text || '').join('').trim() || msg.content?.trim() || '';
                        return text.length > 0; // Only include non-empty messages
                    });
                // .map(msg => ({
                //     role: msg.role,
                //     content: msg.parts?.map(p => p.text || '').join('') || msg.content || ''
                // }));

                console.log('📤 Sending', validMessages.length, 'valid messages');

                return {
                    body: {
                        messages: validMessages,
                        modelInfo: demoConfig || modelInfo,
                        selectedPart: currentSelectedPart,
                        screenshot: screenshot,
                        sceneAnalysis,
                        analysisContext: {
                            excludeUIElements: true,
                            focusOnModel: true,
                            researchGrade: true,
                            provideCitations: true,
                            provideLinks: true
                        }
                    }
                };
            }
        }),
        onFinish: (...args) => {
            console.log('✅ Chat finished. All args:', args);

            // useChat signature: onFinish(message, { messages })
            // - message: the current/latest message
            // - messages: all chat history
            let currentMessage = null;
            let allMessages = null;

            if (args.length >= 2 && args[1]?.messages) {
                // Standard signature: (message, options)
                currentMessage = args[0];
                allMessages = args[1].messages;
                console.log('📨 Current message:', currentMessage);
                console.log('📚 All messages:', allMessages.length, 'total');
            } else if (args.length === 1 && args[0]?.messages) {
                // Single object parameter
                allMessages = args[0].messages;
                console.log('📚 All messages:', allMessages.length, 'total');
            } else {
                // Fallback to current state
                console.log('⚠️ Unexpected onFinish signature, using current messages state');
                allMessages = messages;
            }

            if (!allMessages || allMessages.length === 0) {
                console.log('❌ No messages to save');
                return;
            }

            console.log('💾 Saving', allMessages.length, 'messages to storage...');
            saveChatToStorage(allMessages);
        },
        onError: error => {
            console.error('An error occurred:', error);
        },
        onData: data => {
            console.log('Received data part from server:', data);
        },

    });


    const isLoading = status === 'streaming' || status === 'submitted';

    // Update ref whenever inputMessage changes
    useEffect(() => {
        inputMessageRef.current = inputMessage;
    }, [inputMessage]);

    // Load existing chat when component opens
    useEffect(() => {
        if (isOpen && !chatLoaded && (modelInfo || demoConfig)) {
            loadExistingChat();
        }
    }, [isOpen, modelInfo, demoConfig, chatLoaded]);

    // Reset chat loaded state when model changes to force reload
    useEffect(() => {
        setChatLoaded(false);
        setMessages([]); // Clear existing messages when model changes
        console.log('🔄 Model changed - resetting chat state');
    }, [modelInfo?.filename, modelInfo?.fileSize, demoConfig?.filename]); // Track specific model identifiers

    const loadExistingChat = async () => {
        try {
            // Set flag to prevent auto-scroll during history load
            isLoadingHistoryRef.current = true;

            // Use demo config or regular model info for chat loading
            const chatModelInfo = demoConfig || modelInfo;
            console.log('🔄 Attempting to load chat for model:', chatModelInfo);

            const existingMessages = await chatStorageManager.loadChatForModel(chatModelInfo);
            console.log('📦 Raw messages from storage:', existingMessages);

            if (existingMessages.length > 0) {
                // Convert storage messages to useChat format and filter empty ones
                const convertedMessages = existingMessages
                    .filter(msg => msg.content && msg.content.trim().length > 0) // Only non-empty
                    .map(msg => ({
                        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                        role: msg.role,
                        parts: [{ type: 'text', text: msg.content || '' }],
                        createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date()
                    }));

                console.log('✨ Converted messages for UI:', convertedMessages);

                if (convertedMessages.length > 0) {
                    setMessages(convertedMessages);
                    lastMessageCountRef.current = convertedMessages.length;
                    console.log(`✅ Loaded ${convertedMessages.length} valid messages (filtered ${existingMessages.length - convertedMessages.length} empty)`);
                } else {
                    console.log('⚠️ No valid messages after conversion, showing greeting');
                    showInitialGreeting();
                    lastMessageCountRef.current = 1;
                }
            } else {
                // No existing chat, show initial greeting
                console.log('📭 No existing chat found in storage, showing greeting');
                showInitialGreeting();
                lastMessageCountRef.current = 1;
            }
            setChatLoaded(true);

            // Reset flag after a short delay to allow React to render
            setTimeout(() => {
                isLoadingHistoryRef.current = false;
            }, 100);
        } catch (error) {
            console.error('❌ Failed to load existing chat:', error);
            showInitialGreeting();
            lastMessageCountRef.current = 1;
            setChatLoaded(true);
            isLoadingHistoryRef.current = false;
        }
    };

    const saveChatToStorage = async (messagesToSave = null) => {
        try {
            // Use provided messages or fallback to state
            const targetMessages = messagesToSave || messages;

            if (!targetMessages || targetMessages.length === 0) {
                console.warn('⚠️ Attempted to save empty chat history');
                return;
            }

            console.log(`💾 Saving ${targetMessages.length} messages to storage...`);

            // Convert useChat messages (with parts) to storage format
            const chatModelInfo = demoConfig || modelInfo;
            const storageMessages = targetMessages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.parts?.map(p => p.type === 'text' ? p.text : '').join('') || msg.content || '',
                timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now()
            }));

            await chatStorageManager.saveChatForModel(chatModelInfo, storageMessages);
            console.log('✅ Chat saved successfully');
        } catch (error) {
            console.error('❌ Failed to save chat:', error);
        }
    };
    const showInitialGreeting = () => {
        // Set flag to prevent auto-scroll for greeting
        isLoadingHistoryRef.current = true;

        // Get model info from demo config or regular model info
        const currentModelInfo = demoConfig || modelInfo;

        const greeting = {
            id: 'greeting',
            role: 'assistant',
            parts: [{
                type: 'text', text: `# 🤖 Three21Bot - Advanced 3D Model Analysis Assistant

Welcome! I'm your specialized AI assistant for comprehensive 3D model analysis and reverse engineering.

${currentModelInfo ? `## Current Model: **${currentModelInfo.name || currentModelInfo.filename || 'Unnamed Model'}**
${currentModelInfo.description ? `*${currentModelInfo.description.substring(0, 200)}${currentModelInfo.description.length > 200 ? '...' : ''}*` : ''}

**📋 Model Details:**
${currentModelInfo.category ? `- **Category:** ${currentModelInfo.category}` : ''}
${currentModelInfo.manufacturer ? `- **Manufacturer:** ${currentModelInfo.manufacturer}` : ''}
${currentModelInfo.material ? `- **Material:** ${currentModelInfo.material}` : ''}
${currentModelInfo.purpose ? `- **Purpose:** ${currentModelInfo.purpose}` : ''}
${currentModelInfo.complexity ? `- **Complexity:** ${currentModelInfo.complexity}` : ''}
${currentModelInfo.tags && currentModelInfo.tags.length > 0 ? `- **Tags:** ${currentModelInfo.tags.slice(0, 5).join(', ')}${currentModelInfo.tags.length > 5 ? '...' : ''}` : ''}

` : ''}**🔬 Enhanced Analysis Capabilities:**
- 📷 **Visual Analysis** - Automated screenshot analysis (excluding UI elements)
- 🔍 **Component-Level Insights** - Double-click any part for detailed analysis
- ⚙️ **Reverse Engineering** - Manufacturing methods & design intent
- 📐 **Technical Documentation** - Standards, citations & references
- 🎯 **Research-Grade Output** - Academic quality insights with sources
- 🔗 **Study Resources** - Links to relevant research and documentation

**📊 Analysis Status:**
${autoScreenshot ? '✅ Auto-screenshot captured for reference' : '📷 Screenshot available on request'}
${selectedPart ? `🎯 Selected: ${selectedPart.name || 'Component'}` : '👆 Double-click any model part for component analysis'}
${sceneAnalysis ? `🔧 Scene analyzed: ${sceneAnalysis.meshCount} components` : ''}

**💡 Pro Tips:**
- I focus ONLY on your 3D model (UI elements are ignored in screenshots)
- Your model description helps me provide more accurate analysis
- Ask for study links and references for research purposes
- I can analyze manufacturing methods, materials, and design decisions
- All chats are saved locally for this specific model
- ~Strikethrough test~ (GFM check)

| Feature | Status |
| :--- | :--- |
| Table Rendering | ✅ |
| GFM Support | ✅ |

What aspect of your model would you like to explore first?` }],
            createdAt: new Date()
        };

        setMessages([greeting]);
        lastMessageCountRef.current = 1;

        // Reset flag after render
        setTimeout(() => {
            isLoadingHistoryRef.current = false;
        }, 100);
    };

    // Load existing chat when component opens or model changes
    useEffect(() => {
        if (isOpen && !chatLoaded && (modelInfo || demoConfig)) {
            loadExistingChat();
        } else if (isOpen && !chatLoaded && !modelInfo && !demoConfig) {
            showInitialGreeting();
        }
    }, [isOpen, modelInfo?.filename, demoConfig?.filename]); // Only reload if model actually changes

    // Track selectedPart changes for debugging and state updates - CRITICAL FIX
    useEffect(() => {
        console.log('🎯 Selected part prop changed:', {
            newPart: selectedPart,
            currentPart: currentSelectedPart,
            isEqual: JSON.stringify(selectedPart) === JSON.stringify(currentSelectedPart)
        });

        // Always update the local state when prop changes
        if (JSON.stringify(selectedPart) !== JSON.stringify(currentSelectedPart)) {
            console.log('✅ Updating currentSelectedPart state');
            setCurrentSelectedPart(selectedPart);

            // Force UI refresh to show updated selected part
            if (messages.length > 0) {
                const updatedMessages = [...messages];
                setMessages(updatedMessages);
            }
        }
    }, [selectedPart]); // Remove currentSelectedPart from deps to avoid circular updates

    // Auto-scroll to bottom ONLY for new messages (not when loading history)
    useEffect(() => {
        // Don't scroll if we're loading history
        if (isLoadingHistoryRef.current) {
            console.log('📜 Loading history - skipping auto-scroll');
            return;
        }

        // Only scroll if message count increased (new message added)
        if (messages.length > lastMessageCountRef.current) {
            console.log('📩 New message detected - scrolling to bottom');
            scrollToBottom();
            lastMessageCountRef.current = messages.length;
        }
    }, [messages]);

    // Initialize speech recognition (only once)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript + ' ';
                        } else {
                            interimTranscript += transcript;
                        }
                    }

                    // Update the input with final transcript
                    if (finalTranscript) {
                        setInputMessage(prev => prev + finalTranscript);
                        setSpeechTranscript('');

                        // Reset the 4-second inactivity timer
                        if (inactivityTimerRef.current) {
                            clearTimeout(inactivityTimerRef.current);
                        }

                        // Start new inactivity timer for auto-send
                        inactivityTimerRef.current = setTimeout(() => {
                            console.log('🚀 Auto-sending after 4 seconds of inactivity');
                            const messageToSend = inputMessageRef.current;

                            // Stop recognition
                            try {
                                recognitionRef.current?.stop();
                            } catch (e) { }

                            setIsListening(false);
                            setSpeechTranscript('');

                            // Send message if there's content using the sendMessage function
                            if (messageToSend.trim()) {
                                console.log('📤 Sending:', messageToSend);
                                setInputMessage('');
                                sendMessage(messageToSend);
                            }

                            // Clear timer ref
                            inactivityTimerRef.current = null;
                        }, 4000);
                    } else {
                        setSpeechTranscript(interimTranscript);
                    }
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    setSpeechError(`Speech error: ${event.error}`);
                    setIsListening(false);

                    if (inactivityTimerRef.current) {
                        clearTimeout(inactivityTimerRef.current);
                        inactivityTimerRef.current = null;
                    }
                };

                recognition.onend = () => {
                    console.log('🎤 Recognition ended');
                    // Don't auto-restart, let the user control it
                    setIsListening(false);
                    setSpeechTranscript('');
                };

                recognitionRef.current = recognition;
                console.log('✅ Speech recognition initialized');
            } else {
                console.warn('⚠️ Speech recognition not supported in this browser');
                setSpeechError('Speech recognition not supported in this browser');
            }
        }

        // Cleanup on unmount
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
        };
    }, []); // Empty dependency array - initialize only once

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const captureScreenshot = async () => {
        try {
            console.log('📸 Capturing screenshot...');
            if (onScreenshot) {
                const screenshotData = await onScreenshot();
                console.log('📸 Screenshot captured:', {
                    hasData: !!screenshotData,
                    dataType: typeof screenshotData,
                    dataLength: screenshotData?.length,
                    sizeKB: screenshotData ? `${(screenshotData.length / 1024).toFixed(2)} KB` : 'N/A',
                    preview: screenshotData?.substring(0, 50) + '...'
                });

                // Log the actual image to console (visible in browser dev tools)
                if (screenshotData) {
                    console.log('📸 Screenshot Image Preview:');
                    console.log('%c ', `
                        font-size: 1px;
                        padding: 100px 200px;
                        background: url(${screenshotData}) no-repeat;
                        background-size: contain;
                    `);

                    // Also create a downloadable link for verification
                    const img = new Image();
                    img.height = 1080;
                    img.width = 1920;
                    img.src = screenshotData;
                    img.onload = () => {
                        console.log('✅ Screenshot dimensions:', {
                            width: img.width,
                            height: img.height,
                            aspectRatio: (img.width / img.height).toFixed(2)
                        });
                    };
                }

                setScreenshot(screenshotData);
                return screenshotData;
            }
            console.warn('⚠️ No onScreenshot callback provided');
            return null;
        } catch (error) {
            console.error('❌ Screenshot failed:', error);
            return null;
        }
    };

    const sendMessage = async (messageText, includeScreenshot = false) => {
        if (!messageText.trim() && !includeScreenshot) return;

        // Capture screenshot if needed
        if (includeScreenshot && !screenshot) {
            const captured = await captureScreenshot();
            if (captured) {
                setScreenshot(captured);
            }
        }

        // Send message - screenshot will be picked up from state by prepareSendMessagesRequest
        sendMsg({ text: messageText || 'Please analyze this screenshot of the model' });

        // Clear screenshot after sending
        if (screenshot || includeScreenshot) {
            setTimeout(() => setScreenshot(null), 100);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputMessage.trim()) {
            sendMessage(inputMessage);
            setInputMessage(''); // Clear input after sending
        }
    };

    const handleScreenshotAnalysis = async () => {
        await sendMessage('', true);
    };

    const startListening = () => {
        if (!recognitionRef.current) {
            setSpeechError('Speech recognition not supported in this browser');
            return;
        }

        try {
            setSpeechError('');
            setSpeechTranscript('');
            setIsListening(true);
            recognitionRef.current.start();
            console.log('🎤 Started listening...');
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            setSpeechError('Failed to start listening');
            setIsListening(false);
        }
    };

    const stopListening = (autoSend = false) => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.log('Stop recognition error:', e);
            }
        }

        setIsListening(false);
        setSpeechTranscript('');

        // Clear inactivity timer
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }

        // Auto-send if requested and there's a message
        if (autoSend) {
            // Use a small timeout to ensure inputMessage state is updated
            setTimeout(() => {
                const currentInput = inputMessage.trim();
                if (currentInput) {
                    console.log('📤 Auto-sending message:', currentInput);
                    sendMessage(currentInput);
                }
            }, 100);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            stopListening(false);
        } else {
            startListening();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="three21-bot-overlay">
            <div className="three21-bot-container" ref={chatContainerRef}>
                {/* Header */}
                <div className="three21-bot-header">
                    <div className="header-content">
                        <div className="bot-avatar">
                            <span>🤖</span>
                        </div>
                        <div className="bot-info">
                            <h3>Three21Bot</h3>
                            <span className="bot-status">
                                {isLoading ? '🔄 Analyzing...' : '✅ Ready'}
                            </span>
                        </div>
                        {currentSelectedPart && (
                            <div className="selected-part">
                                <span>🎯 Focus: {typeof currentSelectedPart === 'object' ? currentSelectedPart.name : currentSelectedPart}</span>
                            </div>
                        )}
                    </div>
                    <div className="header-controls">
                        <button className="close-button" onClick={onClose}>
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="three21-bot-messages">
                    {messages.map((message) => (
                        <div key={message.id} className={`message ${message.role}`}>
                            <div className="message-content">
                                {message.role === 'assistant' ? (
                                    <MarkdownMessage
                                        content={message.parts?.map(p => p.text || '').join('') || message.content || ''}
                                    />
                                ) : (
                                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-200">
                                        {message.parts?.map((part, index) =>
                                            part.type === 'text' ? <span key={index}>{part.text}</span> : null
                                        ) || message.content}
                                    </div>
                                )}
                            </div>
                            <div className="message-timestamp">
                                {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                    {status === 'submitted' && (
                        <div className="message assistant">
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="three21-bot-input">
                    <div className="quick-actions">
                        <button
                            className="quick-action-btn screenshot-btn"
                            onClick={handleScreenshotAnalysis}
                            disabled={isLoading}
                        >
                            <Camera size={14} />
                            <span>Analyze Current View</span>
                        </button>
                        {screenshot && (
                            <span className="screenshot-ready">
                                <Camera size={12} />
                                Screenshot ready
                            </span>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="input-form">
                        <div className="input-container">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Ask about the model, parts, or engineering insights..."
                                disabled={isLoading}
                                className="message-input"
                            />

                            {/* Speech recognition feedback */}
                            {isListening && (
                                <div className="speech-feedback">
                                    <div className="speech-status">
                                        <span className="speech-indicator">
                                            <Mic size={14} />
                                            Listening...
                                        </span>
                                        {inactivityTimerRef.current && (
                                            <span className="auto-send-indicator">Auto-send in 4s</span>
                                        )}
                                    </div>
                                    {speechTranscript && (
                                        <div className="interim-text">{speechTranscript}</div>
                                    )}
                                </div>
                            )}

                            {speechError && (
                                <div className="speech-error">
                                    ⚠️ {speechError}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className={`mic-button ${isListening ? 'listening' : ''}`}
                            onClick={toggleListening}
                            disabled={isLoading}
                            title={isListening ? 'Stop listening' : 'Start voice input'}
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>

                        <button
                            type="submit"
                            disabled={isLoading || !inputMessage.trim()}
                            className="send-button"
                        >
                            {isLoading ? (
                                <div className="loader-spin"></div>
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .three21-bot-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(8px);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    animation: overlayFadeIn 0.4s ease;
                }

                @keyframes overlayFadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                .three21-bot-container {
                    width: 100%;
                    max-width: 65rem;
                    height: 76vh;
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                    animation: containerSlideIn 0.3s ease;
                }

                .three21-bot-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #3b82f6;
                }

                @keyframes containerSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .three21-bot-header {
                    background: #111827;
                    border-bottom: 1px solid #374151;
                    padding: 1rem 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .three21-bot-header::before {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: #3b82f6;
                    opacity: 0.2;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex: 1;
                }

                .bot-avatar {
                    width: 3rem;
                    height: 3rem;
                    background: #3b82f6;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    color: white;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                }

                .bot-info h3 {
                    color: #f9fafb;
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 700;
                }

                .bot-status {
                    color: #9ca3af;
                    font-size: 0.8rem;
                    display: block;
                    margin-top: 0.25rem;
                    font-weight: 500;
                }

                .selected-part {
                    background: #eff6ff;
                    border: 1px solid #dbeafe;
                    padding: 0.5rem 0.875rem;
                    border-radius: 12px;
                    color: #3b82f6;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .sizecx{
                    font-size: 2rem;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .close-button {
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                    color: #1d3e75ff;
                    font-size: 2rem;
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 12px;
                    cursor: pointer;
                    margin-left: .5rem;
                    transition: all 0.2s ease;
                    display: flex;
                    padding: 0;
                    align-items: center;
                    justify-content: center;
                }

                .header-controls {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }

                .tts-button {
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                    color: #6b7280;
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .tts-button.active {
                    background: #10b981;
                    border-color: #059669;
                    color: white;
                }

                .tts-button:hover {
                    background: #e5e7eb;
                    border-color: #9ca3af;
                }

                .tts-button.active:hover {
                    background: #059669;
                }

                .tts-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .speech-button {
                    background: #f3f4f6;
                    border: 1px solid #d1d5db;
                    color: #6b7280;
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 1rem;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .speech-button.listening {
                    background: #ef4444;
                    border-color: #dc2626;
                    color: white;
                }

                .speech-button:hover {
                    background: #e5e7eb;
                    border-color: #9ca3af;
                }

                .speech-button.listening:hover {
                    background: #dc2626;
                }

                .speech-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .icon-pulse {
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .input-container {
                    flex: 1;
                    position: relative;
                    width: full;
                }

                .speech-feedback {
                    position: absolute;
                    top: -3.5rem;
                    left: 0;
                    right: 0;
                    background: #1f2937;
                    border: 1px solid #10b981;
                    border-radius: 12px;
                    padding: 0.75rem;
                    font-size: 0.8rem;
                    color: #10b981;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
                }

                .speech-status {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .speech-indicator {
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .auto-send-indicator {
                    font-size: 0.7rem;
                    color: #f59e0b;
                    font-weight: 500;
                    background: rgba(245, 158, 11, 0.1);
                    padding: 0.25rem 0.5rem;
                    border-radius: 6px;
                    border: 1px solid rgba(245, 158, 11, 0.3);
                }

                .interim-text {
                    color: #9ca3af;
                    font-style: italic;
                    background: #374151;
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: 1px solid #4b5563;
                    margin-top: 0.5rem;
                }

                .speech-error {
                    position: absolute;
                    top: -3rem;
                    left: 0;
                    right: 0;
                    background: #1f2937;
                    border: 1px solid #ef4444;
                    border-radius: 12px;
                    padding: 0.75rem;
                    font-size: 0.8rem;
                    color: #ef4444;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
                }

                .icon-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .close-button:hover {
                    background: #e5e7eb;
                    color: #374151;
                }

                .three21-bot-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    background: #1f2937;
                }

                .message {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .message.user {
                    align-items: flex-end;
                }

                .message.assistant {
                    align-items: flex-start;
                }

                .message-content {
                    max-width: 100%;
                    padding: 1rem 1.25rem;
                    border-radius: 16px;
                    font-size: 0.8rem;
                    line-height: 1.5;
                }

                .message.user .message-content {
                    background: #3b82f6;
                    color: white;
                    border-bottom-right-radius: 6px;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                }

                .message.assistant .message-content {
                    background: #111827;
                    color: #f9fafb;
                    border: 1px solid #374151;
                    border-bottom-left-radius: 6px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .message-timestamp {
                    font-size: 0.7rem;
                    color: #9ca3af;
                    margin: 0 1.25rem;
                    font-weight: 500;
                }

                .screenshot-indicator {
                    margin-top: 0.75rem;
                    padding: 0.5rem 0.875rem;
                    background: #eff6ff;
                    border: 1px solid #dbeafe;
                    border-radius: 10px;
                    font-size: 0.8rem;
                    color: #3b82f6;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .typing-indicator {
                    display: flex;
                    gap: 0.375rem;
                    align-items: center;
                    padding: 1rem;
                }

                .typing-indicator span {
                    width: 0.5rem;
                    height: 0.5rem;
                    background: #3b82f6;
                    border-radius: 50%;
                    animation: typingBounce 1.4s infinite ease-in-out;
                }

                .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

                @keyframes typingBounce {
                    0%, 80%, 100% { 
                        opacity: 0.4; 
                        transform: scale(0.8) translateY(0);
                    }
                    40% { 
                        opacity: 1; 
                        transform: scale(1.1) translateY(-4px);
                    }
                }

                .three21-bot-input {
                    background: #111827;
                    border-top: 1px solid #374151;
                    padding: 1rem 1.5rem;
                }

                .quick-actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .quick-action-btn {
                    background: #1f2937;
                    border: 1px solid #374151;
                    color: #f9fafb;
                    padding: 0.5rem 0.875rem;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .quick-action-btn:hover:not(:disabled) {
                    background: #374151;
                    border-color: #9ca3af;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .quick-action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .screenshot-ready {
                    color: #10b981;
                    font-size: 0.75rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .input-form {
                    display: flex;
                    gap: 0.5rem;
                    align-items: flex-end;
                }

                .message-input {
                    flex: 1;
                    width: 100%;
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 14px;
                    padding: 0.875rem 1rem;
                    color: #f9fafb;
                    font-size: 0.8rem;
                    outline: none;
                    transition: all 0.2s ease;
                    resize: none;
                    min-height: 2.75rem;
                    max-height: 7rem;
                    line-height: 1.4;
                }

                .message-input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                }

                .message-input::placeholder {
                    color: #6b7280;
                }

                .send-button {
                    background: #3b82f6;
                    border: none;
                    color: white;
                    width: 2.75rem;
                    height: 2.75rem;
                    border-radius: 14px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
                    flex-shrink: 0;
                }

                .send-button:hover:not(:disabled) {
                    background: #2563eb;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }

                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .mic-button {
                    background: #1f2937;
                    border: 1px solid #374151;
                    color: #9ca3af;
                    width: 2.75rem;
                    height: 2.75rem;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .mic-button:hover:not(:disabled) {
                    background: #374151;
                    color: #f9fafb;
                    border-color: #9ca3af;
                    transform: translateY(-1px);
                }

                .mic-button.listening {
                    background: #ef4444;
                    border-color: #ef4444;
                    color: white;
                    animation: pulse 1.5s infinite;
                }

                .mic-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .loader-spin {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
            `}</style>

            <style jsx global>{`
                /* Enhanced Markdown Styles - Dark Theme - Responsive */
                .markdown-h1 {
                    color: #f9fafb;
                    font-size: clamp(1.25rem, 4vw, 1.5rem);
                    margin: 1.5rem 0 1rem 0;
                    font-weight: 700;
                    line-height: 1.3;
                    border-bottom: 2px solid #374151;
                    padding-bottom: 0.5rem;
                }

                .markdown-h2 {
                    color: #f9fafb;
                    font-size: clamp(1.1rem, 3vw, 1.25rem);
                    margin: 1.25rem 0 0.75rem 0;
                    font-weight: 600;
                    line-height: 1.3;
                    border-bottom: 1px solid #374151;
                    padding-bottom: 0.375rem;
                }

                .markdown-h3 {
                    color: #e5e7eb;
                    font-size: clamp(1rem, 2.5vw, 1.125rem);
                    margin: 1rem 0 0.5rem 0;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .markdown-h4 {
                    color: #d1d5db;
                    font-size: 1rem;
                    margin: 0.875rem 0 0.375rem 0;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .markdown-h5 {
                    color: #d1d5db;
                    font-size: 0.925rem;
                    margin: 0.75rem 0 0.25rem 0;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .markdown-h6 {
                    color: #9ca3af;
                    font-size: 0.875rem;
                    margin: 0.5rem 0 0.25rem 0;
                    font-weight: 600;
                    line-height: 1.4;
                }

                .markdown-p {
                    margin: 0.75rem 0;
                    line-height: 1.75;
                    color: #f9fafb;
                    font-size: clamp(0.875rem, 2vw, 0.95rem);
                }

                .markdown-ul, .markdown-ol {
                    margin: 0.75rem 0;
                    padding-left: 1.5rem;
                    line-height: 1.75;
                }

                .markdown-ol {
                    list-style-type: decimal;
                }

                .markdown-li {
                    margin: 0.375rem 0;
                    line-height: 1.6;
                    color: #f9fafb;
                    font-size: clamp(0.875rem, 2vw, 0.95rem);
                }

                .markdown-li::marker {
                    color: #3b82f6;
                    font-weight: 600;
                }

                .markdown-strong {
                    color: #60a5fa;
                    font-weight: 700;
                }

                .markdown-em {
                    color: #93c5fd;
                    font-style: italic;
                }

                .markdown-code-inline {
                    background: #374151;
                    color: #fbbf24;
                    padding: 0.15rem 0.4rem;
                    border-radius: 4px;
                    font-family: 'SF Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
                    font-size: 0.85em;
                    border: 1px solid #4b5563;
                    white-space: pre-wrap; /* Allow wrapping on small screens */
                    word-break: break-word;
                }

                .markdown-pre {
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 1rem 0;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                .markdown-pre::-webkit-scrollbar {
                    height: 8px;
                }

                .markdown-pre::-webkit-scrollbar-track {
                    background: #111827;
                    border-radius: 4px;
                }

                .markdown-pre::-webkit-scrollbar-thumb {
                    background: #4b5563;
                    border-radius: 4px;
                }

                .markdown-code-block {
                    background: transparent;
                    color: #e5e7eb;
                    font-family: 'SF Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
                    font-size: 0.875rem;
                    line-height: 1.6;
                    display: block;
                }

                .markdown-blockquote {
                    border-left: 4px solid #3b82f6;
                    padding-left: 1rem;
                    margin: 1rem 0;
                    color: #d1d5db;
                    font-style: italic;
                    background: rgba(31, 41, 55, 0.5);
                    padding: 0.75rem 1rem;
                    border-radius: 0 8px 8px 0;
                }

                .markdown-link {
                    color: #60a5fa;
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: all 0.2s ease;
                    word-break: break-word; /* Prevent long links from breaking layout */
                }

                .markdown-link:hover {
                    color: #93c5fd;
                    border-bottom-color: #60a5fa;
                }

                .markdown-hr {
                    border: none;
                    border-top: 2px solid #374151;
                    margin: 2rem 0;
                }

                .markdown-del {
                    color: #9ca3af;
                    text-decoration: line-through;
                }

                .markdown-checkbox {
                    margin-right: 0.5rem;
                    accent-color: #3b82f6;
                    width: 1rem;
                    height: 1rem;
                    vertical-align: middle;
                }

                /* Table Wrapper for Horizontal Scroll */
                .table-wrapper {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    margin: 1.25rem 0;
                    border-radius: 8px;
                    border: 1px solid #374151;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }

                .table-wrapper::-webkit-scrollbar {
                    height: 8px;
                }

                .table-wrapper::-webkit-scrollbar-track {
                    background: #1f2937;
                    border-radius: 0 0 8px 8px;
                }

                .table-wrapper::-webkit-scrollbar-thumb {
                    background: #4b5563;
                    border-radius: 4px;
                }

                .table-wrapper::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                }

                /* Table Styles with Horizontal Overflow */
                .markdown-table {
                    width: 100%;
                    min-width: 100%;
                    border-collapse: collapse;
                    font-size: clamp(0.75rem, 2vw, 0.875rem); /* Responsive table text */
                    background: #1f2937;
                    margin: 0;
                }

                .markdown-thead {
                    background: #111827;
                    border-bottom: 2px solid #3b82f6;
                }

                .markdown-th {
                    padding: 0.875rem 1rem;
                    text-align: left;
                    font-weight: 600;
                    color: #60a5fa;
                    border: 1px solid #374151;
                    white-space: nowrap;    
                }

                .markdown-td {
                    padding: 0.75rem 1rem;
                    border: 1px solid #374151;
                    color: #f9fafb;
                    line-height: 1.6;
                }

                .markdown-tr:hover {
                    background: #374151;
                }

                .markdown-tbody .markdown-tr:last-child .markdown-td {
                    border-bottom: 1px solid #374151;
                }
            `}</style>

            <style jsx>{`
                /* Backwards compatibility for old table classes */
            .message-content table {
                width: auto;
            border-collapse: collapse;
            margin: 1rem 0;
            font-size: 0.875rem;
            background: #1f2937;
            border-radius: 8px;
            overflow: hidden;
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
                }

            .message-content table::-webkit-scrollbar {
                height: 8px;
                }

            .message-content table::-webkit-scrollbar-track {
                background: #374151;
            border-radius: 4px;
                }

            .message-content table::-webkit-scrollbar-thumb {
                background: #4b5563;
            border-radius: 4px;
                }

            .message-content table::-webkit-scrollbar-thumb:hover {
                background: #6b7280;
                }

            .message-content thead {
                background: #111827;
                }

            .message-content th {
                padding: 0.75rem 1rem;
            text-align: left;
            font-weight: 600;
            color: #3b82f6;
            border-bottom: 2px solid #3b82f6;
            white-space: nowrap;
                }

            .message-content td {
                padding: 0.75rem 1rem;
            border-bottom: 1px solid #374151;
            color: #f9fafb;
            line-height: 1.5;
                }

            .message-content tbody tr {
                transition: background 0.15s ease;
                }

            .message-content tbody tr:hover {
                background: #374151;
                }

            .message-content tbody tr:last-child td {
                border - bottom: none;
                }

                /* Table wrapper for better overflow control */
                .message-content > table {
                max - width: auto;
                }

            /* Custom Scrollbar */
            .three21-bot-messages::-webkit-scrollbar {
                width: 6px;
                }

            .three21-bot-messages::-webkit-scrollbar-track {
                background: #f3f4f6;
            border-radius: 3px;
                }

            .three21-bot-messages::-webkit-scrollbar-thumb {
                background: #d1d5db;
            border-radius: 3px;
            transition: background 0.2s ease;
                }

            .three21-bot-messages::-webkit-scrollbar-thumb:hover {
                background: #9ca3af;
                }

            /* Mobile-First Responsive Design */
            @media (max-width: 768px) {
                    .three21-bot-overlay {
                padding: 0.5rem;
                    }

            .three21-bot-container {
                height: 90dvh;
            border-radius: 1rem;
            max-width: none;
                    }

            .three21-bot-header {
                padding: 1rem 1.25rem;
                    }

            .three21-bot-messages {
                padding: 1rem 1.25rem;
            gap: 1rem;
                    }

            .three21-bot-input {
                padding: 1rem 1.25rem;
                    }

            .message-content {
                max - width: 95%;
            padding: 1rem;
            font-size: 0.875rem;
            line-height: 1.5;
                    }

            .header-content {
                gap: 0.75rem;
                    }

            .selected-part {
                display: none;
                    }

            .quick-actions {
                gap: 0.5rem;
            margin-bottom: 1rem;
                    }

            .bot-avatar {
                width: 3rem;
            height: 3rem;
            font-size: 1.125rem;
            border-radius: 0.875rem;
                    }

            .speech-feedback {
                top: -4rem;
            padding: 1rem;
            font-size: 0.875rem;
                    }

            .interim-text {
                padding: 0.75rem;
            margin-top: 0.75rem;
            font-size: 0.8rem;
                    }

            .tts-button, .speech-button {
                width: 2.75rem;
            height: 2.75rem;
            border-radius: 0.75rem;
                    }

            .close-button {
                width: 2.75rem;
            height: 2.75rem;
            border-radius: 0.75rem;
                    }
                }

            .quick-action-btn {
                padding: 0.5rem 0.75rem;
            font-size: 0.75rem;
                    }

            .message-input {
                padding: 0.75rem 1rem;
            font-size: 0.8rem;
            min-height: 2.5rem;
            border-radius: 12px;
                    }

            .send-button {
                width: 2.5rem;
            height: 2.5rem;
            font-size: 1rem;
            border-radius: 12px;
                    }

            .mic-button {
                width: 2.5rem;
            height: 2.5rem;
            border-radius: 12px;
                    }

            .input-form {
                gap: 0.5rem;
                    }

            .message-timestamp {
                font - size: 0.65rem;
            margin: 0 1rem;
                    }

            .screenshot-indicator {
                margin - top: 0.5rem;
            padding: 0.375rem 0.625rem;
            font-size: 0.7rem;
            border-radius: 8px;
                    }

            .screenshot-ready {
                font - size: 0.7rem;
                    }

            /* Enhanced Markdown Mobile Styles */
            .markdown-h1 {
                font - size: 1.125rem;
            margin: 0 0 0.5rem 0;
                    }

            .markdown-h2 {
                font - size: 1rem;
            margin: 1rem 0 0.5rem 0;
                    }

            .markdown-h3 {
                font - size: 0.875rem;
            margin: 0.75rem 0 0.375rem 0;
                    }

            .markdown-p {
                margin: 0.5rem 0;
            line-height: 1.5;
            font-size: 0.8rem;
                    }

            .markdown-ul {
                margin: 0.5rem 0;
            padding-left: 1rem;
                    }

            .markdown-li {
                margin: 0.25rem 0;
            line-height: 1.4;
            font-size: 0.8rem;
                    }

            .markdown-code {
                padding: 0.125rem 0.375rem;
            font-size: 0.7rem;
            border-radius: 4px;
                    }

            /* Mobile Table Styles */
            .message-content table {
                font - size: 0.75rem;
            margin: 0.75rem 0;
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            max-width: 100%;
                    }

            .message-content th,
            .message-content td {
                padding: 0.5rem 0.75rem;
            font-size: 0.75rem;
                    }

            .message-content th {
                white - space: nowrap;
            font-size: 0.7rem;
                    }

            .typing-indicator {
                padding: 0.5rem;
                    }

            .typing-indicator span {
                width: 0.375rem;
            height: 0.375rem;
                    }
                }

            /* Extra small screens */
            @media (max-width: 480px) {
                    .three21 - bot - overlay {
                padding: 0.25rem;
                    }

            .three21-bot-container {
                height: 90dvh;
            border-radius: 12px;
                    }

            .three21-bot-header {
                padding: 0.5rem 0.75rem;
                    }

            .three21-bot-messages {
                padding: 0.5rem 0.75rem;
            gap: 0.75rem;
                    }

            .three21-bot-input {
                padding: 0.5rem 0.75rem;
                    }

            .message-content {
                padding: 0.5rem 0.75rem;
            font-size: 0.75rem;
            line-height: 1.4;
                    }

            .bot-avatar {
                width: 2rem;
            height: 2rem;
            font-size: 0.875rem;
            border-radius: 10px;
                    }

            .bot-info h3 {
                font - size: 0.875rem;
                    }

            .bot-status {
                font - size: 0.65rem;
                    }

            .close-button {
                width: 1.75rem;
            height: 1.75rem;
            font-size: 0.75rem;
            border-radius: 8px;
                    }

            .quick-action-btn {
                padding: 0.375rem 0.5rem;
            font-size: 0.65rem;
                    }

            .message-input {
                padding: 0.5rem 0.75rem;
            font-size: 0.75rem;
            min-height: 2.25rem;
            border-radius: 10px;
                    }

            .send-button {
                width: 2.25rem;
            height: 2.25rem;
            font-size: 0.875rem;
            border-radius: 10px;
                    }

            .mic-button {
                width: 2.25rem;
            height: 2.25rem;
            border-radius: 10px;
                    }

            .quick-actions {
                margin - bottom: 0.5rem;
                    }

            .message-timestamp {
                font - size: 0.6rem;
            margin: 0 0.75rem;
                    }

            /* Ultra-compact markdown for tiny screens */
            .markdown-h1 {
                font - size: 1rem;
            margin: 0 0 0.375rem 0;
                    }

            .markdown-h2 {
                font - size: 0.875rem;
            margin: 0.75rem 0 0.375rem 0;
                    }

            .markdown-h3 {
                font - size: 0.8rem;
            margin: 0.5rem 0 0.25rem 0;
                    }

            .markdown-p {
                margin: 0.375rem 0;
            line-height: 1.4;
            font-size: 0.75rem;
                    }

            .markdown-li {
                margin: 0.125rem 0;
            font-size: 0.75rem;
                    }

            .markdown-ul {
                padding - left: 0.75rem;
                    }

            .markdown-code {
                font - size: 0.65rem;
            padding: 0.1rem 0.25rem;
                    }

            /* Extra Small Table Styles */
            .message-content table {
                font - size: 0.7rem;
            margin: 0.5rem 0;
                    }

            .message-content th,
            .message-content td {
                padding: 0.375rem 0.5rem;
            font-size: 0.7rem;
                    }

            .message-content th {
                font - size: 0.65rem;
                    }
                }

            `}</style>
        </div >
    );
}