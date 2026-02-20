import { Transcription } from '../../domain/entities';

/**
 * Application Layer Interface: Transcription Repository
 */
export interface ITranscriptionRepository {
  insert(callId: string, text: string): Promise<void>;
  findByCallId(callId: string): Promise<Transcription[]>;
}

export const TRANSCRIPTION_REPOSITORY = 'TRANSCRIPTION_REPOSITORY';
