"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createInfoWindowContent, createPinIcon, loadGoogleMaps } from "../../../../../lib/googleMaps";

type Pt = { lat: number; lng: number; label: string };
type Pos = { lat: number; lng: number };

export default function TrackMap({
  ambulance,
  incident,
  hospital,
}: {
  ambulance: Pos;
  incident: Pt;
  hospital: Pt;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const ambMarkerRef = useRef<any>(null);
  const incidentMarkerRef = useRef<any>(null);
  const hospitalMarkerRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const [error, setError] = useState<string>("");

  const center = useMemo(() => ({ lat: ambulance.lat, lng: ambulance.lng }), [ambulance.lat, ambulance.lng]);

  useEffect(() => {
    let cancelled = false;

    if (!apiKey) {
      setError("Cle Google Maps manquante.");
      return () => {};
    }

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapElRef.current) return;

        const maps = window.google.maps;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapElRef.current, {
            center,
            zoom: 13,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            clickableIcons: false,
          });
        }

        if (!incidentMarkerRef.current) {
          incidentMarkerRef.current = new maps.Marker({
            position: { lat: incident.lat, lng: incident.lng },
            map: mapRef.current,
            title: incident.label,
            icon: createPinIcon(maps, "#ef4444"),
            zIndex: 100
          });
          const info = new maps.InfoWindow({ content: createInfoWindowContent(` ${incident.label}`) });
          incidentMarkerRef.current.addListener("click", () => info.open({ anchor: incidentMarkerRef.current, map: mapRef.current }));
        }

        if (!hospitalMarkerRef.current) {
          hospitalMarkerRef.current = new maps.Marker({
            position: { lat: hospital.lat, lng: hospital.lng },
            map: mapRef.current,
            title: hospital.label,
            icon: createPinIcon(maps, "#3b82f6"),
          });
          const info = new maps.InfoWindow({ content: createInfoWindowContent(` ${hospital.label}`) });
          hospitalMarkerRef.current.addListener("click", () => info.open({ anchor: hospitalMarkerRef.current, map: mapRef.current }));
        }

        if (!ambMarkerRef.current) {
          ambMarkerRef.current = new maps.Marker({
            position: { lat: ambulance.lat, lng: ambulance.lng },
            map: mapRef.current,
            title: "Ambulance",
            icon: createPinIcon(maps, "#22c55e"),
          });
        }

        if (!directionsServiceRef.current) {
          directionsServiceRef.current = new maps.DirectionsService();
        }
        if (!directionsRendererRef.current) {
          directionsRendererRef.current = new maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: false,
            polylineOptions: {
              strokeColor: "#1c4bb6",
              strokeOpacity: 0.65,
              strokeWeight: 4,
            },
          });
          directionsRendererRef.current.setMap(mapRef.current);
        }

        const bounds = new maps.LatLngBounds();
        bounds.extend(new maps.LatLng(incident.lat, incident.lng));
        bounds.extend(new maps.LatLng(hospital.lat, hospital.lng));
        bounds.extend(new maps.LatLng(ambulance.lat, ambulance.lng));
        mapRef.current.fitBounds(bounds, 60);

        directionsServiceRef.current.route(
          {
            origin: { lat: ambulance.lat, lng: ambulance.lng },
            destination: { lat: hospital.lat, lng: hospital.lng },
            waypoints: [{ location: { lat: incident.lat, lng: incident.lng }, stopover: false }],
            travelMode: maps.TravelMode.DRIVING,
          },
          (result: any, status: string) => {
            if (status === maps.DirectionsStatus.OK && directionsRendererRef.current) {
              directionsRendererRef.current.setDirections(result);
            }
          }
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Impossible de charger Google Maps.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update ambulance marker position live
  useEffect(() => {
    if (!mapRef.current || !ambMarkerRef.current) return;
    ambMarkerRef.current.setPosition({ lat: ambulance.lat, lng: ambulance.lng });
  }, [ambulance.lat, ambulance.lng]);

  // update markers
  useEffect(() => {
    if (!mapRef.current || !incidentMarkerRef.current || !hospitalMarkerRef.current) return;

    const isDefaultParis = (Math.abs(incident.lat - 48.8566) < 0.0001 && Math.abs(incident.lng - 2.3522) < 0.0001);

    if (isDefaultParis && incident.label && !incident.label.includes("Paris") && window.google) {
      //  Client-side fallback: Geocode address if backend sent default Paris
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: incident.label }, (results: any, status: string) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          incidentMarkerRef.current.setPosition(loc);
          // Also update route if needed
          if (directionsServiceRef.current && directionsRendererRef.current) {
             // Re-calc route with new point
             // For now just update marker to visually correct it
          }
        } else {
          // Fallback failed, keep props
          incidentMarkerRef.current.setPosition({ lat: incident.lat, lng: incident.lng });
        }
      });
    } else {
       incidentMarkerRef.current.setPosition({ lat: incident.lat, lng: incident.lng });
    }

    hospitalMarkerRef.current.setPosition({ lat: hospital.lat, lng: hospital.lng });
  }, [incident.lat, incident.lng, incident.label, hospital.lat, hospital.lng]);

  useEffect(() => {
    if (!directionsServiceRef.current || !directionsRendererRef.current || !mapRef.current) return;
    const maps = window.google.maps;
    directionsServiceRef.current.route(
      {
        origin: { lat: ambulance.lat, lng: ambulance.lng },
        destination: { lat: hospital.lat, lng: hospital.lng },
        waypoints: [{ location: { lat: incident.lat, lng: incident.lng }, stopover: false }],
        travelMode: maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === maps.DirectionsStatus.OK && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        }
      }
    );
  }, [ambulance.lat, ambulance.lng, incident.lat, incident.lng, hospital.lat, hospital.lng]);

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,0.7)",
          borderRadius: "16px",
          background: "rgba(0,0,0,0.2)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {error}
      </div>
    );
  }

  return <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />;
}
