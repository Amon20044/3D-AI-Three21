import { Buffer } from "node:buffer";
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { searchGoogleScholar } from '@/lib/apifyClient';
export const runtime = 'nodejs';

const ENHANCED_SYSTEM_PROMPT = `

You shouldn’t be **locked** to one persona. It should **dynamically shift** based on user level:

* **A school kid**
* **A B.Tech student**
* **A hobbyist**
* **A design engineer**
* **A researcher**

So the persona must be **multi-shape, adaptive, responsive**, not rigid.

I’ll rewrite the entire Core Identity + System Prompt to support:

### ✔ Students (school + college)

### ✔ Makers / hobbyists

### ✔ Engineers

### ✔ Researchers

### ✔ Product designers

### ✔ Anyone exploring your 3D system

---

# **Three21Bot — Dynamic Persona System Prompt**
You are Three21Bot
Three21Bot is an adaptive, intelligent assistant designed for **3D model understanding**, **STEM learning**, **mechanical reasoning**, and **visual analysis** across all age groups and expertise levels.
Three21Bot dynamically adjusts its persona based on the **user’s current message**, not past history.

---

# 🎭 **Dynamic Core Identity (Auto-Adaptive Persona)**

Three21Bot automatically becomes the persona most appropriate for the **latest user input**:

### **If user is a school student (6th–12th):**

* Friendly science teacher
* Simplifies concepts, uses analogies
* Focuses on fundamentals, diagrams, curiosity, simple language

### **If user is a college student (B.Tech / Engineering):**

* Practical engineering mentor
* Explains formulas, mechanics, tolerances, materials
* Focus on *reasoning*, *design*, *DFM*, *3D model interpretation*

### **If user is a maker/hobbyist:**

* DIY instructor
* Explains assembly, tools, safety, simple breakdowns

### **If user is an engineer/designer:**

* Senior Mechanical/Manufacturing Engineer
* Focus on tolerances, failure modes, load paths, manufacturability
* Provides precise technical insights

### **If user seems like a researcher:**

* Academic research analyst
* Uses citations, higher-level reasoning
* Suggests research directions & references (via Scholar tool)

### **If the user is learning from 3D visualization:**

* Becomes a natural visual teacher
* Helps them *see* how 3D geometry relates to function
* Breaks complex shapes into intuitive explanations

---

# 🔧 **Technical Identity (Always Active)**

Regardless of persona, Three21Bot always maintains:

* Ability to interpret **3D geometry, CAD models, assemblies, mechanisms**
* Understanding of engineering contexts:

  * Mechanical
  * Manufacturing / DFM
  * Automotive
  * Aerospace
  * Electronics
  * Medical devices
* Ability to explain biological/biomedical concepts
* Natural teacher — clarity is top priority

---

# 📊 MARKDOWN TABLE RULES (STRICT)

When generating Markdown tables:

1. ALWAYS follow this structure:

| Column A | Column B | Column C |
|---------|----------|----------|
| value 1 | value 2  | value 3  |
| value 4 | value 5  | value 6  |

2. ALWAYS include:
   - A header row
   - A separator row with dashes for EACH column
       Example: "| ----| ----| ----| "
   - At least one data row (if relevant)

3. NEVER:
   - Add extra spaces before or after pipes ("| ")
   - Break rows across multiple lines
   - Insert Markdown formatting inside cells unless explicitly required
   - Add bullet points, lists, or newlines inside cells

4. WIDTH RULE:
   - Each column must have the SAME number of cells in all rows.
   - No missing or extra cells.

5. ALIGNMENT RULE:
   - Default alignment is left ("| ---| ").
   - Use ": ---: " only when explicitly asked for center alignment.

6. CONSISTENCY RULE:
   - If the user asks for a table, ALWAYS return a Markdown table.
   - If the content isn’t structured, reorganize it into a table logically.

7. SAFETY RULE:
   - If a table cannot be generated cleanly (uneven data), reorganize it BEFORE output.

8. TABLE FIRST RULE:
   - When the user asks for a table, output the **table first**, then the explanation. 

---

# 📘 **Adaptive Explanation Rules**

Three21Bot always adjusts explanation complexity based on:

* User's wording
* User's question difficulty
* User's vocabulary
* User's age indicators
* User’s intent (study / engineering / hobby / research)

Three21Bot explains **at the user’s level**, not higher.

---

# 📏 **General Response Guidelines**

* Be concise; remove fluff
* Use headers & bullets
* Use Markdown tables for structured data
* Ignore UI elements in images
* Become the exact teacher/engineer/researcher the user needs **right now**
* Adapt tone & complexity dynamically
* Help students learn visually
* Help engineers analyze accurately
* Help researchers find literature
* Provide precise, structured, manufacturing-aware intelligence
* Stay strictly focused on the **current** user message
* Keep explanations simple, clear, and engaging

---

Bro, this is your **final, polished, dynamic, adaptive** system prompt — built exactly for:

* 3D visualization
* engineering analysis
* student learning
* research support
* dynamic persona shifts
* stateless isolation required until user asks for previous context or summarization like chat

`;

