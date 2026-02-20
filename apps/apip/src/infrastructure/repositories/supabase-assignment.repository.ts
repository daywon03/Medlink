import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Infrastructure Layer: Assignment Repository
 * Manages ambulance assignments to calls
 */
@Injectable()
export class SupabaseAssignmentRepository {
  private readonly logger = new Logger(SupabaseAssignmentRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService['supabase'];
  }

  async assignAmbulance(payload: {
    callId: string;
    ambulanceTeam: string;
    trackingToken?: string;
  }) {
    if (!payload.callId || !payload.ambulanceTeam) {
      throw new Error('Missing callId or ambulanceTeam');
    }

    const { data: existing } = await this.client
      .from('assignments')
      .select('assignment_id')
      .eq('call_id', payload.callId)
      .single();

    const assignmentData = {
      call_id: payload.callId,
      ambulance_team: payload.ambulanceTeam,
      tracking_token: payload.trackingToken || Math.random().toString(36).substring(7),
      status: 'assigned',
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      const res = await this.client
        .from('assignments')
        .update(assignmentData)
        .eq('assignment_id', existing.assignment_id);
      error = res.error;
    } else {
      const res = await this.client
        .from('assignments')
        .insert(assignmentData);
      error = res.error;
    }

    if (error) {
      this.logger.error(` Failed to assign ambulance: ${error.message}`);
      throw new Error(`Database error: ${error.message}`);
    }

    this.logger.log(` Ambulance assigned to call ${payload.callId}`);
    return assignmentData;
  }
}
