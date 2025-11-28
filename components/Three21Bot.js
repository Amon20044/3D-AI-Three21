import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import html2canvas from 'html2canvas';
import AIPromptGenerator from './AIPromptGenerator';
import chatStorageManager from './ChatStorageManager';
import { Mic, MicOff, Send, Camera, X } from 'react-feather';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
// Error Boundary for Markdown rendering

// Memoized Markdown Component to prevent re-renders
const MarkdownMessage = React.memo(({ content }) => {
    // console.log('📝 MarkdownMessage rendering:', { contentLength: content?.length, preview: content?.substring(0, 20) });
    return (
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

    const { messages, sendMessage: sendMsg, setMessages, status, addToolOutput } = useChat({
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
        onFinish: async (result) => {
            console.log('✅ Chat finished:', result);
            await chatStorageManager.saveChatForModel(demoConfig || modelInfo, result.messages);
            // NOTE: Do NOT save here! The messages state hasn't updated yet.
            // Save happens in useEffect when messages actually updates.
        },
        onError: error => {
            console.error('An error occurred:', error);
        },
        onData: data => {
            console.log('Received data part from server:', data);
        },
        // async onToolCall({ toolCall }) {
        //     if (toolCall.dynamic) {
        //         return;
        //     }
        //     if (toolCall.toolName === 'searchGoogleScholar') {
        //         // No await - avoids potential deadlocks
        //         addToolOutput({
        //             tool: 'searchGoogleScholar',
        //             toolCallId: toolCall.toolCallId,
        //             output: toolCall.args[0].message,
        //         });
        //     }
        // },
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
                // Check if messages already have parts (new format) or need conversion (old format)
                const convertedMessages = existingMessages
                    .filter(msg => {
                        // Keep messages that have parts OR non-empty content
                        const hasParts = msg.parts && msg.parts.length > 0;
                        const hasContent = msg.content && msg.content.trim().length > 0;
                        return hasParts || hasContent;
                    })
                    .map(msg => {
                        // If message already has parts (new format), use them directly
                        if (msg.parts && msg.parts.length > 0) {
                            return {
                                id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                                role: msg.role,
                                parts: msg.parts, // Preserve all parts including tool calls!
                                metadata: msg.metadata,
                                createdAt: msg.createdAt || (msg.timestamp ? new Date(msg.timestamp) : new Date())
                            };
                        }

                        // Otherwise convert old format (just content string) to parts
                        return {
                            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                            role: msg.role,
                            parts: [{ type: 'text', text: msg.content || '' }],
                            createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date()
                        };
                    });

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

            console.log('🔍 saveChatToStorage:', {
                provided: messagesToSave?.length || 0,
                fromState: messages.length,
                target: targetMessages.length,
                sampleMessage: targetMessages[targetMessages.length - 1]
            });

            if (!targetMessages || targetMessages.length === 0) {
                console.warn('⚠️ No messages to save');
                return;
            }

            // Filter out the greeting if desired (keep all for now)
            const chatModelInfo = demoConfig || modelInfo;

            console.log(`💾 Saving ${targetMessages.length} messages to IndexedDB...`);
            await chatStorageManager.saveChatForModel(chatModelInfo, targetMessages);
            console.log('✅ Chat saved successfully to IndexedDB');
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
            console.log(`📩 New message detected (${messages.length} total) - scrolling`);
            scrollToBottom();
            lastMessageCountRef.current = messages.length;

            // Auto-save chat when messages update (debounced)
            const saveTimer = setTimeout(() => {
                // Skip saving just the greeting
                const isGreetingOnly = messages.length === 1 && messages[0].id === 'greeting';

                if (!isGreetingOnly && messages.length > 0) {
                    console.log(`💾 [useEffect] Auto-saving ${messages.length} messages...`);
                    saveChatToStorage();
                } else {
                    console.log(`⏭️ Skipping save (greeting only or empty)`);
                }
            }, 800); // Wait 800ms to ensure state is fully updated

            return () => clearTimeout(saveTimer);
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

    const handleClose = () => {
        // Save chat before closing
        console.log(`🚪 handleClose called - current messages: ${messages.length}`);
        if (messages.length > 1) { // Don't save just the greeting
            console.log('💾 Saving chat before closing...');
            saveChatToStorage();
        } else {
            console.log('⚠️ Not saving - only greeting or empty');
        }
        onClose();
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
                                {(() => {
                                    // Check if there's an active tool call
                                    const lastMessage = messages[messages.length - 1];
                                    const hasActiveToolCall = lastMessage?.role === 'assistant' &&
                                        lastMessage.parts?.some(p => p.type === 'tool-call' && p.state === 'call');

                                    if (isLoading) {
                                        return hasActiveToolCall
                                            ? '🔍 APIFY Actor Scraping Google Scholar...'
                                            : '🔄 Analyzing...';
                                    }
                                    return '✅ Ready';
                                })()}
                            </span>
                        </div>
                        {currentSelectedPart && (
                            <div className="selected-part">
                                <span>🎯 Focus: {typeof currentSelectedPart === 'object' ? currentSelectedPart.name : currentSelectedPart}</span>
                            </div>
                        )}
                    </div>
                    <div className="header-controls">
                        <button className="close-button" onClick={handleClose}>
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
                                    <>
                                        {message.parts?.map((part, index) => {
                                            // Handle different part types
                                            switch (part.type) {
                                                case 'text':
                                                    return part.text ? (
                                                        <MarkdownMessage
                                                            key={`text-${index}`}
                                                            content={part.text}
                                                        />
                                                    ) : null;

                                                // Handle typed tool parts (AI SDK 5.0)
                                                case 'tool-searchGoogleScholar': {
                                                    const callId = part.toolCallId;

                                                    return (
                                                        <div key={`tool-${callId}`} className="tool-call-container">
                                                            <div className="tool-call-header">
                                                                <span className="tool-icon">🔍</span>
                                                                <span className="tool-name">Google Scholar Search</span>
                                                                {part.state === 'input-streaming' && (
                                                                    <span className="tool-status preparing">Preparing query...</span>
                                                                )}
                                                                {part.state === 'input-available' && (
                                                                    <span className="tool-status searching">Searching...</span>
                                                                )}
                                                                {part.state === 'output-available' && (
                                                                    <span className="tool-status complete">✓ Complete</span>
                                                                )}
                                                                {part.state === 'output-error' && (
                                                                    <span className="tool-status error">Error</span>
                                                                )}
                                                            </div>

                                                            <div className="tool-call-body">
                                                                {/* Show query parameters when available */}
                                                                {(part.state === 'input-streaming' || part.state === 'input-available' || part.state === 'output-available') && part.input && (
                                                                    <>
                                                                        {/* Query parameter */}
                                                                        {part.input.query && (
                                                                            <div className="tool-param">
                                                                                <span className="param-label">Query:</span>
                                                                                <span className="param-value">{part.input.query}</span>
                                                                            </div>
                                                                        )}

                                                                        {/* Additional parameters */}
                                                                        <div className="tool-params-row">
                                                                            {part.input.minYear && (
                                                                                <div className="tool-param-small">
                                                                                    <span className="param-label">Min Year:</span>
                                                                                    <span className="param-value">{part.input.minYear}</span>
                                                                                </div>
                                                                            )}
                                                                            {part.input.maxYear && (
                                                                                <div className="tool-param-small">
                                                                                    <span className="param-label">Max Year:</span>
                                                                                    <span className="param-value">{part.input.maxYear}</span>
                                                                                </div>
                                                                            )}
                                                                            {part.input.maxItems && (
                                                                                <div className="tool-param-small">
                                                                                    <span className="param-label">Max Results:</span>
                                                                                    <span className="param-value">{part.input.maxItems}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}

                                                                {/* Results - show when output is available */}
                                                                {part.state === 'output-available' && part.output && (
                                                                    <div className="tool-result">
                                                                        {/* Handle error in output */}
                                                                        {part.output.error ? (
                                                                            <div className="result-error">
                                                                                <span>⚠️ {part.output.message || part.output.error}</span>
                                                                            </div>
                                                                        ) : (
                                                                            /* Handle array of results */
                                                                            Array.isArray(part.output.results) && part.output.results.length > 0 ? (
                                                                                <div className="result-success">
                                                                                    <div className="result-count">
                                                                                        📚 Found <strong>{part.output.results.length}</strong> papers
                                                                                    </div>
                                                                                    <div className="scholar-results-list">
                                                                                        <div>
                                                                                            Results fetched: {part.output.count}
                                                                                        </div>
                                                                                        {part.output.results.map((paper, idx) => (
                                                                                            <div key={paper.aidCode || idx} className="scholar-paper-card">
                                                                                                <div className="paper-number">{paper.resultIndex || idx + 1}</div>
                                                                                                <div className="paper-content">
                                                                                                    <a
                                                                                                        href={paper.link}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="paper-title-link"
                                                                                                    >
                                                                                                        {paper.title}
                                                                                                    </a>

                                                                                                    {/* Authors */}
                                                                                                    {paper.authors && (
                                                                                                        <p className="paper-authors">
                                                                                                            <strong>Authors:</strong> {paper.authors}
                                                                                                        </p>
                                                                                                    )}

                                                                                                    {/* Full attribution */}
                                                                                                    {paper.fullAttribution && (
                                                                                                        <p className="paper-attribution">{paper.fullAttribution}</p>
                                                                                                    )}

                                                                                                    {/* Search match snippet */}
                                                                                                    {paper.searchMatch && (
                                                                                                        <p className="paper-snippet">{paper.searchMatch}</p>
                                                                                                    )}

                                                                                                    <div className="paper-meta">
                                                                                                        {paper.year && (
                                                                                                            <span className="paper-year">📅 {paper.year}</span>
                                                                                                        )}
                                                                                                        {paper.citations !== undefined && paper.citations !== 0 && (
                                                                                                            <span className="paper-citations">
                                                                                                                📖 {paper.citations} citation{paper.citations !== 1 ? 's' : ''}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        {paper.publication && (
                                                                                                            <span className="paper-publication">📰 {paper.publication}</span>
                                                                                                        )}
                                                                                                        {paper.source && (
                                                                                                            <span className="paper-source">🌐 {paper.source}</span>
                                                                                                        )}
                                                                                                        {paper.type && (
                                                                                                            <span className="paper-type">📄 {paper.type}</span>
                                                                                                        )}
                                                                                                    </div>

                                                                                                    {/* Additional links */}
                                                                                                    <div className="paper-links">
                                                                                                        {paper.citationsLink && paper.citationsLink !== 'N/A' && (
                                                                                                            <a href={paper.citationsLink} target="_blank" rel="noopener noreferrer">
                                                                                                                View Citations
                                                                                                            </a>
                                                                                                        )}
                                                                                                        {paper.relatedArticlesLink && paper.relatedArticlesLink !== 'N/A' && (
                                                                                                            <a href={paper.relatedArticlesLink} target="_blank" rel="noopener noreferrer">
                                                                                                                Related Articles
                                                                                                            </a>
                                                                                                        )}
                                                                                                        {paper.versionsLink && paper.versionsLink !== 'N/A' && paper.versions > 0 && (
                                                                                                            <a href={paper.versionsLink} target="_blank" rel="noopener noreferrer">
                                                                                                                {paper.versions} Version{paper.versions !== 1 ? 's' : ''}
                                                                                                            </a>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="result-empty">No results found</div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Error State */}
                                                                {part.state === 'output-error' && (
                                                                    <div className="tool-result">
                                                                        <div className="result-error">
                                                                            <span>⚠️ {part.errorText || "An error occurred during search"}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Legacy support for old tool-call/tool-invocation types
                                                case 'tool-call':
                                                case 'tool-invocation': {
                                                    // Generic tool call fallback
                                                    return (
                                                        <div key={`tool-${part.toolCallId}`} className="tool-call-container">
                                                            <div className="tool-call-header">
                                                                <span className="tool-icon">🛠️</span>
                                                                <span className="tool-name">{part.toolName || 'Tool'}</span>
                                                                {part.state && (
                                                                    <span className="tool-status">{part.state}</span>
                                                                )}
                                                            </div>
                                                            <div className="tool-call-body">
                                                                <pre>{JSON.stringify(part, null, 2)}</pre>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                case 'dynamic-tool': {
                                                    // Handle dynamic tools
                                                    return (
                                                        <div key={`tool-${part.toolCallId}`} className="tool-call-container">
                                                            <div className="tool-call-header">
                                                                <span className="tool-icon">🔧</span>
                                                                <span className="tool-name">{part.toolName}</span>
                                                            </div>
                                                            {part.state === 'input-streaming' && (
                                                                <pre>{JSON.stringify(part.input, null, 2)}</pre>
                                                            )}
                                                            {part.state === 'output-available' && (
                                                                <pre>{JSON.stringify(part.output, null, 2)}</pre>
                                                            )}
                                                            {part.state === 'output-error' && (
                                                                <div>Error: {part.errorText}</div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                default:
                                                    return null;
                                            }
                                        })}
                                    </>
                                ) : (
                                    <>
                                        {message.parts?.map((part, index) => {
                                            if (part.type === 'text') {
                                                return <MarkdownMessage key={index} content={part.text} />;
                                            }

                                            // Handle tool invocations
                                            if (part.type === 'tool-invocation') {
                                                const toolInvocation = part.toolInvocation;
                                                const callId = toolInvocation.toolCallId;

                                                if (toolInvocation.toolName === 'searchGoogleScholar') {
                                                    // Render tool state
                                                    if (toolInvocation.state === 'call') {
                                                        return (
                                                            <div key={callId} className="tool-status searching">
                                                                <span className="animate-pulse">🔍 Searching Google Scholar...</span>
                                                            </div>
                                                        );
                                                    }
                                                    if (toolInvocation.state === 'result') {
                                                        const result = toolInvocation.result;
                                                        // If result has error property
                                                        if (result?.error) {
                                                            return (
                                                                <div key={callId} className="tool-status error">
                                                                    ❌ {result.error}
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div key={callId} className="tool-status success">
                                                                ✅ Found {result?.count || 0} papers
                                                            </div>
                                                        );
                                                    }
                                                }
                                            }

                                            return null;
                                        })}
                                        {!message.parts && <MarkdownMessage content={message.content} />}
                                    </>
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

                /* Tool Call Styles */
                .tool-call-container {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 1rem;
                    margin: 0.75rem 0;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }

                .tool-call-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid #334155;
                }

                .tool-icon {
                    font-size: 1.25rem;
                    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
                }

                .tool-name {
                    font-weight: 600;
                    color: #f1f5f9;
                    font-size: 0.9rem;
                }

                .tool-status {
                    margin-left: auto;
                    font-size: 0.75rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-weight: 500;
                }

                .tool-status.searching {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    animation: pulse 1.5s infinite;
                }

                .tool-status.complete {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                }

                .tool-call-body {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .tool-param {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .tool-params-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }

                .tool-param-small {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(30, 41, 59, 0.6);
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    border: 1px solid #334155;
                }

                .param-label {
                    color: #94a3b8;
                    font-size: 0.75rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .param-value {
                    color: #e2e8f0;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .tool-result {
                    margin-top: 0.5rem;
                    border-top: 1px solid #334155;
                    padding-top: 0.75rem;
                }

                .result-success {
                    color: #4ade80;
                }

                .result-count {
                    font-weight: 600;
                    font-size: 0.85rem;
                    margin-bottom: 0.75rem;
                    padding: 0.5rem 0.75rem;
                    background: rgba(34, 197, 94, 0.1);
                    border-left: 3px solid #4ade80;
                    border-radius: 4px;
                }

                .result-preview {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .paper-preview {
                    padding: 0.75rem;
                    background: rgba(30, 41, 59, 0.5);
                    border-radius: 8px;
                    border: 1px solid #334155;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .paper-title {
                    color: #f1f5f9;
                    font-size: 0.85rem;
                    font-weight: 500;
                    line-height: 1.4;
                }

                .paper-year {
                    color: #94a3b8;
                    font-size: 0.75rem;
                    font-weight: 400;
                }

                .paper-citations {
                    color: #fbbf24;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .scholar-results-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-top: 0.75rem;
                    max-height: 500px;
                    overflow-y: auto;
                    padding-right: 0.5rem;
                }

                .scholar-results-list::-webkit-scrollbar {
                    width: 6px;
                }

                .scholar-results-list::-webkit-scrollbar-track {
                    background: rgba(30, 41, 59, 0.4);
                    border-radius: 3px;
                }

                .scholar-results-list::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 3px;
                }

                .scholar-results-list::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                }

                .scholar-paper-card {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px solid #334155;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                }

                .scholar-paper-card:hover {
                    background: rgba(30, 41, 59, 0.6);
                    border-color: #475569;
                    transform: translateX(4px);
                }

                .paper-number {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    font-weight: 700;
                    font-size: 0.75rem;
                    border-radius: 6px;
                    flex-shrink: 0;
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                }

                .paper-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    min-width: 0;
                    overflow: hidden;
                }

                .paper-title-link {
                    color: #60a5fa;
                    font-weight: 600;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    text-decoration: none;
                    transition: color 0.2s ease;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    hyphens: auto;
                }

                .paper-title-link:hover {
                    color: #93c5fd;
                    text-decoration: underline;
                }

                .paper-authors {
                    color: #cbd5e1;
                    font-size: 0.75rem;
                    line-height: 1.4;
                    margin: 0;
                    word-wrap: break-word;
                }

                .paper-attribution {
                    color: #94a3b8;
                    font-size: 0.7rem;
                    line-height: 1.4;
                    margin: 0;
                    font-style: italic;
                    word-wrap: break-word;
                }

                .paper-snippet {
                    color: #94a3b8;
                    font-size: 0.75rem;
                    line-height: 1.5;
                    margin: 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    word-wrap: break-word;
                }

                .paper-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    align-items: center;
                }

                .paper-year,
                .paper-citations,
                .paper-publication,
                .paper-source,
                .paper-type {
                    padding: 0.25rem 0.5rem;
                    background: rgba(51, 65, 85, 0.5);
                    border-radius: 4px;
                    color: #cbd5e1;
                    font-weight: 500;
                    white-space: nowrap;
                }

                .paper-links {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-top: 0.25rem;
                }

                .paper-links a {
                    font-size: 0.7rem;
                    color: #60a5fa;
                    text-decoration: none;
                    padding: 0.25rem 0.5rem;
                    background: rgba(59, 130, 246, 0.1);
                    border-radius: 4px;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .paper-links a:hover {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: rgba(59, 130, 246, 0.5);
                    color: #93c5fd;
                }

                /* Responsive Styles for Mobile */
                @media (max-width: 768px) {
                    .scholar-paper-card {
                        flex-direction: column;
                        gap: 0.5rem;
                        padding: 0.75rem;
                    }

                    .paper-number {
                        width: 24px;
                        height: 24px;
                        font-size: 0.7rem;
                    }

                    .paper-title-link {
                        font-size: 0.8rem;
                    }

                    .paper-authors,
                    .paper-attribution,
                    .paper-snippet {
                        font-size: 0.7rem;
                    }

                    .paper-meta {
                        gap: 0.375rem;
                        font-size: 0.65rem;
                    }

                    .paper-year,
                    .paper-citations,
                    .paper-publication,
                    .paper-source,
                    .paper-type {
                        padding: 0.2rem 0.4rem;
                        font-size: 0.65rem;
                    }

                    .paper-links a {
                        font-size: 0.65rem;
                        padding: 0.2rem 0.4rem;
                    }

                    .tool-call-container {
                        padding: 0.75rem;
                    }

                    .scholar-results-list {
                        max-height: 400px;
                    }
                }

                .more-results {
                    color: #60a5fa;
                    font-size: 0.75rem;
                    font-weight: 500;
                    text-align: center;
                    padding: 0.5rem;
                    background: rgba(59, 130, 246, 0.1);
                    border-radius: 6px;
                    border: 1px dashed #3b82f6;
                }

                .result-error {
                    color: #f87171;
                    font-size: 0.85rem;
                    padding: 0.75rem;
                    background: rgba(239, 68, 68, 0.1);
                    border-left: 3px solid #ef4444;
                    border-radius: 4px;
                }

                .result-empty {
                    color: #94a3b8;
                    font-size: 0.85rem;
                    text-align: center;
                    padding: 0.75rem;
                    background: rgba(30, 41, 59, 0.4);
                    border-radius: 6px;
                    border: 1px dashed #475569;
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
                    font-size: 0.875em;
                    border: 1px solid #4b5563;
                }

                .tool-status {
                    font-size: 0.8rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    margin: 0.5rem 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 500;
                }

                .tool-status.searching {
                    background: rgba(59, 130, 246, 0.1);
                    color: #60a5fa;
                    border: 1px solid rgba(59, 130, 246, 0.2);
                }

                .tool-status.success {
                    background: rgba(16, 185, 129, 0.1);
                    color: #34d399;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .tool-status.error {
                    background: rgba(239, 68, 68, 0.1);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }

                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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
                    width: auto;
                    border-collapse: collapse;
                    font-size: 0.875rem;
                    background: #1f2937;
                }

                .markdown-thead {
                    background: #111827;
                }

                .markdown-th {
                    padding: 0.875rem 1rem;
                    text-align: left;
                    font-weight: 600;
                    color: #60a5fa;
                    border-bottom: 2px solid #3b82f6;
                    white-space: nowrap;
                    font-size: 0.875rem;
                }

                .markdown-td {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid #374151;
                    color: #f9fafb;
                    line-height: 1.6;
                }

                .markdown-tr:hover {
                    background: #374151;
                }

                .markdown-tbody .markdown-tr:last-child .markdown-td {
                    border-bottom: none;
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