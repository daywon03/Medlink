import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ICallRepository, ITriageRepository, ITranscriptionRepository } from '../interfaces';
import { CALL_REPOSITORY, TRIAGE_REPOSITORY, TRANSCRIPTION_REPOSITORY } from '../interfaces';

/**
 * Use Case: Get detailed data for a single call (for PDF export)
 */
@Injectable()
export class GetCallDetailUseCase {
  private readonly logger = new Logger(GetCallDetailUseCase.name);

  constructor(
    @Inject(CALL_REPOSITORY) private readonly callRepo: ICallRepository,
    @Inject(TRIAGE_REPOSITORY) private readonly triageRepo: ITriageRepository,
    @Inject(TRANSCRIPTION_REPOSITORY) private readonly transcriptionRepo: ITranscriptionRepository,
  ) {}

  async execute(callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      return null;
    }

    const triage = await this.triageRepo.findByCallId(callId);
    const transcriptions = await this.transcriptionRepo.findByCallId(callId);

    return {
      callId: call.callId,
      citizenId: call.citizenId,
      dateHeure: call.dateHeure.toISOString(),
      status: call.status,
      locationInputText: call.locationInputText,
      extractedAddress: call.extractedAddress,
      duration: call.getDurationFormatted(),
      isFinished: call.isFinished(),
      triage: triage ? {
        priority: triage.priority,
        priorityNumeric: triage.priorityNumeric,
        aiExplanation: triage.aiExplanation,
        confidence: triage.confidence,
        isVitalEmergency: triage.isVitalEmergency(),
        validatedByDoctor: triage.validatedByDoctor,
        nearestHospitalData: triage.nearestHospitalData,
        patientLocation: triage.patientLocation,
        estimatedArrivalMinutes: triage.estimatedArrivalMinutes,
      } : null,
      transcriptions: transcriptions.map(t => ({
        text: t.text,
        createdAt: t.createdAt.toISOString(),
        wordCount: t.getWordCount(),
      })),
    };
  }
}
