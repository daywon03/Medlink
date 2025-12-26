"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lng: number;
  label?: string;
};

function FixMapSize({ mapRef }: { mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;

    // IMPORTANT: si le layout vient juste d’être rendu (cards, modals, etc.)
    // Leaflet calcule parfois une taille 0 -> on invalide après un tick
    const t = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 50);

    return () => {
      window.clearTimeout(t);
      mapRef.current = null;
    };
  }, [map, mapRef]);

  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    // Guard: évite les erreurs quand démonté
    try {
      map.setView([lat, lng], map.getZoom(), { animate: false });
    } catch {}
  }, [lat, lng, map]);
  return null;
}

export default function MapPanel({ lat, lng, label = "Incident" }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);

  // Fix icônes (sinon marker invisible / erreurs)
  useEffect(() => {
    const iconRetinaUrl =
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
    const iconUrl =
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
    const shadowUrl =
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

    const DefaultIcon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    // @ts-ignore
    L.Marker.prototype.options.icon = DefaultIcon;
  }, []);

  const center = useMemo(() => [lat, lng] as [number, number], [lat, lng]);

  return (
    <div style={{ height: 360, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <FixMapSize mapRef={mapRef} />
        <Recenter lat={lat} lng={lng} />

        <TileLayer
          // OSM standard (OK)
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // attribution obligatoire
          attribution="&copy; OpenStreetMap contributors"
        />

        <Marker position={center}>
          <Popup>{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