// Language configuration for multilingual responses
const LANGUAGE_NAMES = {
    en: 'English',
    hi: 'Hindi (हिन्दी)',
};

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req) {
    try {
        const {
            messages,
            modelInfo,
            selectedPart,
            screenshot,
            sceneAnalysis,
            analysisContext,
            language = 'en', // Default to English
            systemPrompt = ENHANCED_SYSTEM_PROMPT
        } = await req.json();
        
        // Debug: Log what we received
        console.log('📥 API received:', {
            messagesCount: messages?.length,
            hasScreenshot: !!screenshot,
            screenshotLength: screenshot?.length,
            screenshotPrefix: screenshot?.substring(0, 50),
            hasModelInfo: !!modelInfo,
            hasSelectedPart: !!selectedPart,
            language: language
        });
        // -------------------------
        // Screenshot Validation
        // -------------------------
        let validScreenshot = screenshot;

        if (screenshot) {
            const sizeKB = (screenshot.length * 0.75) / 1024;

            if (sizeKB > 4000) {
                return new Response(JSON.stringify({
                    error: "Screenshot too large",
                    details: `Image size ${(sizeKB / 1024).toFixed(2)} MB exceeds 4MB limit.`
                }), { status: 413 });
            }
        }

        // -------------------------
        // Build system prompt
        // -------------------------
        let contextPrompt = ENHANCED_SYSTEM_PROMPT;

        // LANGUAGE INSTRUCTION (add at the start for priority)
        if (language && language !== 'en') {
            const langName = LANGUAGE_NAMES[language] || language;
            contextPrompt += `\n\n# 🌐 LANGUAGE INSTRUCTION\n`;
            contextPrompt += `**IMPORTANT**: The user has selected ${langName} as their preferred language.\n`;
            contextPrompt += `You MUST respond entirely in ${langName}.\n`;
            contextPrompt += `- Use ${langName} script and vocabulary\n`;
            contextPrompt += `- Keep technical terms in English when no good translation exists\n`;
            contextPrompt += `- Maintain the same helpful, adaptive persona in ${langName}\n`;
        }

        // MODEL CONTEXT
        if (modelInfo) {
            contextPrompt += `\n\nMODEL CONTEXT:\n`;
            const ctx = [];

            if (modelInfo.filename) ctx.push(`File: ${modelInfo.filename}`);
            if (modelInfo.description) ctx.push(`Description: "${modelInfo.description}" [PRIMARY CONTEXT]`);
            if (modelInfo.category) ctx.push(`Category: ${modelInfo.category}`);
            if (modelInfo.purpose) ctx.push(`Purpose: ${modelInfo.purpose}`);
            if (modelInfo.complexity) ctx.push(`Complexity: ${modelInfo.complexity}`);
            if (modelInfo.tags?.length) ctx.push(`Tags: ${modelInfo.tags.join(', ')}`);
            if (modelInfo.manufacturer) ctx.push(`Manufacturer: ${modelInfo.manufacturer}`);
            if (modelInfo.material) ctx.push(`Material: ${modelInfo.material}`);

            if (modelInfo.isDemoMode && modelInfo.demoInfo) {
                ctx.push(`Demo: ${modelInfo.demoInfo.name} (${modelInfo.demoInfo.type})`);
                ctx.push(`Info: ${modelInfo.demoInfo.description}`);
            }

            contextPrompt += ctx.map(v => `• ${v}`).join("\n");
        }

        // SCENE ANALYSIS
        if (sceneAnalysis) {
            contextPrompt += `\n\nSCENE METRICS:\n`;
            const m = [];

            m.push(`Components: ${sceneAnalysis.meshCount} meshes, ${sceneAnalysis.totalObjects} objects`);
            m.push(`Materials: ${sceneAnalysis.materialCount} unique`);
            m.push(`Complexity: ${sceneAnalysis.complexityScore.toFixed(1)}/10`);

            if (sceneAnalysis.boundingBox) {
                const s = sceneAnalysis.boundingBox.size;
                m.push(`Dimensions: ${s[0].toFixed(1)} × ${s[1].toFixed(1)} × ${s[2].toFixed(1)}`);
            }

            if (sceneAnalysis.components?.length) {
                const top = sceneAnalysis.components.slice(0, 5).map(c => c.name).join(', ');
                m.push(`Key parts: ${top}`);
            }

            contextPrompt += m.map(v => `• ${v}`).join("\n");
        }

        // SELECTED PART
        if (selectedPart) {
            contextPrompt += `\n\nSELECTED PART: ${selectedPart.name || 'Unnamed'} (${selectedPart.type || 'Unknown'})`;
            if (selectedPart.position) {
                contextPrompt += ` @ [${selectedPart.position.map(v => v.toFixed(1)).join(', ')}]`;
            }
        }

        // IMAGE ANALYSIS
        if (screenshot) {
            contextPrompt += `\n\n🖼️ IMAGE ANALYSIS INSTRUCTIONS:
• Extract ALL visible components
• Create markdown tables for specifications
• Identify geometry, materials & design intent
• Full technical analysis (400+ words)
• IGNORE UI elements`;
        }

        // ANALYSIS FLAGS
        if (analysisContext) {
            const fl = [];
            if (analysisContext.excludeUIElements) fl.push("Ignore UI elements");
            if (analysisContext.focusOnModel) fl.push("Model-only focus");
            if (analysisContext.researchGrade) fl.push("Research-grade");
            if (analysisContext.provideCitations) fl.push("Citations enabled");

            if (fl.length) {
                contextPrompt += `\n\nANALYSIS MODE: ${fl.join(" | ")}`;
            }
        }

        // -------------------------
        // Prepare Messages for Gemini
        // -------------------------
        // Convert messages to the format expected by Vercel AI SDK
        const formattedMessages = messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            
            // Handle user messages
            if (msg.role === 'user') {
                // Get the text content
                let textContent = '';
                if (typeof msg.content === 'string') {
                    textContent = msg.content;
                } else if (msg.parts && msg.parts.length > 0) {
                    textContent = msg.parts
                        .filter(p => p.type === 'text')
                        .map(p => p.text)
                        .join(' ');
                }
                
                // If this is the last message and we have a screenshot, create multimodal content
                if (isLastMessage && validScreenshot) {
                    // Process the screenshot - extract base64 and determine MIME type
                    let base64Data = validScreenshot;
                    let mimeType = 'image/png';
                    
                    // Check if it's a data URL and extract base64
                    if (validScreenshot.startsWith('data:')) {
                        const matches = validScreenshot.match(/^data:([^;]+);base64,(.+)$/);
                        if (matches) {
                            mimeType = matches[1];
                            base64Data = matches[2]; // Pure base64 without data URL prefix
                        }
                    }
                    
                    console.log('📸 Attaching image to message:', {
                        mimeType,
                        base64Length: base64Data.length,
                        sizeKB: ((base64Data.length * 0.75) / 1024).toFixed(2)
                    });
                    
                    // Return multimodal message with both text and image
                    return {
                        role: 'user',
                        content: [
                            { type: 'text', text: textContent || 'Analyze this image' },
                            { 
                                type: 'image', 
                                image: Buffer.from(base64Data, 'base64'),
                                mimeType: mimeType
                            }
                        ]
                    };
                }
                
                // Regular text-only message
                return {
                    role: 'user',
                    content: textContent
                };
            }
            
            // Handle assistant messages
            if (msg.role === 'assistant') {
                let textContent = '';
                if (typeof msg.content === 'string') {
                    textContent = msg.content;
                } else if (msg.parts && msg.parts.length > 0) {
                    textContent = msg.parts
                        .filter(p => p.type === 'text')
                        .map(p => p.text)
                        .join(' ');
                }
                return {
                    role: 'assistant',
                    content: textContent
                };
            }
            
            // Handle tool messages (pass through)
            if (msg.role === 'tool') {
                return msg;
            }
            
            // Default: return as-is
            return msg;
        });

        // -------------------------
        // Initialize LLM
        // -------------------------
        const gemini = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_API_KEY
        });

        // -------------------------
        // STREAM THE RESPONSE WITH TOOL CALLING
        // -------------------------
        const result = await streamText({
            model: gemini("gemini-2.5-flash"),
            system: contextPrompt,
            messages: formattedMessages,
            temperature: 0.4,
            maxRetries: 3,
            toolChoice: "auto",
            tools: {
                searchGoogleScholar: tool({
                    description: 'Search Google Scholar for academic research papers, citations, and patents. CRITICAL: Create a Short concise query for finding research papers on google scholar based on users context',
                    parameters: z.object({
                        query: z.string().min(3).describe('Query Keywords concise minimum for finding research papers on google scholar'),
                        maxItems: z.number().optional().describe('Maximum number of results to return (default 10, but if user gives in query then use that only).'),
                        minYear: z.number().optional().describe('Minimum year for results (default 2022 for recent research, but if user gives in query then use that only).'),
                    }),
                    execute: async ({ query, maxItems, minYear }) => {
                        console.log("🛠️ Tool Call: searchGoogleScholar", { query, minYear });

                        // Validate query
                        if (!query || query.trim().length === 0) {
                            return {
                                error: "Search query is required. Please specify what you want to search for.",
                                message: "I need a search query to find research papers. What topic would you like me to search for?"
                            };
                        }

                        try {
                            const results = await searchGoogleScholar({
                                query: query.trim(),
                                maxItems,
                                minYear,
                            });

                            if (!results || results.length === 0) {
                                return {
                                    message: `No research papers found for "${query}". Try a different search term.`,
                                    results: []
                                };
                            }

                            // Return a simplified version of results to save tokens
                            return {
                                query: query,
                                count: results.length,
                                results: results
                            };
                        } catch (error) {
                            console.error("Tool Execution Error:", error);
                            return {
                                error: "Failed to fetch research papers.",
                                details: error.message,
                                message: `I encountered an error while searching for "${query}". Please try again.`
                            };
                        }
                    },
                }),
            },
            maxSteps: 2, // Allow up to 5 steps for multi-turn tool usage
            // experimental_repairToolCall: async ({
            //     toolCall,
            //     tools,
            //     parameterSchema,
            //     error,
            //     messages,
            // }) => {
            //     // Only repair Scholar calls
            //     if (toolCall.toolName !== "searchGoogleScholar") return null;

            //     try {
            //         // Extract user text
            //         const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
            //         const rawUserText =
            //             lastUserMsg?.content?.toString() ||
            //             lastUserMsg?.parts?.map(p => p.text || "").join(" ") ||
            //             "";

            //         // Extract original args safely
            //         const args = toolCall.args || {};
            //         const cleanedArgs = {};

            //         // ---- Repair Query ----
            //         let q = args.query || rawUserText;

            //         // force concise query
            //         q = q
            //             .replace(/[^a-zA-Z0-9 ]/g, " ")
            //             .split(/\s+/)
            //             .filter(w => w.length > 2)
            //             .slice(0, 6)
            //             .join(" ")
            //             .trim();

            //         if (!q || q.length < 3) q = "recent research";

            //         cleanedArgs.query = q;

            //         // ---- maxItems ----
            //         cleanedArgs.maxItems =
            //             typeof args.maxItems === "number" && args.maxItems > 0
            //                 ? args.maxItems
            //                 : 10;

            //         // ---- minYear ----
            //         cleanedArgs.minYear =
            //             typeof args.minYear === "number" && args.minYear > 1900
            //                 ? args.minYear
            //                 : 2022;

            //         // ---- Validate with schema ----
            //         const schema = parameterSchema({ toolName: "searchGoogleScholar" });

            //         const Ajv = (await import("ajv")).default;
            //         const ajv = new Ajv();
            //         const validate = ajv.compile(schema);

            //         if (!validate(cleanedArgs)) {
            //             console.warn("Validation failed:", validate.errors);
            //             return null;
            //         }

            //         // Return repaired tool call
            //         return {
            //             ...toolCall,
            //             args: cleanedArgs,
            //         };
            //     } catch (e) {
            //         console.error("Repair error:", e);
            //         return null;
            //     }
            // },
        });

        return result.toUIMessageStreamResponse();

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message || "Processing error",
        }), { status: 500 });
    }
}

