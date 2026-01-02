/**
 * Voice Service Interface
 * Defines the contract for voice command processing
 */

export interface VoiceCommand {
    text: string;
    userId: string;
    sessionId: string;
    role: 'OVERLORD' | 'ADMIN' | 'LORD';
}

export interface VoiceResponse {
    text: string;
    audioUrl?: string;
    audioBase64?: string;
    intent?: ClassifiedIntent;
    actions?: SuggestedAction[];
    pendingAction?: PendingAction;
}

export interface PendingAction {
    id: string;
    type: string;
    description: string;
    parameters: Record<string, unknown>;
    requiresApproval: boolean;
    confirmationMessage: string;
}

export interface ClassifiedIntent {
    type: IntentType;
    confidence: number;
    entities: ExtractedEntity[];
}

export type IntentType =
    | 'query'
    | 'component_modification'
    | 'api_modification'
    | 'feature_addition'
    | 'deployment'
    | 'system_command'
    | 'greeting'
    | 'unknown';

export interface ExtractedEntity {
    type: 'app' | 'component' | 'feature' | 'action' | 'target';
    value: string;
    confidence: number;
}

export interface SuggestedAction {
    type: string;
    description: string;
    parameters?: Record<string, unknown>;
}

export interface TranscriptionResult {
    text: string;
    confidence: number;
    language: string;
    duration: number;
}

export interface IVoiceService {
    /**
     * Process a voice command and return a response
     */
    processCommand(command: VoiceCommand): Promise<VoiceResponse>;

    /**
     * Transcribe audio to text using OpenAI Whisper
     */
    transcribe(audioBuffer: Buffer, format?: string): Promise<TranscriptionResult>;

    /**
     * Convert text to speech using Eleven Labs
     */
    textToSpeech(text: string, voiceId?: string): Promise<Buffer>;

    /**
     * Get available voices
     */
    getVoices(): Promise<Array<{ id: string; name: string; category: string }>>;

    /**
     * Test AI services connectivity
     */
    testConnectivity(): Promise<{
        openai: boolean;
        anthropic: boolean;
        elevenlabs: boolean;
    }>;
}
