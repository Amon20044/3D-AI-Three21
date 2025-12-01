/**
 * Enhanced AI prompt generator for comprehensive 3D model analysis
 * Focuses on research-grade insights with citations and references
 */
class AIPromptGenerator {
    constructor() {
        this.systemPrompt = this.generateSystemPrompt();
    }

    generateSystemPrompt() {
        return `You are Three21Bot, an advanced 3D model analysis assistant.
Core Mission: Provide concise, research-grade analysis of 3D models.

## Capabilities:
1. **Visual Analysis**: Analyze geometry from screenshots.
2. **Reverse Engineering**: Infer design intent and manufacturing.
3. **Technical Documentation**: Generate component descriptions.
4. **Research Support**: Cite standards and references.

## Guidelines:
- **Focus**: Analyze ONLY the 3D model; ignore UI.
- **Conciseness**: Be direct and actionable. Avoid fluff.
- **Structure**: Use bullet points and headers.
- **Citations**: [Standard ID] format.`;
    }

    /**
     * Generate comprehensive model analysis prompt
     */
    generateModelAnalysisPrompt(modelInfo, sceneAnalysis, screenshot = null, selectedPart = null) {
        const sections = [];

        // Header
        sections.push(`# Analysis Request: ${selectedPart ? 'Component' : 'Full Model'}`);
        sections.push(`Time: ${new Date().toISOString()}`);

        // Model Info
        if (modelInfo) {
            sections.push(`\n## Model Data`);
            if (modelInfo.filename) sections.push(`File: ${modelInfo.filename}`);
            if (modelInfo.description) sections.push(`Desc: "${modelInfo.description}"`);
            if (modelInfo.category) sections.push(`Cat: ${modelInfo.category}`);
            if (modelInfo.material) sections.push(`Mat: ${modelInfo.material}`);
        }

        // Scene Stats
        if (sceneAnalysis) {
            sections.push(`\n## Scene Stats`);
            sections.push(`Objs: ${sceneAnalysis.totalObjects}, Mats: ${sceneAnalysis.materialCount}`);
            if (sceneAnalysis.boundingBox) {
                const s = sceneAnalysis.boundingBox.size;
                sections.push(`Dims: ${s[0].toFixed(1)}x${s[1].toFixed(1)}x${s[2].toFixed(1)}`);
            }
        }

        // Selected Part
        if (selectedPart) {
            sections.push(`\n## Target Component`);
            sections.push(`Name: ${selectedPart.name || 'Unnamed'}`);
            sections.push(`Type: ${selectedPart.type || 'Unknown'}`);
            if (selectedPart.position) {
                sections.push(`Pos: [${selectedPart.position.map(p => p.toFixed(1)).join(',')}]`);
            }
        }

        // Screenshot
        if (screenshot) {
            sections.push(`\n## Visuals`);
            sections.push(`Image: Provided. IGNORE UI.`);
        }

        // Request
        sections.push(`\n## Task`);
        if (selectedPart) {
            sections.push(`Analyze "${selectedPart.name}" (Function, Mfg, Mat, Assembly). Be concise.`);
        } else {
            sections.push(`Analyze Model (Function, Mech, Mfg, Mat). Be concise.`);
        }

        return sections.join('\n');
    }

    /**
     * Generate research-focused follow-up questions
     */
    generateResearchPrompts(modelInfo, analysisContext) {
        const prompts = [];

        if (modelInfo?.category) {
            prompts.push(`What are the key design standards for ${modelInfo.category} components?`);
        }

        if (modelInfo?.manufacturer) {
            prompts.push(`What design philosophies or methodologies does ${modelInfo.manufacturer} typically employ?`);
        }

        if (modelInfo?.material) {
            prompts.push(`What are the material properties and manufacturing considerations for ${modelInfo.material}?`);
        }

        if (analysisContext?.complexity === 'high') {
            prompts.push(`What advanced manufacturing techniques might be required for this complex geometry?`);
        }

        // General research prompts
        prompts.push(`What patents or prior art might be relevant to this design?`);
        prompts.push(`What industry standards should I reference for similar components?`);
        prompts.push(`How might this design be optimized for different performance criteria?`);
        prompts.push(`What failure modes should be considered for this type of component?`);

        return prompts;
    }

    /**
     * Generate context-aware analysis prompt based on user interaction
     */
    generateContextualPrompt(userQuery, modelInfo, selectedPart, recentAnalysis) {
        const sections = [];

        sections.push(`# 🤖 Contextual Analysis Request`);
        sections.push(`**User Query**: "${userQuery}"`);
        sections.push(``);

        // Add relevant context
        if (modelInfo?.description) {
            sections.push(`**Model Context**: ${modelInfo.description}`);
        }

        if (selectedPart) {
            sections.push(`**Selected Component**: ${selectedPart.name || 'Current selection'}`);
        }

        if (recentAnalysis) {
            sections.push(`**Previous Analysis Available**: Building on previous insights`);
        }

        sections.push(``);
        sections.push(`## 📋 Response Guidelines`);
        sections.push(`- Reference the user's specific model description and metadata`);
        sections.push(`- Build upon any previous analysis in this session`);
        sections.push(`- Provide citations and references where relevant`);
        sections.push(`- Focus on research-grade insights and actionable information`);
        sections.push(`- Suggest follow-up investigations or analysis techniques`);

        return sections.join('\n');
    }

    /**
     * Generate system prompt for screenshot analysis
     */
    generateScreenshotAnalysisPrompt(metadata) {
        return `## 📷 Screenshot Analysis Instructions

**Important**: The provided screenshot shows a 3D model in a web-based viewer. IGNORE all UI elements including:
- Control panels, buttons, and menus
- Text overlays and labels
- Progress bars and status indicators  
- Navigation controls
- Background UI elements

**Focus ONLY on**:
- The 3D model geometry and components
- Part relationships and assembly
- Material appearances and surface features
- Mechanical interfaces and connections
- Design features and engineering details

**Analysis Metadata**:
${JSON.stringify(metadata, null, 2)}

Analyze the 3D model visible in the screenshot and provide insights based on the geometric and mechanical features you can observe. Reference the provided metadata to understand the context and user-provided information about this model.`;
    }

    /**
     * Generate citation and reference suggestions
     */
    generateCitationPrompt(domain, topic) {
        const citationAreas = {
            mechanical: [
                'ASME Y14.5 - Geometric Dimensioning and Tolerancing',
                'ISO 14040 - Life Cycle Assessment',
                'ASTM standards for materials testing',
                'Shigley\'s Mechanical Engineering Design textbook'
            ],
            manufacturing: [
                'ASM Handbook for materials and processes',
                'Manufacturing Engineering & Technology (Kalpakjian)',
                'ISO 9000 quality management standards',
                'Industry-specific manufacturing standards'
            ],
            design: [
                'Pahl & Beitz - Engineering Design methodology',
                'Ulrich & Eppinger - Product Design and Development',
                'DFMA (Design for Manufacturing and Assembly) principles',
                'Patent databases for prior art research'
            ]
        };

        return `## 📚 Suggested References for ${topic}

Consider referencing these sources for deeper research:
${(citationAreas[domain] || []).map(ref => `- ${ref}`).join('\n')}

For academic research, also consider:
- Google Scholar for recent publications
- USPTO/WIPO patent databases
- Industry-specific technical journals
- Professional engineering society publications`;
    }
}

export default AIPromptGenerator;
