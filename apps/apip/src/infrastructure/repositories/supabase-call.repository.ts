import { Injectable, Logger } from '@nestjs/common';
import { ICallRepository, CallFilters } from '../../application/interfaces';
import { Call } from '../../domain/entities';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Infrastructure Layer: Supabase implementation of ICallRepository
 */
@Injectable()
export class SupabaseCallRepository implements ICallRepository {
  private readonly logger = new Logger(SupabaseCallRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService['supabase'];
  }

  async create(citizenId: string, locationInput?: string | null): Promise<Call> {
    const { data, error } = await this.client
      .from('emergency_calls')
      .insert([{
        citizen_id: citizenId,
        location_input_text: locationInput || null,
        date_heure: new Date().toISOString(),
        status: 'en_cours',
      }])
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Error creating call: ${error.message}`);
      throw error;
    }

    return this.mapToEntity(data);
  }

  async findById(callId: string): Promise<Call | null> {
    const { data, error } = await this.client
      .from('emergency_calls')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error) return null;
    return data ? this.mapToEntity(data) : null;
  }

  async findAll(filters?: CallFilters): Promise<{ calls: Call[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.client
      .from('emergency_calls')
      .select('*', { count: 'exact' })
      .order('date_heure', { ascending: false });

    if (filters?.search) {
      query = query.ilike('location_input_text', `%${filters.search}%`);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.dateFrom) {
      query = query.gte('date_heure', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('date_heure', filters.dateTo);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`❌ Error fetching calls: ${error.message}`);
      throw error;
    }

    return {
      calls: (data || []).map(this.mapToEntity),
      total: count || 0,
    };
  }

  async findClosed(filters?: CallFilters): Promise<{ calls: Call[]; total: number }> {
    return this.findAll({ ...filters, status: 'terminé' });
  }

  async updateAddress(callId: string, address: string): Promise<void> {
    const { error } = await this.client
      .from('emergency_calls')
      .update({ location_input_text: address })
      .eq('call_id', callId);

    if (error) {
      this.logger.error(`❌ Error updating address: ${error.message}`);
      throw error;
    }
  }

  async finishCall(callId: string): Promise<void> {
    const { error } = await this.client
      .from('emergency_calls')
      .update({ status: 'terminé' })
      .eq('call_id', callId);

    if (error) {
      this.logger.error(`❌ Error finishing call: ${error.message}`);
      throw error;
    }
  }

  private mapToEntity(data: any): Call {
    return new Call(
      data.call_id,
      data.citizen_id,
      data.location_input_text,
      data.status || 'en_cours',
      new Date(data.date_heure),
      data.updated_at ? new Date(data.updated_at) : undefined,
      data.location_input_text, // DB has no extracted_address column, reuse location_input_text
    );
  }
}
