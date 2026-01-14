
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Assign an ambulance to a call correctly persisting data
   */
  async assignAmbulance(payload: {
    callId: string;
    ambulanceTeam: string;
    trackingToken?: string;
  }) {
    // Validate payload
    if (!payload.callId || !payload.ambulanceTeam) {
      throw new Error('Missing callId or ambulanceTeam');
    }

    // Check if assignment exists
    const { data: existing } = await this.supabase['supabase']
      .from('assignments')
      .select('assignment_id')
      .eq('call_id', payload.callId)
      .single();

    const assignmentData = {
      call_id: payload.callId,
      ambulance_team: payload.ambulanceTeam,
      tracking_token:
        payload.trackingToken || Math.random().toString(36).substring(7),
      status: 'assigned',
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      // Update existing
      const res = await this.supabase['supabase']
        .from('assignments')
        .update(assignmentData)
        .eq('assignment_id', existing.assignment_id);
      error = res.error;
    } else {
      // Insert new
      const res = await this.supabase['supabase']
        .from('assignments')
        .insert(assignmentData);
      error = res.error;
    }

    if (error) {
      this.logger.error(`Failed to assign ambulance: ${error.message}`);
      throw new Error(`Database error: ${error.message}`);
    }

    this.logger.log(`✅ Ambulance assigned to call ${payload.callId}`);
    return assignmentData;
  }
}
