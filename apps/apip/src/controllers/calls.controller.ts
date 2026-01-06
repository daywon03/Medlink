import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('api/calls')
export class CallsController {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * GET /api/calls
   * Récupère tous les appels d'urgence récents avec triage
   */
  @Get()
  async getAllCalls() {
    try {
      const { data, error } = await this.supabase['supabase']
        .from('emergency_calls')
        .select(`
          call_id,
          citizen_id,
          date_heure,
          location_input_text,
          status,
          triage_reports (
            priority_classification,
            ai_explanation
          )
        `)
        .order('date_heure', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Error fetching calls:', error);
        return {
          success: false,
          message: error.message
        };
      }

      // Transform to match ARM dashboard format
      return {
        success: true,
        data: data.map(call => {
          const triage = Array.isArray(call.triage_reports)
            ? call.triage_reports[0]
            : call.triage_reports;

          // Map P0-P3 to 1-4 priority (P0=1, P1=2, P2=3, P3=4)
          const priorityMap = { 'P0': 1, 'P1': 2, 'P2': 3, 'P3': 4 };
          const priority = triage?.priority_classification
            ? priorityMap[triage.priority_classification] || 5
            : 5;

          return {
            id: call.call_id,
            createdAt: new Date(call.date_heure).toISOString().slice(0, 16).replace('T', ' '),
            status: call.status || 'nouveau',
            priority,
            title: triage?.ai_explanation?.substring(0, 60) || 'Appel en cours de traitement',
            locationLabel: call.location_input_text || 'Localisation inconnue',
            lat: 48.8566, // TODO: Geocoding depuis location_input_text
            lng: 2.3522,
            symptoms: [], // TODO: Extraire depuis triage si disponible
            notes: triage?.ai_explanation || ''
          };
        })
      };
    } catch (error) {
      console.error('❌ Exception in getAllCalls:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
