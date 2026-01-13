import { Controller, Get, Param } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('api/triage')
export class TriageController {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * GET /api/triage/:callId
   * Récupère le résumé de triage pour un appel
   */
  @Get(':callId')
  async getTriageReport(@Param('callId') callId: string) {
    try {
      const triage = await this.supabase.getTriageReport(callId);

      if (!triage) {
        return {
          success: false,
          message: 'Aucun rapport de triage trouvé pour cet appel'
        };
      }

      // Parse JSON fields
      let nearestHospital = null;
      let patientLocation = null;

      try {
        if (triage.nearest_hospital_data) {
          nearestHospital = typeof triage.nearest_hospital_data === 'string'
            ? JSON.parse(triage.nearest_hospital_data)
            : triage.nearest_hospital_data;
        }
        if (triage.patient_location) {
          patientLocation = typeof triage.patient_location === 'string'
            ? JSON.parse(triage.patient_location)
            : triage.patient_location;
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
      }

      return {
        success: true,
        call_id: triage.call_id,
        priority: triage.priority_classification,
        summary: triage.ai_explanation,
        confidence: triage.classification_confidence,
        source: triage.classification_source,
        ai_model: triage.ai_model_version,
        validated: triage.validated_by_doctor,
        created_at: triage.created_at,
        // 🆕 Geocoding data
        nearest_hospital_data: nearestHospital,
        patient_location: patientLocation,
        estimated_arrival_minutes: triage.estimated_arrival_minutes
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * GET /api/triage
   * Récupère tous les rapports de triage récents (pour dashboard)
   */
  @Get()
  async getAllTriageReports() {
    try {
      const { data, error } = await this.supabase['supabase']
        .from('triage_reports')
        .select(`
          *,
          emergency_calls (
            call_timestamp,
            location_input_text,
            status
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        success: true,
        data: data.map(triage => ({
          call_id: triage.call_id,
          priority: triage.priority_classification,
          summary: triage.ai_explanation,
          confidence: triage.classification_confidence,
          validated: triage.validated_by_doctor,
          created_at: triage.created_at,
          call_info: triage.emergency_calls
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
