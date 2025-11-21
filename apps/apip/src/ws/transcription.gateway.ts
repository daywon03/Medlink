import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { SupabaseService } from '../supabase/supabase.service';
import { ElevenLabsService } from '../elevenlabs/elevenlabs.service';

interface ClientContext {
  callId: string | null;
  citizenId: string | null;
  bufferIndex: number;
  fullTranscript: string;
}

@Injectable()
export class TranscriptionGateway {
  private readonly logger = new Logger(TranscriptionGateway.name);

  constructor(
    private readonly supa: SupabaseService,
    private readonly elevenlabs: ElevenLabsService
  ) {}

  handleConnection(client: WebSocket) {
    this.logger.log('🟢 Client connecté');
    
    const context: ClientContext = { 
      callId: null, 
      citizenId: null,
      bufferIndex: 0,
      fullTranscript: ''
    };
    
    (client as any).context = context;
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log('🔴 Client déconnecté');
  }

  async handleMessage(client: WebSocket, data: Buffer, isBinary: boolean) {
    try {
      const ctx = (client as any).context as ClientContext;

      if (!isBinary) {
        const msg = JSON.parse(data.toString());
        this.logger.log(`📩 Message: ${msg.type}`);

        if (msg.type === 'start_call') {
          const citizen = await this.supa.createAnonymousCitizen();
          ctx.citizenId = citizen.citizen_id;
          this.logger.log(`👤 Citoyen créé: ${citizen.citizen_id}`);

          const call = await this.supa.createCall({
            citizen_id: citizen.citizen_id,
            location_input_text: null
          });
          
          ctx.callId = call.call_id;
          this.logger.log(`📞 Appel créé: ${call.call_id}`);

          this.send(client, 'info', { 
            callId: call.call_id,
            message: "Connexion établie. Parlez maintenant..."
          });
        } 
        
        else if (msg.type === 'end_call') {
          if (ctx.callId) {
            const extractedAddress = this.extractAddress(ctx.fullTranscript);
            
            if (extractedAddress) {
              await this.supa.updateCallAddress(ctx.callId, extractedAddress);
              this.logger.log(`📍 Adresse: ${extractedAddress}`);
            }

            await this.supa.finishCall(ctx.callId);
            this.logger.log(`✅ Appel terminé: ${ctx.callId}`);
          }
          
          this.send(client, 'info', { message: "Appel terminé." });
        }
      } 
      
      else {
        // Chunk audio binaire (maintenant 8s donc complet)
        if (!ctx.callId) {
          this.logger.warn('⚠️  Audio reçu avant création appel');
          return;
        }

        ctx.bufferIndex++;
        this.logger.log(`🎵 Chunk ${ctx.bufferIndex} reçu (${data.length} bytes)`);

        try {
          // ✅ Envoi direct à ElevenLabs (chunk de 8s = fichier valide)
          const transcribedText = await this.elevenlabs.transcribeAudioChunk(data);
          
          if (transcribedText && transcribedText.trim().length > 0) {
            ctx.fullTranscript += ' ' + transcribedText;

            await this.supa.insertTranscription(ctx.callId, transcribedText);
            this.logger.log(`💾 Enregistré`);

            this.send(client, 'partial_transcript', { 
              text: transcribedText,
              isFinal: true
            });
            this.logger.log(`📤 Envoyé au frontend`);
          } else {
            this.logger.log('⚠️  Silence détecté (normal)');
          }
        } catch (error) {
          this.logger.error(`❌ Erreur: ${error.message}`);
          
          // Si erreur "corrupted", log détaillé
          if (error.message.includes('corrupted')) {
            this.logger.error(`Chunk ${ctx.bufferIndex} : ${data.length} bytes invalide`);
          }
        }
      }
    } catch (e) {
      this.logger.error(`❌ Erreur handleMessage: ${e.message}`);
      this.send(client, 'info', { message: 'Erreur lors du traitement' });
    }
  }

  private extractAddress(text: string): string | null {
    if (!text || text.trim().length === 0) return null;

    const pattern = /(\d+\s+(?:rue|avenue|boulevard|place|impasse)\s+[\w\s'-]+(?:,\s*[\w\s]+)?)/i;
    const match = text.match(pattern);
    
    if (match) return match[0].trim();
    
    const pattern2 = /(?:j'habite|habite|suis)\s+(?:au|à|dans|sur)\s+([\d\s\w,'-]+)/i;
    const match2 = text.match(pattern2);
    
    return match2 ? match2[1].trim() : null;
  }

  private send(client: WebSocket, type: string, payload: any) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, payload }));
    }
  }
}
