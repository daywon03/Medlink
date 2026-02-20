import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { TranscriptionGateway } from "./ws/transcription.gateway";
import { ArmGateway } from "./gateways/arm.gateway";
import { TrackingGateway } from "./gateways/tracking.gateway";
import { SupabaseService } from "./supabase/supabase.service";
import { RideService } from "./services/ride.service";
import { GeocodingService } from "./services/geocoding.service";
import { ElevenLabsRealtimeService } from "./elevenlabs/elevenlabs-realtime.service";
import { ElizaArmService } from "./eliza/eliza-arm.service";
import { ElevenLabsTTSService } from "./elevenlabs/elevenlabs-tts.service";
import { TriageController } from "./controllers/triage.controller";
import { CallsController } from "./controllers/calls.controller";
import { IncidentsController } from "./controllers/incidents.controller";
import { HospitalsController } from "./controllers/hospitals.controller";
import { RideController } from "./controllers/ride.controller";
import { ReportsController } from "./controllers/reports.controller";
import { RedisService } from "./services/redis.service";
import { GroqExtractionService } from "./services/groq-extraction.service";

// ─── Clean Architecture: Repository Interfaces ──────────────────────────────
import { CALL_REPOSITORY } from "./application/interfaces/call-repository.interface";
import { TRIAGE_REPOSITORY } from "./application/interfaces/triage-repository.interface";
import { TRANSCRIPTION_REPOSITORY } from "./application/interfaces/transcription-repository.interface";
import { EXTRACTED_DATA_REPOSITORY } from "./application/interfaces/extracted-data-repository.interface";

// ─── Clean Architecture: Infrastructure (Repository Implementations) ────────
import { SupabaseCallRepository } from "./infrastructure/repositories/supabase-call.repository";
import { SupabaseTriageRepository } from "./infrastructure/repositories/supabase-triage.repository";
import { SupabaseTranscriptionRepository } from "./infrastructure/repositories/supabase-transcription.repository";
import { SupabaseExtractedDataRepository } from "./infrastructure/repositories/supabase-extracted-data.repository";
import { SupabaseCitizenRepository } from "./infrastructure/repositories/supabase-citizen.repository";
import { SupabaseAssignmentRepository } from "./infrastructure/repositories/supabase-assignment.repository";

// ─── Clean Architecture: Application (Use Cases) ────────────────────────────
import { GetCallHistoryUseCase } from "./application/use-cases/get-call-history.use-case";
import { GetCallDetailUseCase } from "./application/use-cases/get-call-detail.use-case";
import { ExtractCallDataUseCase } from "./application/use-cases/extract-call-data.use-case";

@Module({
  imports: [
    //  Rate Limiting — 60 requêtes max par minute par IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requêtes max
      },
    ]),
  ],
  controllers: [
    AppController,
    TriageController,
    CallsController,
    IncidentsController,
    HospitalsController,
    RideController,
    ReportsController, //  PDF Export & Call History
  ],
  providers: [
    AppService,

    //  Rate Limiting Guard (global)
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // ─── WebSocket Gateways ──────────────────────────────────────────────
    TranscriptionGateway,
    ArmGateway,
    TrackingGateway,

    // ─── Services (Legacy, kept for backward compatibility) ──────────────
    SupabaseService,
    RideService,
    GeocodingService,
    ElevenLabsRealtimeService,
    ElevenLabsTTSService,
    ElizaArmService,
    RedisService,
    GroqExtractionService, //  Groq AI structured data extraction

    // ─── Clean Architecture: Repository Bindings (DI) ────────────────────
    // Interface → Implementation mapping via NestJS custom providers
    { provide: CALL_REPOSITORY, useClass: SupabaseCallRepository },
    { provide: TRIAGE_REPOSITORY, useClass: SupabaseTriageRepository },
    { provide: TRANSCRIPTION_REPOSITORY, useClass: SupabaseTranscriptionRepository },
    { provide: EXTRACTED_DATA_REPOSITORY, useClass: SupabaseExtractedDataRepository },

    // Concrete repositories (directly injectable)
    SupabaseCallRepository,
    SupabaseTriageRepository,
    SupabaseTranscriptionRepository,
    SupabaseExtractedDataRepository,
    SupabaseCitizenRepository,
    SupabaseAssignmentRepository,

    // ─── Clean Architecture: Use Cases ───────────────────────────────────
    GetCallHistoryUseCase,
    GetCallDetailUseCase,
    ExtractCallDataUseCase,
    { provide: 'ExtractCallDataUseCase', useExisting: ExtractCallDataUseCase }, //  Named provider for @Inject() in ElizaArmService
  ],
})
export class AppModule {}
