import { Injectable, Inject, Logger } from '@nestjs/common';
import type {
  IExtractedDataRepository,
  ITranscriptionRepository,
  ExtractedDataInput,
} from '../interfaces';
import {
  EXTRACTED_DATA_REPOSITORY,
  TRANSCRIPTION_REPOSITORY,
} from '../interfaces';
import type { PriorityLevel } from '../../domain/entities';
import { ExtractedData } from '../../domain/entities';

/**
 * Use Case: Extract structured data from call transcriptions using AI
 * and compute smart triage priority
 */
@Injectable()
export class ExtractCallDataUseCase {
  private readonly logger = new Logger(ExtractCallDataUseCase.name);

  constructor(
    @Inject(EXTRACTED_DATA_REPOSITORY) private readonly extractedDataRepo: IExtractedDataRepository,
    @Inject(TRANSCRIPTION_REPOSITORY) private readonly transcriptionRepo: ITranscriptionRepository,
  ) {}

  /**
   * Extract structured data from transcriptions using Groq AI
   * Called after call ends or during progressive analysis
   */
  async execute(callId: string, groqExtraction: ExtractedDataInput): Promise<ExtractedData> {
    this.logger.log(`🤖 Extracting structured data for call: ${callId}`);

    const extracted = await this.extractedDataRepo.createOrUpdate(callId, groqExtraction);

    this.logger.log(
      `✅ Extracted data saved - Age: ${extracted.patientAge}, ` +
      `Symptoms: [${extracted.symptoms.join(', ')}], ` +
      `Conscious: ${extracted.isConscious}, ` +
      `Confidence: ${extracted.extractionConfidence}`,
    );

    return extracted;
  }

  /**
   * Calculate smart triage priority based on extracted data
   */
  calculateSmartPriority(extractedData: ExtractedData): PriorityLevel {
    const score = extractedData.calculateSeverityScore();

    let priority: PriorityLevel;
    if (score >= 80) priority = 'P0';       // Urgence absolue
    else if (score >= 50) priority = 'P1';  // Urgence vitale
    else if (score >= 30) priority = 'P2';  // Urgence relative
    else if (score >= 15) priority = 'P3';  // Peu urgent
    else priority = 'P5';                   // Conseil médical

    this.logger.log(`📊 Smart Triage - Score: ${score} → Priority: ${priority}`);
    return priority;
  }

  /**
   * Get existing extracted data for a call
   */
  async getExtractedData(callId: string): Promise<ExtractedData | null> {
    return this.extractedDataRepo.findByCallId(callId);
  }
}
