import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';

interface RealtimeMessage {
    message_type: 'session_started' | 'partial_transcript' | 'committed_transcript' | 'input_error' | 'error';
    text?: string;
    session_id?: string;
    error?: string;
}

@Injectable()
export class ElevenLabsRealtimeService {
    private readonly logger = new Logger(ElevenLabsRealtimeService.name);
    private apiKey: string;
    private wsUrl = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';

    // Store active WebSocket connections per call
    private connections = new Map<string, WebSocket>();
    private transcriptCallbacks = new Map<string, (text: string) => void>();

    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('ELEVENLABS_API_KEY est requise dans .env');
        }
    }

    /**
     * Connect to ElevenLabs Realtime transcription WebSocket
     * Returns sessionId for this transcription session
     */
    async connectForCall(
        callId: string,
        onTranscript: (text: string) => void,
    ): Promise<void> {
        // Close existing connection if any
        if (this.connections.has(callId)) {
            this.disconnectForCall(callId);
        }

        return new Promise((resolve, reject) => {
            // Utilisons commit manuel au lieu de VAD pour plus de contrôle
            const url = `${this.wsUrl}?model_id=scribe_v2_realtime&language_code=fr&audio_format=pcm_16000&commit_strategy=manual`;

            const ws = new WebSocket(url, {
                headers: {
                    'xi-api-key': this.apiKey,
                },
            });

            ws.on('open', () => {
                this.logger.log(`🔗 ElevenLabs Realtime connected for call: ${callId}`);
            });

            ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message: RealtimeMessage = JSON.parse(data.toString());

                    // Log TOUS les messages pour debugging
                    this.logger.log(`📨 ElevenLabs message type: ${message.message_type}`);

                    switch (message.message_type) {
                        case 'session_started':
                            this.logger.log(`✅ Session started: ${message.session_id}`);
                            resolve(); // Connection ready
                            break;

                        case 'partial_transcript':
                            // Live transcript - can be used for real-time display
                            if (message.text && message.text.trim()) {
                                this.logger.log(`📝 Partial: "${message.text}"`);
                            }
                            break;

                        case 'committed_transcript':
                            // Final transcript for this segment
                            if (message.text && message.text.trim()) {
                                this.logger.log(`✅ Committed: "${message.text}"`);
                                onTranscript(message.text);
                            } else {
                                this.logger.warn('⚠️  Empty committed transcript!');
                            }
                            break;

                        case 'input_error':
                        case 'error':
                            this.logger.error(`❌ Error: ${message.error || 'Unknown error'}`);
                            break;

                        default:
                            this.logger.debug(`Received: ${message.message_type}`);
                    }
                } catch (error) {
                    this.logger.error(`Failed to parse message: ${error.message}`);
                }
            });

            ws.on('error', (error) => {
                this.logger.error(`WebSocket error: ${error.message}`);
                reject(error);
            });

            ws.on('close', () => {
                this.logger.log(`🔴 ElevenLabs Realtime disconnected for call: ${callId}`);
                this.connections.delete(callId);
                this.transcriptCallbacks.delete(callId);

                // Clear keepalive si existant
                const keepaliveTimer = (ws as any)._keepaliveTimer;
                if (keepaliveTimer) {
                    clearInterval(keepaliveTimer);
                }
            });

            // IMPORTANT: Keepalive pour garder la connexion active
            // Envoyer un ping toutes les 10 secondes
            const keepaliveTimer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                    this.logger.debug(`💓 Keepalive ping sent for call: ${callId}`);
                }
            }, 60000); // 60 secondes

            // Stocker le timer sur le WebSocket pour le nettoyer plus tard
            (ws as any)._keepaliveTimer = keepaliveTimer;

            this.connections.set(callId, ws);
            this.transcriptCallbacks.set(callId, onTranscript);
        });
    }

    /**
   * Send audio chunk to ElevenLabsfor transcription
   * Audio should be PCM 16kHz, 16-bit, mono
   */
    async sendAudioChunk(callId: string, audioBuffer: Buffer): Promise<void> {
        const ws = this.connections.get(callId);

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            this.logger.warn(`⚠️  No active connection for call: ${callId}`);
            return;
        }

        try {
            // Convert WebM to PCM 16kHz
            const pcmBuffer = await this.convertWebMToPCM(audioBuffer);

            // Convert buffer to base64
            const audioBase64 = pcmBuffer.toString('base64');

            // Send audio chunk message SANS commit
            const audioMessage = {
                message_type: 'input_audio_chunk',
                audio_base_64: audioBase64,
                commit: false,
                sample_rate: 16000,
            };

            ws.send(JSON.stringify(audioMessage));
            this.logger.log(`🎵 Sent ${pcmBuffer.length} bytes PCM to ElevenLabs`);

            // Immédiatement après, envoyer un commit pour forcer la transcription
            const commitMessage = {
                message_type: 'input_audio_chunk',
                audio_base_64: '',
                commit: true,
                sample_rate: 16000,
            };

            ws.send(JSON.stringify(commitMessage));
            this.logger.log(`✅ Committed audio chunk for transcription`);
        } catch (error) {
            this.logger.error(`Failed to send audio: ${error.message}`);
            throw error;
        }
    }

    /**
     * Convert WebM audio to PCM 16kHz using ffmpeg
     */
    private async convertWebMToPCM(webmBuffer: Buffer): Promise<Buffer> {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        const execAsync = promisify(exec);
        const tmpDir = os.tmpdir();
        const inputPath = path.join(tmpDir, `input-${Date.now()}.webm`);
        const outputPath = path.join(tmpDir, `output-${Date.now()}.pcm`);

        try {
            // Write WebM to temp file
            await fs.promises.writeFile(inputPath, webmBuffer);
            this.logger.log(`📁 Wrote WebM to: ${inputPath} (${webmBuffer.length} bytes)`);

            // Convert using ffmpeg: WebM → PCM 16kHz, 16-bit, mono
            const ffmpegCmd = `ffmpeg -hide_banner -i "${inputPath}" -f s16le -ar 16000 -ac 1 "${outputPath}" -y`;

            this.logger.log(`🎬 Running: ${ffmpegCmd}`);
            const { stdout, stderr } = await execAsync(ffmpegCmd);

            if (stderr) {
                this.logger.warn(`⚠️  ffmpeg stderr: ${stderr}`);
            }

            // Read converted PCM file
            const pcmBuffer = await fs.promises.readFile(outputPath);

            // Verify PCM is not empty
            if (pcmBuffer.length === 0) {
                throw new Error('ffmpeg produced empty PCM file');
            }

            // Cleanup temp files
            await fs.promises.unlink(inputPath).catch(() => { });
            await fs.promises.unlink(outputPath).catch(() => { });

            this.logger.log(`✅ Converted WebM(${webmBuffer.length}b) → PCM(${pcmBuffer.length}b)`);
            return pcmBuffer;

        } catch (error) {
            // Cleanup on error
            await fs.promises.unlink(inputPath).catch(() => { });
            await fs.promises.unlink(outputPath).catch(() => { });

            this.logger.error(`⚠️  ffmpeg conversion failed: ${error.message}`);
            this.logger.error(`Full error: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Disconnect WebSocket for a call
     */
    disconnectForCall(callId: string): void {
        const ws = this.connections.get(callId);
        if (ws) {
            // Clear keepalive timer
            const keepaliveTimer = (ws as any)._keepaliveTimer;
            if (keepaliveTimer) {
                clearInterval(keepaliveTimer);
            }

            ws.close();
            this.connections.delete(callId);
            this.transcriptCallbacks.delete(callId);
            this.logger.log(`🔌 Disconnected ElevenLabs Realtime for call: ${callId}`);
        }
    }

    /**
     * Manually commit current transcript segment
     * (Useful if not using VAD)
     */
    async commitSegment(callId: string): Promise<void> {
        const ws = this.connections.get(callId);

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const message = {
            message_type: 'input_audio_chunk',
            audio_base_64: '',
            commit: true,
            sample_rate: 16000,
        };

        ws.send(JSON.stringify(message));
        this.logger.log(`✅ Committed segment for call: ${callId}`);
    }
}
