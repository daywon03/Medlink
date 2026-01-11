import { Controller, Get } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Controller("api/calls")
export class CallsController {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * GET /api/calls
   * Récupère tous les appels d'urgence récents avec triage
   */
  @Get()
  async getAllCalls() {
    try {
      const { data, error } = await this.supabase["supabase"]
        .from("emergency_calls")
        .select(
          `
          call_id,
          citizen_id,
          date_heure,
          updated_at,
          location_input_text,
          status,
          triage_reports (
            priority_classification,
            ai_explanation,
            nearest_hospital_data,
            fire_station_data,
            patient_location,
            estimated_arrival_minutes
          )
        `,
        )
        .order("date_heure", { ascending: false })
        .limit(50);

      if (error) {
        console.error("❌ Error fetching calls:", error);
        return {
          success: false,
          message: error.message,
        };
      }

      // Transform to match ARM dashboard format
      return {
        success: true,
        data: data.map((call) => {
          const triage = Array.isArray(call.triage_reports)
            ? call.triage_reports[0]
            : call.triage_reports;

          // ✅ Gérer cas pas encore de triage (appel vient de démarrer)
          const hasTriage = !!triage;

          // Map P0-P3 to 1-4 priority (P0=1, P1=2, P2=3, P3=4)
          const priorityMap = { P0: 1, P1: 2, P2: 3, P3: 4 };
          const priority =
            hasTriage && triage.priority_classification
              ? priorityMap[triage.priority_classification]
              : 5; // ✅ P5 = "En cours" (pas encore classé)

          // 🆕 Parser données geocoding
          const hospitalData = triage?.nearest_hospital_data || null;
          const location = triage?.patient_location || null;
          const fireStation = triage?.fire_station_data || null;

          return {
            id: call.call_id,
            createdAt: new Date(call.date_heure)
              .toISOString()
              .slice(0, 16)
              .replace("T", " "),
            createdAtRaw: call.date_heure,
            updatedAtRaw: call.updated_at,
            status: call.status || (hasTriage ? "nouveau" : "en_cours"), // ✅ "en_cours" si pas de triage
            priority,
            title: hasTriage
              ? triage.ai_explanation?.substring(0, 60) || "Appel traité"
              : "📞 Appel en cours...", // ✅ Texte par défaut pour appels actifs
            locationLabel: call.location_input_text || "En attente adresse...",
            // ✅ Coordonnées réelles depuis geocoding (fallback Paris si pas dispo)
            lat: location?.lat || 48.8566,
            lng: location?.lng || 2.3522,
            symptoms: [],
            notes: hasTriage
              ? triage.ai_explanation || ""
              : "Collecte informations en cours", // ✅ Notes par défaut
            // 🆕 Infos hôpital/pompiers/ETA
            nearestHospital: hospitalData,
            nearestFireStation: fireStation,
            eta: triage?.estimated_arrival_minutes || null,
            // 🆕 Flag appel actif (pour UI)
            isActive: !hasTriage,
          };
        }),
      };
    } catch (error) {
      console.error("❌ Exception in getAllCalls:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
