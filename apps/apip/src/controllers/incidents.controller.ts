import { Controller, Get } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

type IncidentStatus = "nouveau" | "en_cours" | "clos";

@Controller("api/incidents")
export class IncidentsController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get("closed")
  async getClosedIncidents() {
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
        .in("status", ["clos", "closed", "termine", "terminé"]);

      if (error) {
        console.error(" Error fetching incidents:", error);
        return { success: false, message: error.message };
      }

      const mapped = (data || []).map((row: any) => this.mapIncident(row));
      return { success: true, data: mapped };
    } catch (error) {
      console.error(" Exception in getClosedIncidents:", error);
      return { success: false, message: (error as Error).message };
    }
  }

  private mapIncident(row: any) {
    const triage = Array.isArray(row.triage_reports)
      ? row.triage_reports[0]
      : row.triage_reports;

    const id =
      row.id ??
      row.incident_id ??
      row.call_id ??
      row.uuid ??
      row.token ??
      row.reference ??
      String(row.numero ?? "");

    const createdAtRaw =
      row.created_at ??
      row.createdAt ??
      row.date_heure ??
      row.date ??
      row.closed_at ??
      row.updated_at;

    const createdAt = createdAtRaw
      ? new Date(createdAtRaw).toISOString().slice(0, 16).replace("T", " ")
      : new Date().toISOString().slice(0, 16).replace("T", " ");

    const statusRaw = String(
      row.status ?? row.state ?? row.etat ?? "clos",
    ).toLowerCase();
    const status: IncidentStatus =
      statusRaw.includes("clos") ||
      statusRaw.includes("closed") ||
      statusRaw.includes("termin")
        ? "clos"
        : statusRaw.includes("en_cours") || statusRaw.includes("en cours")
          ? "en_cours"
          : "nouveau";

    const priority = this.parsePriority(
      row.priority ??
        row.priorite ??
        row.severity ??
        row.priority_classification ??
        triage?.priority_classification,
    );

    const title =
      row.title ??
      row.summary ??
      row.ai_explanation ??
      triage?.ai_explanation ??
      row.description ??
      "Incident clos";

    const locationLabel =
      row.location_label ??
      row.locationLabel ??
      row.location_input_text ??
      row.address ??
      row.lieu ??
      "Lieu inconnu";

    const location = this.parseMaybeJson(
      row.patient_location ??
        row.location ??
        row.position ??
        triage?.patient_location,
    );
    const lat =
      row.lat ?? row.latitude ?? row.location_lat ?? location?.lat ?? 48.8566;
    const lng =
      row.lng ?? row.longitude ?? row.location_lng ?? location?.lng ?? 2.3522;

    const symptoms = this.parseSymptoms(
      row.symptoms ?? row.symptom_list ?? row.symptomes,
    );

    const notes =
      row.notes ??
      row.operator_notes ??
      row.ai_explanation ??
      triage?.ai_explanation ??
      undefined;

    return {
      id,
      createdAt,
      createdAtRaw:
        row.date_heure ??
        row.created_at ??
        row.createdAt ??
        row.date ??
        undefined,
      updatedAtRaw:
        row.updated_at ?? row.updatedAt ?? row.closed_at ?? undefined,
      status,
      priority,
      title,
      locationLabel,
      lat: Number(lat),
      lng: Number(lng),
      symptoms,
      notes,
    };
  }

  private parsePriority(value: any): 1 | 2 | 3 | 4 | 5 {
    if (value == null) return 3;
    if (typeof value === "number" && value >= 1 && value <= 5)
      return value as 1 | 2 | 3 | 4 | 5;
    const str = String(value).toUpperCase();
    const map: Record<string, 1 | 2 | 3 | 4 | 5> = {
      P0: 1,
      P1: 2,
      P2: 3,
      P3: 4,
      P4: 5,
      P5: 5,
    };
    return map[str] ?? 3;
  }

  private parseSymptoms(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string") {
      const parsed = this.parseMaybeJson(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  private parseMaybeJson(value: any) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
