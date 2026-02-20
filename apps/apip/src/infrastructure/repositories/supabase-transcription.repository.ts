import { Injectable, Logger } from '@nestjs/common';
import { ITranscriptionRepository } from '../../application/interfaces';
import { Transcription } from '../../domain/entities';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Infrastructure Layer: Supabase implementation of ITranscriptionRepository
 */
@Injectable()
export class SupabaseTranscriptionRepository implements ITranscriptionRepository {
  private readonly logger = new Logger(SupabaseTranscriptionRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService['supabase'];
  }

  async insert(callId: string, text: string): Promise<void> {
    const { error } = await this.client
      .from('call_transcriptions')
      .insert([{ call_id: callId, texte_transcrit: text }]);

    if (error) {
      this.logger.error(` Error inserting transcription: ${error.message}`);
      throw error;
    }
  }

  async findByCallId(callId: string): Promise<Transcription[]> {
    const { data, error } = await this.client
      .from('call_transcriptions')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(` Error fetching transcriptions: ${error.message}`);
      throw error;
    }

    return (data || []).map(
      (row: any) =>
        new Transcription(
          row.transcription_id || row.id,
          row.call_id,
          row.texte_transcrit || row.text,
          row.created_at ? new Date(row.created_at) : new Date(),
        ),
    );
  }
}
