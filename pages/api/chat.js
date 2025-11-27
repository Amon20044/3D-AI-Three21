import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';

export const runtime = 'edge';

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
`;

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
        // Build conversation
        // -------------------------
        let conversationMessages = [
            { role: "system", content: contextPrompt },
            ...messages
        ];

        // Append screenshot to last user message
        if (validScreenshot && conversationMessages.length > 1) {
            const i = conversationMessages.length - 1;
            if (conversationMessages[i].role === "user") {
                conversationMessages[i] = {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: conversationMessages[i].content
                                || "Analyze screenshot."
                        },
                        {
                            type: "image",
                            image: validScreenshot
                        }
                    ]
                };
            }
        }

        // -------------------------
        // Initialize LLM
        // -------------------------
        const gemini = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_AI_API_KEY
        });

        // -------------------------
        // STREAM THE RESPONSE
        // -------------------------
        const result = await streamText({
            model: gemini("gemini-2.5-flash"),
            messages: conversationMessages,
            temperature: 0.4,
            maxRetries: 3,
        });

        return result.toUIMessageStreamResponse();

    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message || "Processing error",
        }), { status: 500 });
    }
}

export default POST;
