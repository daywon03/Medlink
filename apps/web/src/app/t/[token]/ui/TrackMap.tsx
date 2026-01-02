"use client";

import { useEffect, useMemo, useRef } from "react";
import L, { type LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

type Pt = { lat: number; lng: number; label: string };
type Pos = { lat: number; lng: number };

// Create custom emoji icons
function createEmojiIcon(emoji: string, label: string) {
  return L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: rgba(59, 130, 246, 0.95);
        border: 2px solid #fff;
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        transition: transform 0.2s ease;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    className: "emoji-icon",
  });
}

export default function TrackMap({
  ambulance,
  incident,
  hospital,
}: {
  ambulance: Pos;
  incident: Pt;
  hospital: Pt;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const ambMarkerRef = useRef<L.Marker | null>(null);

  const center = useMemo(() => [ambulance.lat, ambulance.lng] as LatLngTuple, [ambulance]);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map("track-map", {
      zoomControl: false,
      attributionControl: true,
    }).setView(center, 13);

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Custom emoji icons
    const ambulanceIcon = createEmojiIcon("🚑", "Ambulance");
    const hospitalIcon = createEmojiIcon("🏥", "Hôpital");
    const incidentIcon = createEmojiIcon("📍", "Lieu de l'incident");

    // markers
    const incidentMarker = L.marker([incident.lat, incident.lng], { icon: incidentIcon })
      .addTo(map)
      .bindPopup(`<div style="text-align: center;"><strong>📍 ${incident.label}</strong></div>`);

    const hospitalMarker = L.marker([hospital.lat, hospital.lng], { icon: hospitalIcon })
      .addTo(map)
      .bindPopup(`<div style="text-align: center;"><strong>🏥 ${hospital.label}</strong></div>`);

    const ambMarker = L.marker([ambulance.lat, ambulance.lng], { icon: ambulanceIcon })
      .addTo(map)
      .bindPopup(`<div style="text-align: center;"><strong>🚑 Ambulance</strong></div>`);
    ambMarkerRef.current = ambMarker;

    // fit bounds
    const bounds = L.latLngBounds([
      [incident.lat, incident.lng],
      [hospital.lat, hospital.lng],
      [ambulance.lat, ambulance.lng],
    ]);
    map.fitBounds(bounds.pad(0.25));

    // fix sizing after mount (Next layout)
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update ambulance marker position live
  useEffect(() => {
    if (!mapRef.current || !ambMarkerRef.current) return;
    ambMarkerRef.current.setLatLng([ambulance.lat, ambulance.lng]);
  }, [ambulance.lat, ambulance.lng]);

  return <div id="track-map" style={{ width: "100%", height: "100%" }} />;
}
