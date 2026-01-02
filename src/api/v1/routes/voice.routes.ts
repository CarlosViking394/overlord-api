/**
 * Voice Routes - Voice command processing endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IVoiceService, VoiceCommand } from '../../../application/voice/IVoiceService';
import { ApiResponseBuilder } from '../../responses/ApiResponse';

interface ProcessCommandBody {
    text: string;
    userId: string;
    sessionId: string;
    role: 'OVERLORD' | 'ADMIN' | 'LORD';
}

interface TextToSpeechBody {
    text: string;
    voiceId?: string;
}

export function voiceRoutes(
    fastify: FastifyInstance,
    voiceService: IVoiceService
): void {
    // Process a voice command (text input, gets AI response + audio)
    fastify.post<{ Body: ProcessCommandBody }>(
        '/voice/command',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['text', 'userId', 'sessionId', 'role'],
                    properties: {
                        text: { type: 'string', minLength: 1 },
                        userId: { type: 'string' },
                        sessionId: { type: 'string' },
                        role: { type: 'string', enum: ['OVERLORD', 'ADMIN', 'LORD'] },
                    },
                },
            },
        },
        async (request: FastifyRequest<{ Body: ProcessCommandBody }>, reply: FastifyReply) => {
            try {
                const command: VoiceCommand = {
                    text: request.body.text,
                    userId: request.body.userId,
                    sessionId: request.body.sessionId,
                    role: request.body.role,
                };

                const result = await voiceService.processCommand(command);
                const response = ApiResponseBuilder.ok(result);
                return reply.send(response);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Voice command failed';
                const response = ApiResponseBuilder.error(message);
                return reply.status(500).send(response);
            }
        }
    );

    // Transcribe audio to text
    fastify.post(
        '/voice/transcribe',
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                // Get the multipart file
                const data = await request.file();
                if (!data) {
                    const response = ApiResponseBuilder.badRequest('No audio file provided');
                    return reply.status(400).send(response);
                }

                const buffer = await data.toBuffer();
                const format = data.mimetype?.split('/')[1] || 'webm';

                const result = await voiceService.transcribe(buffer, format);
                const response = ApiResponseBuilder.ok(result);
                return reply.send(response);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Transcription failed';
                const response = ApiResponseBuilder.error(message);
                return reply.status(500).send(response);
            }
        }
    );

    // Text to speech
    fastify.post<{ Body: TextToSpeechBody }>(
        '/voice/speak',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        text: { type: 'string', minLength: 1, maxLength: 5000 },
                        voiceId: { type: 'string' },
                    },
                },
            },
        },
        async (request: FastifyRequest<{ Body: TextToSpeechBody }>, reply: FastifyReply) => {
            try {
                const audioBuffer = await voiceService.textToSpeech(
                    request.body.text,
                    request.body.voiceId
                );

                // Return as base64 for easy frontend consumption
                const response = ApiResponseBuilder.ok({
                    audioBase64: audioBuffer.toString('base64'),
                    format: 'mp3',
                });
                return reply.send(response);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Text-to-speech failed';
                const response = ApiResponseBuilder.error(message);
                return reply.status(500).send(response);
            }
        }
    );

    // Get available voices
    fastify.get(
        '/voice/voices',
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const voices = await voiceService.getVoices();
                const response = ApiResponseBuilder.ok({ voices });
                return reply.send(response);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to get voices';
                const response = ApiResponseBuilder.error(message);
                return reply.status(500).send(response);
            }
        }
    );

    // Test AI services connectivity
    fastify.get(
        '/voice/test',
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const connectivity = await voiceService.testConnectivity();
                const allConnected = connectivity.openai && connectivity.anthropic && connectivity.elevenlabs;

                const response = ApiResponseBuilder.ok({
                    status: allConnected ? 'healthy' : 'degraded',
                    services: connectivity,
                });
                return reply.send(response);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Connectivity test failed';
                const response = ApiResponseBuilder.error(message);
                return reply.status(500).send(response);
            }
        }
    );
}
