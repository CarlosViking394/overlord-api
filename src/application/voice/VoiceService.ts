/**
 * Voice Service Implementation
 * Integrates OpenAI (Whisper), Anthropic (Claude), and Eleven Labs for voice commands
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
    IVoiceService,
    VoiceCommand,
    VoiceResponse,
    TranscriptionResult,
    ClassifiedIntent,
    IntentType,
    ExtractedEntity,
    SuggestedAction,
    PendingAction,
} from './IVoiceService';

interface VoiceServiceConfig {
    openaiApiKey: string;
    anthropicApiKey: string;
    elevenLabsApiKey: string;
    defaultVoiceId?: string;
}

// Charlie's custom cloned voice from Eleven Labs
const CHARLIE_VOICE_ID = '4gEcf8V7EWIeNMLu15SM'; // Custom "Charlie" voice (cloned)

// All roles use Charlie's voice for consistency
const ROLE_VOICES: Record<string, string> = {
    overlord: CHARLIE_VOICE_ID,
    admin: CHARLIE_VOICE_ID,
    lord: CHARLIE_VOICE_ID,
};

export class VoiceService implements IVoiceService {
    private openai: OpenAI;
    private anthropic: Anthropic;
    private elevenLabsApiKey: string;
    private defaultVoiceId: string;

    constructor(config: VoiceServiceConfig) {
        this.openai = new OpenAI({ apiKey: config.openaiApiKey });
        this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        this.elevenLabsApiKey = config.elevenLabsApiKey;
        this.defaultVoiceId = config.defaultVoiceId || ROLE_VOICES.overlord;
    }

    async processCommand(command: VoiceCommand): Promise<VoiceResponse> {
        const startTime = Date.now();

        try {
            // Step 1: Classify the intent using Claude
            const intent = await this.classifyIntent(command.text);

            // Step 2: Generate response using Claude
            const responseText = await this.generateResponse(command, intent);

            // Step 3: Check if this is an actionable intent requiring approval
            const pendingAction = this.createPendingAction(intent, command.text);

            // Step 4: Convert to speech using Eleven Labs
            const voiceId = CHARLIE_VOICE_ID;
            let audioBase64: string | undefined;

            try {
                const audioBuffer = await this.textToSpeech(responseText, voiceId);
                audioBase64 = audioBuffer.toString('base64');
            } catch (ttsError) {
                console.error('TTS failed, returning text-only response:', ttsError);
            }

            const latencyMs = Date.now() - startTime;
            console.log(`Voice command processed in ${latencyMs}ms`);

            return {
                text: responseText,
                audioBase64,
                intent,
                actions: this.suggestActions(intent),
                pendingAction,
            };
        } catch (error) {
            console.error('Voice command processing failed:', error);
            throw error;
        }
    }

    private createPendingAction(intent: ClassifiedIntent, originalText: string): PendingAction | undefined {
        // Only create pending actions for actionable intents
        const actionableIntents: IntentType[] = [
            'deployment',
            'component_modification',
            'api_modification',
            'feature_addition',
            'system_command',
        ];

        if (!actionableIntents.includes(intent.type)) {
            return undefined;
        }

        // Extract the main action from entities
        const actionEntity = intent.entities.find(e => e.type === 'action');
        const targetEntity = intent.entities.find(e => e.type === 'target' || e.type === 'app' || e.type === 'component');

        const actionDescriptions: Record<IntentType, string> = {
            deployment: 'Deploy application',
            component_modification: 'Modify component',
            api_modification: 'Update API configuration',
            feature_addition: 'Add new feature',
            system_command: 'Execute system command',
            query: '',
            greeting: '',
            unknown: '',
        };

        return {
            id: `action_${Date.now()}`,
            type: intent.type,
            description: actionDescriptions[intent.type] || 'Perform action',
            parameters: {
                originalCommand: originalText,
                action: actionEntity?.value,
                target: targetEntity?.value,
                entities: intent.entities,
            },
            requiresApproval: true,
            confirmationMessage: `Proceed with ${actionDescriptions[intent.type].toLowerCase()}?`,
        };
    }

    private async classifyIntent(text: string): Promise<ClassifiedIntent> {
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            system: `You are an intent classifier for Agent Charlie, a platform control system.

Classify the user's message into ONE of these intents:
- greeting: Greetings like "hello", "hi", "hey", "how are you"
- query: Questions asking for information, status, help, or explanations
- deployment: Any mention of deploying, releasing, publishing, or launching apps/services
- component_modification: Changing UI components, buttons, screens, layouts
- api_modification: Changing API endpoints, routes, backend code
- feature_addition: Adding new features or functionality
- system_command: System operations like restart, stop, clear, reset, refresh
- unknown: Only if NONE of the above fit at all

IMPORTANT CLASSIFICATION RULES:
- "deploy" or "deployment" = deployment intent (even without specific app name)
- "what", "how", "show me", "tell me" = query intent
- "add", "create", "build", "make" = feature_addition intent
- "change", "update", "modify", "edit" = component_modification or api_modification
- "restart", "stop", "kill", "refresh" = system_command intent

Extract entities: app names, components, features, actions (verbs), targets (what to act on).

Respond ONLY with valid JSON (no markdown):
{"type":"intent_type","confidence":0.0-1.0,"entities":[{"type":"entity_type","value":"value","confidence":0.0-1.0}]}`,
            messages: [{ role: 'user', content: text }],
        });

        try {
            const content = response.content[0];
            if (content.type === 'text') {
                const parsed = JSON.parse(content.text);
                return {
                    type: parsed.type as IntentType,
                    confidence: parsed.confidence,
                    entities: parsed.entities as ExtractedEntity[],
                };
            }
        } catch {
            // Default if parsing fails
        }

        return {
            type: 'unknown',
            confidence: 0.5,
            entities: [],
        };
    }

    private async generateResponse(
        command: VoiceCommand,
        intent: ClassifiedIntent
    ): Promise<string> {
        const systemPrompt = this.getSystemPrompt(command.role);

        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300, // Reduced for faster, more concise voice responses
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: `User command: "${command.text}"

Detected intent: ${intent.type} (confidence: ${intent.confidence})
Entities: ${JSON.stringify(intent.entities)}

Respond naturally as Charlie, the AI assistant. Keep responses concise (1-3 sentences) for voice output.
IMPORTANT: Respond in the SAME LANGUAGE as the user's command. If they speak Spanish, respond in Spanish. If they speak French, respond in French, etc.`,
                },
            ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
            return content.text;
        }

        return "I'm sorry, I couldn't process that command.";
    }

    private getSystemPrompt(role: string): string {
        const basePrompt = `You are Charlie, a versatile AI assistant designed to help users manage and optimize their online presence and business strategies.

# Personality
- You are knowledgeable, resourceful, and proactive, always seeking to provide the best possible guidance.
- You are patient and encouraging, adapting your communication style to suit the user's level of expertise.
- You are forward-thinking, anticipating future needs and opportunities for growth.
- You speak naturally and conversationally - like talking to a friendly expert colleague.

# Tone
- Your responses are clear, concise, and actionable.
- You use a friendly and professional tone, building trust and rapport.
- You incorporate positive reinforcement and encouragement.
- You adapt your language to match the user's level of understanding, avoiding jargon when unnecessary.
- IMPORTANT: Keep responses SHORT for voice (1-3 sentences max). Be conversational, not robotic.

# Environment
- You are interacting with a user who seeks assistance with managing websites, apps, and AI agents.
- The user may have varying levels of technical expertise.
- You have access to the Agent Charlie platform which can manage services, deploy apps, and control agents.

# Actions & Approvals
- When the user requests an ACTION (deploy, create, modify, delete, restart, etc.), you MUST:
  1. Acknowledge what they want to do
  2. Explain briefly what will happen
  3. ASK FOR CONFIRMATION before proceeding (e.g., "Should I go ahead with that?" or "Want me to proceed?")
- NEVER execute destructive or significant actions without explicit user approval
- For simple queries or information requests, respond directly without asking for approval`;

        const roleAdditions: Record<string, string> = {
            OVERLORD: `

# User Context
The user is Carlos, the OVERLORD - the platform owner with full administrative access.
Address them warmly but professionally. They can:
- Create and manage all agents and services
- Deploy any application across all workspaces
- Configure system-wide settings
- Access all platform features without restrictions`,
            ADMIN: `

# User Context
The user is an ADMIN - a workspace administrator with elevated permissions.
They can:
- Manage their assigned workspace
- Deploy and configure apps within their workspace
- Manage users within their workspace
- View workspace reports and metrics`,
            LORD: `

# User Context
The user is a LORD - a power user within a workspace.
They can:
- Use voice commands and interact with apps
- View their workspace dashboard
- Perform basic tasks and queries
- Request escalation to admins for advanced operations`,
        };

        return basePrompt + (roleAdditions[role] || roleAdditions.LORD);
    }

    private suggestActions(intent: ClassifiedIntent): SuggestedAction[] {
        const actionMap: Record<IntentType, SuggestedAction[]> = {
            query: [],
            greeting: [],
            component_modification: [
                { type: 'edit_component', description: 'Open component editor' },
            ],
            api_modification: [
                { type: 'edit_api', description: 'Open API configuration' },
            ],
            feature_addition: [
                { type: 'create_feature', description: 'Start feature wizard' },
            ],
            deployment: [
                { type: 'deploy', description: 'Open deployment panel' },
            ],
            system_command: [
                { type: 'execute', description: 'Execute system command' },
            ],
            unknown: [],
        };

        return actionMap[intent.type] || [];
    }

    async transcribe(audioBuffer: Buffer, format = 'webm'): Promise<TranscriptionResult> {
        const startTime = Date.now();

        // Create a File object from the buffer
        const file = new File([audioBuffer], `audio.${format}`, {
            type: `audio/${format}`,
        });

        const response = await this.openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            response_format: 'verbose_json',
        });

        return {
            text: response.text,
            confidence: 1.0, // Whisper doesn't provide confidence scores
            language: response.language || 'en',
            duration: Date.now() - startTime,
        };
    }

    async textToSpeech(text: string, voiceId?: string): Promise<Buffer> {
        const voice = voiceId || this.defaultVoiceId;

        // Use multilingual turbo model with latency optimization
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}?optimize_streaming_latency=3&output_format=mp3_44100_64`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey,
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_multilingual_v2', // Multilingual model - supports 29 languages
                    voice_settings: {
                        stability: 0.4,
                        similarity_boost: 0.8,
                        style: 0.0,
                        use_speaker_boost: false,
                    },
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Eleven Labs TTS failed: ${error}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    async getVoices(): Promise<Array<{ id: string; name: string; category: string }>> {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': this.elevenLabsApiKey,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch voices');
        }

        const data = await response.json();
        return data.voices.map((voice: { voice_id: string; name: string; category: string }) => ({
            id: voice.voice_id,
            name: voice.name,
            category: voice.category,
        }));
    }

    async testConnectivity(): Promise<{
        openai: boolean;
        anthropic: boolean;
        elevenlabs: boolean;
    }> {
        const results = {
            openai: false,
            anthropic: false,
            elevenlabs: false,
        };

        // Test OpenAI
        try {
            await this.openai.models.list();
            results.openai = true;
        } catch (error) {
            console.error('OpenAI connectivity test failed:', error);
        }

        // Test Anthropic
        try {
            await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'ping' }],
            });
            results.anthropic = true;
        } catch (error) {
            console.error('Anthropic connectivity test failed:', error);
        }

        // Test Eleven Labs
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: { 'xi-api-key': this.elevenLabsApiKey },
            });
            results.elevenlabs = response.ok;
        } catch (error) {
            console.error('Eleven Labs connectivity test failed:', error);
        }

        return results;
    }
}
