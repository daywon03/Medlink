import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

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

  /**
   * Convert WebM audio to WAV format using ffmpeg
   * This fixes the "corrupted audio" issue with ElevenLabs API
   */
  private async convertWebMToWAV(webmBuffer: Buffer): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${Date.now()}.webm`);
    const outputPath = path.join(tmpDir, `output-${Date.now()}.wav`);

    try {
      // Write WebM to temp file
      await fs.promises.writeFile(inputPath, webmBuffer);

      // Convert using ffmpeg: WebM → WAV (16kHz, mono, PCM)
      const ffmpegCmd = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}" -y`;

      await execAsync(ffmpegCmd);

      // Read converted WAV file
      const wavBuffer = await fs.promises.readFile(outputPath);

      // Cleanup temp files
      await fs.promises.unlink(inputPath).catch(() => { });
      await fs.promises.unlink(outputPath).catch(() => { });

      this.logger.log(`✅ Converted WebM (${webmBuffer.length}b) → WAV (${wavBuffer.length}b)`);
      return wavBuffer;

    } catch (error) {
      // Cleanup on error
      await fs.promises.unlink(inputPath).catch(() => { });
      await fs.promises.unlink(outputPath).catch(() => { });

      this.logger.warn(`⚠️  ffmpeg conversion failed: ${error.message}`);
      throw error;
    }
  }

  async transcribeAudioChunk(audioBuffer: Buffer): Promise<string> {
    if (audioBuffer.length === 0) {
      this.logger.warn('⚠️  Buffer audio vide');
      return '';
    }

    try {
      let processedBuffer = audioBuffer;
      let contentType = 'audio/webm';
      let filename = 'audio.webm';

      // Try to convert WebM to WAV to avoid corruption issues
      try {
        processedBuffer = await this.convertWebMToWAV(audioBuffer);
        contentType = 'audio/wav';
        filename = 'audio.wav';
        this.logger.log('🔄 Using converted WAV format');
      } catch (conversionError) {
        this.logger.warn('⚠️  Conversion failed, using original WebM');
        // Will use original webmBuffer
      }

      const formData = new FormData();

      // Paramètres requis par l'API
      formData.append('model_id', 'scribe_v2');

      // Fichier audio
      formData.append('file', processedBuffer, {
        filename,
        contentType,
      });

      this.logger.log(`📤 Envoi ${processedBuffer.length} bytes à ElevenLabs...`);

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
