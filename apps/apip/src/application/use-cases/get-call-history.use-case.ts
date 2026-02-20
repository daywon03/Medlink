import { Injectable, Inject, Logger } from '@nestjs/common';
import type { ICallRepository, ITriageRepository, ITranscriptionRepository } from '../interfaces';
import { CALL_REPOSITORY, TRIAGE_REPOSITORY, TRANSCRIPTION_REPOSITORY } from '../interfaces';

/**
 * Use Case: Get Call History with pagination and filters
 * Used by the Reports/History page
 */
@Injectable()
export class GetCallHistoryUseCase {
  private readonly logger = new Logger(GetCallHistoryUseCase.name);

  constructor(
    @Inject(CALL_REPOSITORY) private readonly callRepo: ICallRepository,
    @Inject(TRIAGE_REPOSITORY) private readonly triageRepo: ITriageRepository,
    @Inject(TRANSCRIPTION_REPOSITORY) private readonly transcriptionRepo: ITranscriptionRepository,
  ) {}

  async execute(filters: {
    search?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { calls, total } = await this.callRepo.findAll({
      search: filters.search,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page || 1,
      limit: filters.limit || 20,
    });

    // Enrich calls with triage data
    const enrichedCalls = await Promise.all(
      calls.map(async (call) => {
        const triage = await this.triageRepo.findByCallId(call.callId);
        const transcriptions = await this.transcriptionRepo.findByCallId(call.callId);

        // Filter by priority if specified
        if (filters.priority && triage && triage.priority !== filters.priority) {
          return null;
        }

        return {
          callId: call.callId,
          citizenId: call.citizenId,
          dateHeure: call.dateHeure.toISOString(),
          status: call.status,
          locationInputText: call.locationInputText,
          extractedAddress: call.extractedAddress,
          duration: call.getDurationFormatted(),
          triage: triage ? {
            priority: triage.priority,
            priorityNumeric: triage.priorityNumeric,
            aiExplanation: triage.aiExplanation,
            confidence: triage.confidence,
            nearestHospitalData: triage.nearestHospitalData,
            patientLocation: triage.patientLocation,
            estimatedArrivalMinutes: triage.estimatedArrivalMinutes,
            isVitalEmergency: triage.isVitalEmergency(),
          } : null,
          transcriptionCount: transcriptions.length,
          transcriptions: transcriptions.map(t => ({
            text: t.text,
            createdAt: t.createdAt.toISOString(),
          })),
        };
      }),
    );

    const filteredCalls = enrichedCalls.filter(Boolean);

    return {
      calls: filteredCalls,
      total: filters.priority ? filteredCalls.length : total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      totalPages: Math.ceil((filters.priority ? filteredCalls.length : total) / (filters.limit || 20)),
    };
  }
}
