import { ExtractedData } from '../../domain/entities';

/**
 * Application Layer Interface: Extracted Data Repository
 * For AI-extracted structured data from calls
 */
export interface IExtractedDataRepository {
  createOrUpdate(callId: string, data: ExtractedDataInput): Promise<ExtractedData>;
  findByCallId(callId: string): Promise<ExtractedData | null>;
}

export interface ExtractedDataInput {
  patientAge?: number | null;
  patientGender?: 'M' | 'F' | 'unknown';
  symptoms?: string[];
  medicalHistory?: string[];
  isConscious?: boolean | null;
  isBreathing?: boolean | null;
  hasBleeding?: boolean | null;
  extractionConfidence?: number;
}

export const EXTRACTED_DATA_REPOSITORY = 'EXTRACTED_DATA_REPOSITORY';
