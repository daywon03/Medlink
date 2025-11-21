import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import FormData from 'form-data';

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private apiKey: string;
  private apiUrl = 'https://api.elevenlabs.io/v1/speech-to-text';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY est requise dans .env');
    }
  }

  async transcribeAudioChunk(audioBuffer: Buffer): Promise<string> {
    if (audioBuffer.length === 0) {
      this.logger.warn('⚠️  Buffer audio vide');
      return '';
    }

    try {
      const formData = new FormData();
      
      // Paramètres requis par l'API
      formData.append('model_id', 'scribe_v2');
      
      // Fichier audio
      formData.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });

      this.logger.log(`📤 Envoi ${audioBuffer.length} bytes à ElevenLabs...`);

      // Utilisation de node-fetch avec FormData
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          ...formData.getHeaders(), // Important pour multipart/form-data
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`❌ Status ${response.status}: ${errorText}`);
        
        if (response.status === 401) {
          throw new Error('Clé API invalide');
        } else if (response.status === 429) {
          throw new Error('Quota dépassé');
        } else if (response.status === 422) {
          throw new Error(`Paramètres invalides: ${errorText}`);
        }
        
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      const text = (data.text || '').trim();
      
      if (text) {
        this.logger.log(`✅ "${text}"`);
      } else {
        this.logger.log('⚠️  Silence');
      }

      return text;
    } catch (error) {
      this.logger.error(`❌ ${error.message}`);
      throw error;
    }
  }
}
