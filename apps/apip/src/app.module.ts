import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranscriptionGateway } from './ws/transcription.gateway';
import { SupabaseService } from './supabase/supabase.service';
import { ElevenLabsService } from './elevenlabs/elevenlabs.service'; 


@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, TranscriptionGateway, SupabaseService, ElevenLabsService],
})
export class AppModule {}
