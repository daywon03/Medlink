import { Injectable, Logger } from '@nestjs/common';
import { ITriageRepository, TriageCreateData } from '../../application/interfaces';
import { TriageReport } from '../../domain/entities';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Infrastructure Layer: Supabase implementation of ITriageRepository
 */
@Injectable()
export class SupabaseTriageRepository implements ITriageRepository {
  private readonly logger = new Logger(SupabaseTriageRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService['supabase'];
  }

  async createOrUpdate(callId: string, data: TriageCreateData): Promise<TriageReport> {
    const { data: existing } = await this.client
      .from('triage_reports')
      .select('report_id')
      .eq('call_id', callId)
      .single();

    const triageRow = {
      call_id: callId,
      priority_classification: data.priority,
      ai_explanation: data.summary,
      classification_confidence: data.confidence,
      ai_model_version: 'groq/compound',
      nearest_hospital_data: data.nearestHospital ? JSON.stringify(data.nearestHospital) : null,
      fire_station_data: data.nearestFireStation ? JSON.stringify(data.nearestFireStation) : null,
      patient_location: data.patientLocation ? JSON.stringify(data.patientLocation) : null,
      estimated_arrival_minutes: data.eta || null,
      data_json_synthese: data.agentAdvice ? JSON.stringify({ advice: data.agentAdvice }) : null,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (existing) {
      const { data: updated, error } = await this.client
        .from('triage_reports')
        .update(triageRow)
        .eq('call_id', callId)
        .select()
        .single();

      if (error) throw error;
      result = updated;
    } else {
      const { data: inserted, error } = await this.client
        .from('triage_reports')
        .insert([{
          ...triageRow,
          classification_source: 'ai_agent',
          validated_by_doctor: false,
        }])
        .select()
        .single();

      if (error) throw error;
      result = inserted;
    }

    return this.mapToEntity(result);
  }

  async findByCallId(callId: string): Promise<TriageReport | null> {
    const { data, error } = await this.client
      .from('triage_reports')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(` Error fetching triage: ${error.message}`);
    }

    return data ? this.mapToEntity(data) : null;
  }

  async findAll(limit = 50): Promise<TriageReport[]> {
    const { data, error } = await this.client
      .from('triage_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(this.mapToEntity);
  }

  async updateHospital(callId: string, hospital: any, etaMinutes?: number): Promise<void> {
    const { error } = await this.client
      .from('triage_reports')
      .update({
        nearest_hospital_data: JSON.stringify(hospital),
        estimated_arrival_minutes: etaMinutes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('call_id', callId);

    if (error) throw error;
  }

  private mapToEntity(data: any): TriageReport {
    return new TriageReport(
      data.report_id,
      data.call_id,
      data.priority_classification,
      data.ai_explanation,
      data.classification_confidence,
      data.classification_source,
      data.ai_model_version,
      data.validated_by_doctor,
      data.nearest_hospital_data,
      data.fire_station_data,
      data.patient_location,
      data.estimated_arrival_minutes,
      data.data_json_synthese,
      data.transcript ?? null, // Column may not exist in DB
      data.created_at ? new Date(data.created_at) : new Date(),
      data.updated_at ? new Date(data.updated_at) : new Date(),
    );
  }
}
