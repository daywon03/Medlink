import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function parseHospitalData(value: unknown) {
  if (!value) return null;
  const parsed = typeof value === "string" ? safeJsonParse(value) : value;
  if (!parsed || typeof parsed !== "object") return null;
  const hospital = parsed as { name?: string; address?: string; lat?: number; lng?: number };
  if (!hospital.name) return null;
  const lat = Number(hospital.lat);
  const lng = Number(hospital.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { ...hospital, lat, lng };
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token || token.length < 3) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  try {
    // Same implementation as public/[token]/route.ts
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select(`
        call_id,
        extracted_address,
        triage_reports (
          nearest_hospital_data,
          estimated_arrival_minutes
        )
      `)
      .eq("call_id", token)
      .single();

    if (callError || !call) {
      // Fallback to mock data
      return NextResponse.json({
        token,
        status: "en_route",
        ambulance: { label: "AMB-12" },
        destinationHospital: {
          name: "Hôpital Européen Georges-Pompidou",
          address: "20 Rue Leblanc, 75015 Paris",
          lat: 48.8386,
          lng: 2.2730,
        },
        incident: { label: "Paris 15e", lat: 48.8414, lng: 2.3007 },
        ambulancePos: { lat: 48.834, lng: 2.287, updatedAt: new Date().toISOString() },
        etaMinutes: 7,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });
    }

    const triageReport = call.triage_reports?.[0];
    const hospitalData = parseHospitalData(triageReport?.nearest_hospital_data);

    return NextResponse.json({
      token,
      status: "en_route",
      ambulance: { label: "AMB-12" },
      destinationHospital: hospitalData || {
        name: "Hôpital le plus proche",
        address: "En cours de localisation",
        lat: 48.8566,
        lng: 2.3522
      },
      incident: {
        label: call.extracted_address || "Localisation inconnue",
        lat: 48.8566,
        lng: 2.3522
      },
      ambulancePos: {
        lat: 48.8566,
        lng: 2.3522,
        updatedAt: new Date().toISOString()
      },
      etaMinutes: triageReport?.estimated_arrival_minutes || 7,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Error fetching ride data:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
