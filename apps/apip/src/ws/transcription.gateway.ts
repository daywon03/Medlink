import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { SupabaseService } from '../supabase/supabase.service';
import { ElevenLabsRealtimeService } from '../elevenlabs/elevenlabs-realtime.service';
import { ElevenLabsTTSService } from '../elevenlabs/elevenlabs-tts.service';
import { ElizaArmService } from '../eliza/eliza-arm.service';

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
    private readonly elevenLabsRealtime: ElevenLabsRealtimeService,
    private readonly tts: ElevenLabsTTSService,
    private readonly elizaArm: ElizaArmService,
  ) { }

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

          // Connect ElevenLabs Realtime WebSocket for this call
          await this.elevenLabsRealtime.connectForCall(
            ctx.callId!,  // Non-null assertion - callId was just assigned above
            async (transcribedText: string) => {
              // Callback when transcript is committed
              this.logger.log(`👤 Patient: "${transcribedText}"`);

              ctx.fullTranscript += ' ' + transcribedText;
              await this.supa.insertTranscription(ctx.callId!, transcribedText);

              // Send to frontend
              this.send(client, 'patient_speech', { text: transcribedText });

              // Get ARM response
              const armResponse = await this.elizaArm.getArmResponse(
                transcribedText,
                ctx.callId!,
                ctx.citizenId!,
              );

              // TTS + send to frontend
              this.logger.log(`🔊 Agent parle: "${armResponse}"`);
              const audioBuffer = await this.tts.textToSpeech(armResponse);
              const audioBase64 = audioBuffer.toString('base64');
              this.send(client, 'agent_speech', { text: armResponse, audio: audioBase64 });
            },
          );

          // Send greeting
          const greeting = this.elizaArm.getGreeting();
          this.logger.log(`🔊 Agent parle: "${greeting}"`);

          const greetingAudio = await this.tts.textToSpeech(greeting);
          const greetingBase64 = greetingAudio.toString('base64');
          this.send(client, 'agent_speech', { text: greeting, audio: greetingBase64 });
        }

        else if (msg.type === 'end_call') {
          if (ctx.callId) {
            // Disconnect ElevenLabs Realtime
            this.elevenLabsRealtime.disconnectForCall(ctx.callId);
            this.elizaArm.clearContext(ctx.callId);

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
        // Binary audio chunk - send directly to ElevenLabs Realtime WebSocket
        if (!ctx.callId) {
          this.logger.warn('⚠️  Audio received before call creation');
          return;
        }
        // Binary data = audio chunk from frontend
        if (isBinary && ctx.callId) {
          try {
            // Vérifier si la connexion ElevenLabs existe toujours
            const hasConnection = this.elevenLabsRealtime['connections'].has(ctx.callId);

            if (!hasConnection) {
              this.logger.warn(`🔄 ElevenLabs déconnecté, reconnexion pour: ${ctx.callId}`);

              // Reconnect ElevenLabs avec le même callback
              await this.elevenLabsRealtime.connectForCall(
                ctx.callId,
                async (transcribedText: string) => {
                  this.logger.log(`👤 Patient: "${transcribedText}"`);

                  ctx.fullTranscript += ' ' + transcribedText;
                  await this.supa.insertTranscription(ctx.callId!, transcribedText);

                  this.send(client, 'patient_speech', { text: transcribedText });

                  const armResponse = await this.elizaArm.getArmResponse(
                    transcribedText,
                    ctx.callId!,
                    ctx.citizenId!,
                  );

                  this.logger.log(`🔊 Agent parle: "${armResponse}"`);
                  const audioBuffer = await this.tts.textToSpeech(armResponse);
                  const audioBase64 = audioBuffer.toString('base64');
                  this.send(client, 'agent_speech', { text: armResponse, audio: audioBase64 });
                },
              );

              this.logger.log(`✅ ElevenLabs reconnecté pour: ${ctx.callId}`);
            }

            // Envoyer l'audio à ElevenLabs
            await this.elevenLabsRealtime.sendAudioChunk(ctx.callId, data);
          } catch (error) {
            this.logger.error(`❌ Erreur audio: ${error.message}`);
          }
        }
      }
    } catch (e) {
      this.logger.error(`❌ Erreur handleMessage: ${e.message}`);
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
