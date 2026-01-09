import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranscriptionGateway } from './ws/transcription.gateway';
import { ArmGateway } from './gateways/arm.gateway';
import { TrackingGateway } from './gateways/tracking.gateway';
import { SupabaseService } from './supabase/supabase.service';
import { RideService } from './services/ride.service';
import { ElevenLabsRealtimeService } from './elevenlabs/elevenlabs-realtime.service'; // ElevenLabs STT
import { ElizaArmService } from './eliza/eliza-arm.service';
import { ElevenLabsTTSService } from './elevenlabs/elevenlabs-tts.service';
import { TriageController } from './controllers/triage.controller';
import { CallsController } from './controllers/calls.controller';

@Module({
  imports: [],
  controllers: [AppController, TriageController, CallsController],
  providers: [
    AppService,
    // WebSocket Gateways
    TranscriptionGateway,  // /voice (existing)
    ArmGateway,            // /arm (new)
    TrackingGateway,       // /t/[token] (new)
    // Services
    SupabaseService,
    RideService,
    ElevenLabsRealtimeService,  // ElevenLabs STT (Scribe Realtime v2)
    ElevenLabsTTSService,       // ElevenLabs TTS
    ElizaArmService,
  ],
})
export class AppModule { }
