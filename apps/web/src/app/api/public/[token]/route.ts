import { NextResponse, type NextRequest } from "next/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // TODO: remplacer par DB
  if (!token || token.length < 10) {
    return NextResponse.json({ error: "invalid" }, { status: 404 });
  }

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
