"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import io, { Socket } from "socket.io-client";
import ArmStyles from "../arm/ui/ArmStyles";
import MedlinkLayout from "../ui/MedlinkLayout";

type RideStatus = "assigned" | "en_route" | "on_scene" | "transport" | "arrived";

type PublicRide = {
  token: string;
  status: RideStatus;
  ambulance: { label: string };
  destinationHospital: { name: string; address: string; lat: number; lng: number };
  incident: { label: string; lat: number; lng: number };
  ambulancePos: { lat: number; lng: number; updatedAt: string };
  etaMinutes?: number;
  expiresAt: string;
};

const TrackMap = dynamic(() => import("./[token]/ui/TrackMap"), { ssr: false });

function statusLabel(s: RideStatus) {
  switch (s) {
    case "assigned":
      return "Assignée";
    case "en_route":
      return "En route";
    case "on_scene":
      return "Sur place";
    case "transport":
      return "Transport vers l’hôpital";
    case "arrived":
      return "Arrivée";
  }
}

export default function TrackingClient({ token }: { token: string }) {
  const [ride, setRide] = useState<PublicRide | null>(null);
  const [socketOk, setSocketOk] = useState(false);
  const [error, setError] = useState<string>("");

  // initial fetch
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError("");
        const NEXT_PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/^ws/, 'http');
        const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/public/ride/${token}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Lien invalide ou expiré.");
        const data = (await res.json()) as PublicRide;
        if (!cancelled) setRide(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // socket live updates (NE PAS dépendre de ride)
  useEffect(() => {
    let s: Socket | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        if (cancelled) return;

        // Connect directly to NestJS backend
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
        s = io(wsUrl);

        s.on("connect", () => setSocketOk(true));
        s.on("disconnect", () => setSocketOk(false));

        // Request latest state from ARM when connected (in case we missed prior emits)
        s.on("connect", () => {
          try {
            s?.emit("tracking:request", { token });
          } catch (e) {
            // ignore
          }
        });

        s.on("ride:update", (evt: any) => {
          if (evt?.token !== token) return;

          setRide((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ambulance: evt.ambulance ?? prev.ambulance,
              destinationHospital: evt.destinationHospital ?? prev.destinationHospital,
              incident: evt.incident ?? prev.incident,
              ambulancePos: evt.ambulancePos ?? prev.ambulancePos,
              etaMinutes: evt.etaMinutes ?? prev.etaMinutes,
              expiresAt: evt.expiresAt ?? prev.expiresAt,
              status: evt.status ?? prev.status,
            };
          });
          setError(""); //  Clear error if socket recovers the data
        });

        // Listen for assignments from ARM console and map to PublicRide
        s.on("tracking:assign", (evt: any) => {
          if (evt?.token !== token) return;

          const mapped: PublicRide = {
            token: evt.token,
            status: (evt.status as RideStatus) ?? "assigned",
            ambulance: evt.ambulance ?? { label: "AMB-?" },
            destinationHospital: evt.destinationHospital
              ? {
                  name: evt.destinationHospital.name ?? "—",
                  address: evt.destinationHospital.address ?? "",
                  lat: evt.destinationHospital.lat ?? 0,
                  lng: evt.destinationHospital.lng ?? 0,
                }
              : { name: "—", address: "", lat: 0, lng: 0 },
            incident: evt.incident
              ? { label: evt.incident.label ?? "—", lat: evt.incident.lat ?? 0, lng: evt.incident.lng ?? 0 }
              : { label: "—", lat: 0, lng: 0 },
            ambulancePos: evt.ambulancePos
              ? { lat: evt.ambulancePos.lat ?? 0, lng: evt.ambulancePos.lng ?? 0, updatedAt: evt.ambulancePos.updatedAt ?? new Date().toISOString() }
              : { lat: evt.incident?.lat ?? 0, lng: evt.incident?.lng ?? 0, updatedAt: new Date().toISOString() },
            etaMinutes: evt.etaMinutes ?? undefined,
            expiresAt: evt.expiresAt ?? new Date(Date.now() + 30 * 60000).toISOString(),
          };

          // debug
          // eslint-disable-next-line no-console
          console.log("[tracking:assign] received:", evt, "mapped:", mapped);

          setRide((prev) => ({ ...(prev ?? {}), ...mapped } as PublicRide));
          setError(""); //  Clear error if socket recovers the data
        });
      } catch (e) {
        console.error("socket init error", e);
        setSocketOk(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      s?.disconnect();
    };
  }, [token]);

  const expired = useMemo(() => {
    if (!ride) return false;
    return new Date(ride.expiresAt).getTime() < Date.now();
  }, [ride]);

  if (error) {
    return (
      <div className="medCentered">
        <div className="medMessageCard">
          <div className="muted">MedLink • Suivi</div>
          <div className="medMessageTitle">Lien indisponible</div>
          <div className="medMessageText">{error}</div>
        </div>
        <ArmStyles />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="medCentered">
        <div className="medMessageCard">
          <div className="medMessageTitle">Chargement…</div>
        </div>
        <ArmStyles />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="medCentered">
        <div className="medMessageCard">
          <div className="muted">MedLink • Suivi</div>
          <div className="medMessageTitle">Suivi expiré</div>
          <div className="medMessageText">Ce lien n’est plus actif.</div>
        </div>
        <ArmStyles />
      </div>
    );
  }

  return (
    <MedlinkLayout
      title="Votre prise en charge"
      subtitle={`${statusLabel(ride.status)} • Ambulance ${ride.ambulance.label} • ${socketOk ? "En direct" : "Synchronisation…"}`}
      hideSidebar
      actions={
        <>
          <button
            className="btn btnGhost"
            onClick={async () => {
              const url = window.location.href;
              // @ts-ignore
              if (navigator.share) {
                // @ts-ignore
                await navigator.share({ title: "Suivi ambulance", url });
              } else {
                await navigator.clipboard.writeText(url);
                alert("Lien copié !");
              }
            }}
          >
            Partager 
          </button>
          <div className="medAvatar" />
        </>
      }
    >
      <div className="medCenteredContent trackShell">
        <div className="trackHero">
          <div>
            <div className="muted">Suivi en temps réel</div>
            <div className="cardTitle">Ambulance {ride.ambulance.label}</div>
          </div>
          <div className="trackStatus">{statusLabel(ride.status)}</div>
        </div>

        <div className="card trackMapCard">
          <div className="trackMapWrap">
            <TrackMap
              ambulance={ride.ambulancePos}
              incident={{ lat: ride.incident.lat, lng: ride.incident.lng, label: ride.incident.label }}
              hospital={{
                lat: ride.destinationHospital.lat,
                lng: ride.destinationHospital.lng,
                label: ride.destinationHospital.name,
              }}
            />
          </div>
        </div>

        <div className="card trackSheet">
          <div className="trackDriver">
            <div className="trackDriverAvatar"></div>
            <div>
              <div className="muted small">Équipe en route</div>
              <div className="strong">{ride.ambulance.label}</div>
              <div className="muted small">Centre d’opérations MedLink</div>
            </div>
            <button className="btn btnGhost">Appeler</button>
          </div>

          <div className="trackStatRow">
            <div>
              <div className="muted small">Arrivée estimée</div>
              <div className="trackEta">{ride.etaMinutes != null ? `${ride.etaMinutes} min` : "—"}</div>
            </div>
            <div>
              <div className="muted small">Dernière mise à jour</div>
              <div className="strong">{new Date(ride.ambulancePos.updatedAt).toLocaleTimeString()}</div>
            </div>
          </div>

          <div className="dividerTop">
            <div className="muted small">Destination</div>
            <div className="strong">{ride.destinationHospital.name}</div>
            <div className="muted small">{ride.destinationHospital.address}</div>
          </div>

          <div className="dividerTop">
            <div className="muted small">Lieu de l'appel</div>
            <div className="strong">{ride.incident.label}</div>
          </div>
        </div>

        <div className="medFooterNote">
          Votre localisation exacte est partagée avec l'ambulance. Elle arrivera dès que possible.
        </div>
      </div>

    </MedlinkLayout>
  );
}
