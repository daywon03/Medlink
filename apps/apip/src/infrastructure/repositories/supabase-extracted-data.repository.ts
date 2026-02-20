import { Injectable, Logger } from '@nestjs/common';
import { IExtractedDataRepository, ExtractedDataInput } from '../../application/interfaces';
import { ExtractedData } from '../../domain/entities';
import { SupabaseService } from '../../supabase/supabase.service';
import { randomUUID } from 'crypto';

/**
 * Infrastructure Layer: Supabase implementation of IExtractedDataRepository
 * Stores AI-extracted structured data from call conversations
 */
@Injectable()
export class SupabaseExtractedDataRepository implements IExtractedDataRepository {
  private readonly logger = new Logger(SupabaseExtractedDataRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService['supabase'];
  }

  async createOrUpdate(callId: string, data: ExtractedDataInput): Promise<ExtractedData> {
    const { data: existing } = await this.client
      .from('call_extracted_data')
      .select('extraction_id')
      .eq('call_id', callId)
      .single();

    const row = {
      call_id: callId,
      patient_age: data.patientAge ?? null,
      patient_gender: data.patientGender ?? 'unknown',
      symptoms: data.symptoms ?? [],
      medical_history: data.medicalHistory ?? [],
      is_conscious: data.isConscious ?? null,
      is_breathing: data.isBreathing ?? null,
      has_bleeding: data.hasBleeding ?? null,
      extraction_confidence: data.extractionConfidence ?? 0,
      extracted_at: new Date().toISOString(),
    };

    let result;

    if (existing) {
      const { data: updated, error } = await this.client
        .from('call_extracted_data')
        .update(row)
        .eq('call_id', callId)
        .select()
        .single();

      if (error) {
        this.logger.error(`❌ Error updating extracted data: ${error.message}`);
        throw error;
      }
      result = updated;
    } else {
      const { data: inserted, error } = await this.client
        .from('call_extracted_data')
        .insert([row])
        .select()
        .single();

      if (error) {
        this.logger.error(`❌ Error inserting extracted data: ${error.message}`);
        throw error;
      }
      result = inserted;
    }

    return this.mapToEntity(result);
  }

  async findByCallId(callId: string): Promise<ExtractedData | null> {
    const { data, error } = await this.client
      .from('call_extracted_data')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`❌ Error fetching extracted data: ${error.message}`);
    }

    return data ? this.mapToEntity(data) : null;
  }

  private mapToEntity(data: any): ExtractedData {
    return new ExtractedData(
      data.extraction_id || randomUUID(),
      data.call_id,
      data.patient_age,
      data.patient_gender || 'unknown',
      data.symptoms || [],
      data.medical_history || [],
      data.is_conscious,
      data.is_breathing,
      data.has_bleeding,
      data.extraction_confidence || 0,
      data.extracted_at ? new Date(data.extracted_at) : new Date(),
    );
  }
}
