import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';

@Injectable()
export class ElevenLabsTTSService {
    private readonly logger = new Logger(ElevenLabsTTSService.name);
    private apiKey: string;
    private apiUrl = 'https://api.elevenlabs.io/v1/text-to-speech';

    // Voice ID pour voix française professionnelle
    // Charlotte (femme, calme, professionnelle)
    private voiceId = process.env.ELEVENLABS_VOICE_TTS || '21m00Tcm4TlvDq8ikWAM';

    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY || '';
        if (!this.apiKey) {
            this.logger.warn('⚠️  ELEVENLABS_API_KEY non défini');
        }
    }

    /**
     * Convertit texte en audio avec ElevenLabs TTS
     * @param text - Texte à convertir en parole
     * @returns Buffer audio MP3
     */
    async textToSpeech(text: string): Promise<Buffer> {
        if (!this.apiKey) {
            throw new Error('ELEVENLABS_API_KEY est requis pour TTS');
        }

        try {
            this.logger.log(`🔊 TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

            const response = await fetch(`${this.apiUrl}/${this.voiceId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2', // Support français
                    voice_settings: {
                        stability: 0.5,           // Stabilité voix (0-1)
                        similarity_boost: 0.75,   // Similarité voix originale
                        style: 0.0,               // Style neutre (0-1)
                        use_speaker_boost: true   // Améliore clarté
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`❌ TTS error ${response.status}: ${errorText}`);

                if (response.status === 401) {
                    throw new Error('Clé API ElevenLabs invalide');
                } else if (response.status === 429) {
                    throw new Error('Quota ElevenLabs TTS dépassé');
                }

                throw new Error(`TTS error ${response.status}: ${errorText}`);
            }

            const audioBuffer = await response.buffer();
            this.logger.log(`✅ Audio généré: ${audioBuffer.length} bytes`);

            return audioBuffer;
        } catch (error) {
            this.logger.error(`❌ Erreur TTS: ${error.message}`);
            throw error;
        }
    }

    /**
     * Liste des voix disponibles (pour choisir une voix FR)
     * Utile pour tester différentes voix
     */
    async getAvailableVoices(): Promise<any> {
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur liste voix: ${response.status}`);
            }

            const data = (await response.json()) as { voices: any[] };

            // Filtre les voix françaises
            const frenchVoices = (data.voices ?? []).filter((voice: any) =>
                voice.labels?.language === 'fr' ||
                voice.name.toLowerCase().includes('french')
            );

            this.logger.log(`🎤 ${frenchVoices.length} voix françaises disponibles`);
            return frenchVoices;
        } catch (error) {
            this.logger.error('❌ Erreur récupération voix:', error.message);
            throw error;
        }
    }

    /**
     * Change la voix utilisée
     * @param voiceId - ID de la nouvelle voix
     */
    setVoice(voiceId: string): void {
        this.voiceId = voiceId;
        this.logger.log(`🎤 Voix changée: ${voiceId}`);
    }
}
