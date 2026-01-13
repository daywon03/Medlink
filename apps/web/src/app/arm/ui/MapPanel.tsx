"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createInfoWindowContent, createPinIcon, loadGoogleMaps } from "../../../../lib/googleMaps";

type Props = {
  lat: number;
  lng: number;
  address?: string;
  label?: string;
};

export default function MapPanel({ lat, lng, address, label = "Incident" }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const infoRef = useRef<any>(null);
  const [error, setError] = useState<string>("");

  const [resolvedCenter, setResolvedCenter] = useState(() => ({ lat, lng }));
  const center = useMemo(() => resolvedCenter, [resolvedCenter]);
  const addressText = useMemo(() => address?.trim() ?? "", [address]);

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

        if (!markerRef.current) {
          markerRef.current = new maps.Marker({
            position: center,
            map: mapRef.current,
            title: label,
            icon: createPinIcon(maps, "#ef4444"),
          });

          infoRef.current = new maps.InfoWindow({
            content: createInfoWindowContent(label),
          });

          markerRef.current.addListener("click", () => {
            infoRef.current.open({ anchor: markerRef.current, map: mapRef.current });
          });
        }

        markerRef.current.setTitle(label);
        if (infoRef.current) {
          infoRef.current.setContent(createInfoWindowContent(label));
        }

        mapRef.current.setCenter(center);
        markerRef.current.setPosition(center);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Impossible de charger Google Maps.");
      });

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (infoRef.current) {
        infoRef.current.close();
        infoRef.current = null;
      }
    };
  }, [apiKey, center, label]);

  useEffect(() => {
    setResolvedCenter({ lat, lng });
  }, [lat, lng]);

  useEffect(() => {
    if (!addressText || !apiKey) return () => {};
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        const maps = window.google.maps;
        const geocoder = new maps.Geocoder();
        geocoder.geocode({ address: addressText }, (results: any, status: string) => {
          if (cancelled) return;
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            setResolvedCenter({ lat: loc.lat(), lng: loc.lng() });
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [addressText, apiKey]);

  return (
    <div style={{ height: 360, width: "100%" }}>
      {error ? (
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
      ) : (
        <div ref={mapElRef} style={{ height: "100%", width: "100%" }} />
      )}
    </div>
  );
}
