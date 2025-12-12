import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranscriptionGateway } from './ws/transcription.gateway';
import { SupabaseService } from './supabase/supabase.service';
import { ElevenLabsService } from './elevenlabs/elevenlabs.service';
import { ElevenLabsRealtimeService } from './elevenlabs/elevenlabs-realtime.service';
import { ElizaArmService } from './eliza/eliza-arm.service';
import { ElevenLabsTTSService } from './elevenlabs/elevenlabs-tts.service';
import { PatientsController } from './patients/patients.controller';
import { PatientsService } from './patients/patients.service';

@Module({
  imports: [],
  controllers: [AppController, PatientsController],
  providers: [
    AppService,
    TranscriptionGateway,
    SupabaseService,
    ElevenLabsService,
    ElevenLabsRealtimeService,
    ElevenLabsTTSService,
    ElizaArmService,
    PatientsService,
  ],
})
export class AppModule {}
