import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, tool } from 'ai';
import { z } from 'zod';
import { searchGoogleScholar } from '@/lib/apifyClient';

export const runtime = 'nodejs';

const ENHANCED_SYSTEM_PROMPT = `You are **Three21Bot**, an AI for engineering-grade 3D model analysis.
Mission: Provide **accurate, concise, manufacturing-aware intelligence**.

**Core Identity:**
- Mechanical/Manufacturing Engineer & Product Analyst.
- Natural Teacher: Explanations should be interesting and easy to understand.

**Analysis Context:**
- **Mechanical**: Tolerances, load paths, DFM.
- **Electronics**: PCB clearances, thermal, EMI.
- **Automotive**: NVH, safety, fatigue.
- **Consumer**: Ergonomics, materials, safety.
- **Medical**: Sterility, biocompatibility, reliability.
- **Aerospace**: Weight, performance, critical tolerances.

**Guidelines:**
- **Be Concise**: Use efficient tokens. Avoid fluff.
- **Structure**: Use bullet points and clear headers.
- **Tables**: Use Markdown tables ONLY for structured data (specs, materials, comparisons).
- **Visuals**: Ignore UI elements in images; focus on 3D geometry.
- **Citations**: Cite standards (ISO, ASME, ASTM) where relevant.
- **Keywords and tags**: This renders them as highlighted tags in the UI.

**Tool Usage - Google Scholar Search:**
- When users ask for research, papers, patents, or technical references, use the searchGoogleScholar tool.
- **IMPORTANT**: Formulate detailed, academic search queries optimized for Google Scholar.
- Include relevant technical terms, synonyms, and domain-specific terminology.
- Examples:
  - User: "find papers on soft robotics" → Query: "soft robotics actuation mechanisms control systems compliance"
  - User: "research on quadruped robots" → Query: "quadruped locomotion gait planning kinematics control algorithms"
  - User: "3D printing materials" → Query: "additive manufacturing materials PLA ABS PETG mechanical properties"
- Always expand the query with relevant academic keywords to maximize search quality.
`;

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
            systemPrompt
        } = await req.json();

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
        let contextPrompt = systemPrompt || ENHANCED_SYSTEM_PROMPT;

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
        // Prepare Messages
        // -------------------------
        // Attach screenshot to the last user message if present
        if (validScreenshot && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
                // If message uses 'content' string, convert to parts
                if (typeof lastMessage.content === 'string' && (!lastMessage.parts || lastMessage.parts.length === 0)) {
                    lastMessage.parts = [{ type: 'text', text: lastMessage.content }];
                    lastMessage.content = undefined; // Clear content to prioritize parts
                }

                // Ensure parts array exists
                if (!lastMessage.parts) {
                    lastMessage.parts = [];
                }

                // Append image part
                lastMessage.parts.push({
                    type: 'image',
                    image: validScreenshot
                });
            }
        }

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
            experimental_telemetry: false,
            messages: convertToModelMessages(messages),
            temperature: 0.4,
            maxRetries: 3,
            tools: {
                searchGoogleScholar: tool({
                    description: 'Search Google Scholar for academic research papers, citations, and patents. CRITICAL: Create a detailed, comprehensive search query optimized for academic search. Expand the user\'s request with relevant technical terms, synonyms, and domain keywords. Examples: "soft robotics" → "soft robotics actuation mechanisms control systems compliance"; "quadruped robot" → "quadruped locomotion gait planning kinematics control algorithms". Use scholarly terminology.',
                    parameters: z.object({
                        query: z.string().min(3).describe('A detailed, scholarly search query for Google Scholar. REQUIRED: Formulate a comprehensive query with technical terms, synonyms, and academic keywords based on the user\'s request. Expand simple phrases into detailed academic queries.'),
                        maxItems: z.number().optional().describe('Maximum number of results to return (default 10).'),
                        minYear: z.number().optional().describe('Minimum year for results (default 2022 for recent research).'),
                        maxYear: z.number().optional().describe('Maximum year for results.'),
                        country: z.string().optional().describe('Country code (e.g., "us", "uk").'),
                        language: z.string().optional().describe('UI Language code (e.g., "en").'),
                        sortBy: z.string().optional().describe('Sort by date (2) or relevance (default).'),
                    }),
                    execute: async ({ query, maxItems, minYear, maxYear, country, language, sortBy }) => {
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
                                maxYear,
                                country,
                                language,
                                sortBy
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
                                results: results.map(item => ({
                                    title: item.title,
                                    link: item.link,
                                    snippet: item.snippet,
                                    year: item.publication_info?.year,
                                    citations: item.cited_by_count
                                }))
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
            maxSteps: 7, // Allow up to 5 steps for multi-turn tool usage
        });

        return result.toUIMessageStreamResponse();

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message || "Processing error",
        }), { status: 500 });
    }
}