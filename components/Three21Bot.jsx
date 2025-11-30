'use client'
import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import html2canvas from 'html2canvas';
import AIPromptGenerator from './AIPromptGenerator';
import chatStorageManager from './ChatStorageManager';
import { Toast } from './Toast';
import { Mic, MicOff, Send, Camera, X } from 'react-feather';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import './three21bot.css'
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
                p: ({ children }) => {
                    // Process text nodes to convert #hashtags into styled spans
                    const processText = (node) => {
                        if (typeof node === 'string') {
                            const parts = node.split(/(#\w+)/g);
                            return parts.map((part, idx) => {
                                if (part.match(/^#\w+$/)) {
                                    return <code key={idx} className="markdown-code-inline">{part}</code>;
                                }
                                return part;
                            });
                        }
                        return node;
                    };

                    const processedChildren = React.Children.map(children, child => {
                        if (typeof child === 'string') {
                            return processText(child);
                        }
                        return child;
                    });

                    return <p className="markdown-p">{processedChildren}</p>;
                },
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
    autoScreenshot = null,
    className,
    style
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

    // Background processing state
    const [isProcessingInBackground, setIsProcessingInBackground] = useState(false);
    const [unreadResponseCount, setUnreadResponseCount] = useState(0);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const recognitionRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const inputMessageRef = useRef(''); // Keep track of current input message
    const isLoadingHistoryRef = useRef(false); // Track if we're loading chat history
    const lastMessageCountRef = useRef(0); // Track message count to detect new messages
    const wasOpenDuringStreamingRef = useRef(true); // Track if chatbot was open during streaming
    const screenshotRef = useRef(autoScreenshot); // Ref for immediate access to screenshot
    const currentSelectedPartRef = useRef(selectedPart); // Ref for immediate access to selected part


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
                        modelInfo: demoConfig || (modelInfo ? { ...modelInfo, modelStructure: undefined } : null), // Ensure modelStructure is removed
                        selectedPart: currentSelectedPartRef.current, // Use ref to get current value
                        screenshot: screenshotRef.current, // Use ref to get current value
                        // sceneAnalysis, // REMOVED: Too large for Vercel payload
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

            // Check if chatbot was closed during streaming (background mode)
            if (!wasOpenDuringStreamingRef.current) {
                console.log('🔔 Response completed in background - showing toast');
                setIsProcessingInBackground(false);
                setUnreadResponseCount(prev => prev + 1);
                setToastMessage('🤖 Your AI Assistant is ready with answers!');
                setShowToast(true);

                // Update browser tab title with notification
                if (typeof document !== 'undefined') {
                    document.title = '(1) Three21 - AI Response Ready';
                }
            }
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

    useEffect(() => {
        inputMessageRef.current = inputMessage;
    }, [inputMessage]);

    // Track chatbot visibility and clear unread count when opened
    useEffect(() => {
        wasOpenDuringStreamingRef.current = isOpen;

        // When chatbot opens, clear unread count and reset title
        if (isOpen && unreadResponseCount > 0) {
            console.log('👁️ Chatbot opened - clearing unread count');
            setUnreadResponseCount(0);
            setIsProcessingInBackground(false);
            if (typeof document !== 'undefined') {
                document.title = 'Three21 - 3D Model Analysis';
            }
        }
    }, [isOpen, unreadResponseCount]);

    // Detect when user closes chatbot during streaming (background mode)
    useEffect(() => {
        if (!isOpen && isLoading) {
            console.log('🔄 Chatbot closed during streaming - enabling background mode');
            setIsProcessingInBackground(true);
            wasOpenDuringStreamingRef.current = false;
        }
    }, [isOpen, isLoading]);

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
    // Using useLayoutEffect for synchronous update before paint
    useLayoutEffect(() => {
        console.log('🎯 Selected part prop changed:', {
            newPart: selectedPart,
            currentPart: currentSelectedPart,
            isEqual: JSON.stringify(selectedPart) === JSON.stringify(currentSelectedPart)
        });

        // Always update the local state when prop changes
        if (JSON.stringify(selectedPart) !== JSON.stringify(currentSelectedPart)) {
            console.log('✅ Updating currentSelectedPart state and ref');
            setCurrentSelectedPart(selectedPart);
            currentSelectedPartRef.current = selectedPart; // Update ref immediately!

            // 🚨 CLEAR STALE SCREENSHOT IMMEDIATELY
            // This prevents sending the *previous* screenshot if the user sends immediately
            console.log('🧹 Clearing stale screenshot');
            setScreenshot(null);
            screenshotRef.current = null;

            // Auto-capture screenshot when part is selected (for part context)
            if (selectedPart && onScreenshot) {
                const requestedPartName = selectedPart.name;
                console.log('📸 Auto-capturing screenshot for selected part:', requestedPartName);

                // Small delay to ensure highlight is rendered
                setTimeout(() => {
                    onScreenshot().then(capturedScreenshot => {
                        // Check if we are still on the same part
                        if (currentSelectedPartRef.current?.name === requestedPartName) {
                            if (capturedScreenshot) {
                                console.log('✅ Screenshot captured for:', requestedPartName);
                                setScreenshot(capturedScreenshot);
                                screenshotRef.current = capturedScreenshot;
                            }
                        } else {
                            console.log('⚠️ Discarding stale screenshot for:', requestedPartName, 'Current:', currentSelectedPartRef.current?.name);
                        }
                    }).catch(error => {
                        console.error('❌ Failed to capture screenshot for selected part:', error);
                    });
                }, 50);
            }

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
                screenshotRef.current = screenshotData; // Update ref immediately
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
                screenshotRef.current = captured;
            }
        }

        // Send message - screenshot will be picked up from state by prepareSendMessagesRequest
        const messageData = {
            text: messageText || 'Please analyze this screenshot of the model',
        };

        // Store screenshot reference to attach after message is created
        const screenshotData = screenshotRef.current ? {
            screenshot: screenshotRef.current
        } : null;

        sendMsg(messageData);

        // IMPORTANT: useChat's sendMessage doesn't preserve custom 'data' field
        // So we need to manually attach it after the message is added to the array
        if (screenshotData) {
            setTimeout(() => {
                setMessages(prevMessages => {
                    // Find the last user message (the one we just sent)
                    const updatedMessages = [...prevMessages];
                    for (let i = updatedMessages.length - 1; i >= 0; i--) {
                        if (updatedMessages[i].role === 'user') {
                            // Attach screenshot data to this message
                            updatedMessages[i] = {
                                ...updatedMessages[i],
                                data: screenshotData
                            };
                            console.log('📸 Attached screenshot data to user message:', updatedMessages[i].id);
                            break;
                        }
                    }
                    return updatedMessages;
                });
            }, 50); // Small delay to ensure message is in the array
        }

        // Clear screenshot after sending
        if (screenshot || includeScreenshot) {
            setTimeout(() => {
                setScreenshot(null);
                screenshotRef.current = null;
            }, 100);
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

    return (
        <>
            {/* Toast notification - always rendered to show background updates */}
            <Toast
                message={toastMessage}
                isVisible={showToast}
                onHide={() => setShowToast(false)}
                duration={5000}
            />

            {/* Chatbot overlay - always mounted, visibility controlled by styles */}
            <div className={`three21-bot-overlay ${className || ''}`} style={{
                zIndex: isOpen ? 999 : -999,
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                visibility: isOpen ? 'visible' : 'hidden',
                ...style
            }}>
                <div className="three21-bot-container" ref={chatContainerRef}>
                    {/* Header */}
                    <div className="three21-bot-header">
                        <div className="header-content">
                            <div className="bot-avatar">
                                <span>🤖</span>
                                {/* Unread badge indicator */}
                                {unreadResponseCount > 0 && (
                                    <span className="unread-badge">{unreadResponseCount}</span>
                                )}
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

                                                    default:
                                                        return null;
                                                }
                                            })}
                                        </>
                                    ) : (
                                        <>
                                            {/* Display screenshot if attached in metadata */}
                                            {message.data?.screenshot && (
                                                <div className="message-screenshot">
                                                    <img
                                                        src={
                                                            message.data.screenshot.startsWith('data:')
                                                                ? message.data.screenshot
                                                                : `data:image/png;base64,${message.data.screenshot}`
                                                        }
                                                        alt="Model screenshot"
                                                        className="screenshot-image"
                                                    />
                                                </div>
                                            )}
                                            <div className="user-message-text">
                                                {message.content || (message.parts?.map(p => p.text).join('')) || ''}
                                            </div>
                                        </>
                                    )}
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
                                    <div className="speech-status">
                                        <span className="speech-indicator">
                                            <Mic size={14} />
                                            Listening...
                                        </span>
                                        {inactivityTimerRef.current && (
                                            <span className="auto-send-indicator">Auto-send in 4s</span>
                                        )}
                                    </div>
                                )}
                                {speechTranscript && (
                                    <div className="interim-text">{speechTranscript}</div>
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
            </div>
        </>
    );
}
