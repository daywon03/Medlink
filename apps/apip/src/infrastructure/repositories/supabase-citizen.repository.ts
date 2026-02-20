import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { randomUUID } from 'crypto';

/**
 * Infrastructure Layer: Citizen Repository
 * Manages anonymous citizen creation for calls
 */
@Injectable()
export class SupabaseCitizenRepository {
  private readonly logger = new Logger(SupabaseCitizenRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService['supabase'];
  }

  async createAnonymous(): Promise<{ citizenId: string }> {
    const citizenId = randomUUID();

    const { data, error } = await this.client
      .from('citizens')
      .insert([{
        citizen_id: citizenId,
        token_pseudo: `anonymous-${Date.now()}`,
        date_consention: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      this.logger.error(` Error creating anonymous citizen: ${error.message}`);
      throw error;
    }

    return { citizenId: data.citizen_id };
  }
}
