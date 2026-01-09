"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import io, { Socket } from "socket.io-client";

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
        const res = await fetch(`/api/public/ride/${token}`, { cache: "no-store" });
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
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";
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
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Medlink • Suivi</div>
          <h1 className="mt-1 text-xl font-semibold">Lien indisponible</h1>
          <p className="mt-3 text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center">
        Chargement…
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Medlink • Suivi</div>
          <h1 className="mt-1 text-xl font-semibold">Suivi expiré</h1>
          <p className="mt-3 text-white/70">Ce lien n’est plus actif.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="armShell">
      {/* Header - ARM style */}
      <header className="armHeader">
        <div className="armHeaderInner">
          <div className="brand">
            <div className="brandIcon">🚑</div>
            <div>
              <div className="muted">Medlink • Suivi</div>
              <div className="title">Votre prise en charge</div>
              <div className="sub">
                <span className="dot" />
                <span>{statusLabel(ride.status)}</span>
                <span className="sep">•</span>
                <span>Ambulance: {ride.ambulance.label}</span>
                <span className="sep">•</span>
                <span className={socketOk ? "text-emerald-400" : "text-orange-400"}>
                  {socketOk ? "En direct" : "Synchronisation…"}
                </span>
              </div>
            </div>
          </div>

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
            Partager 🔗
          </button>
        </div>
      </header>

      <main className="armMain">
        {/* Grid: left (info) + center (details) + right (map) */}
        <section className="grid">
          {/* LEFT: Infos détaillées */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="muted">Statut actuel</div>
                <div className="cardTitle">Progression</div>
              </div>
            </div>

            <div className="cardBody space-y-4">
              {/* ETA + Ambulance */}
              <div>
                <div className="muted text-xs">Ambulance assignée</div>
                <div className="text-lg font-semibold text-white mt-1">{ride.ambulance.label}</div>
              </div>

              {ride.etaMinutes != null && (
                <div className="border-t border-slate-700/30 pt-4">
                  <div className="muted text-xs">Arrivée estimée</div>
                  <div className="text-3xl font-bold text-emerald-400 mt-1">
                    {ride.etaMinutes}
                    <span className="text-sm text-slate-400 ml-2">min</span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t border-slate-700/30 pt-4">
                <div className="muted text-xs mb-3">Progression</div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-emerald-400"></div>
                      <div className="h-6 w-0.5 bg-slate-700 mt-2"></div>
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-emerald-400">Ambulance assignée</p>
                      <p className="text-xs text-slate-500">Maintenant</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                      <div className="h-6 w-0.5 bg-slate-700 mt-2"></div>
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-blue-400">En trajet</p>
                      <p className="text-xs text-slate-500">~{ride.etaMinutes} minutes</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-slate-600"></div>
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-slate-300">Arrivée à l'hôpital</p>
                      <p className="text-xs text-slate-500">À l'arrivée</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Destination card */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="muted">Destination</div>
                <div className="cardTitle">Hôpital</div>
              </div>
            </div>

            <div className="cardBody">
              <h3 className="font-semibold text-white mb-2">{ride.destinationHospital.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{ride.destinationHospital.address}</p>

              <div className="border-t border-slate-700/30 pt-4">
                <div className="muted text-xs mb-3">Lieu de l'appel</div>
                <h4 className="font-semibold text-white mb-1">{ride.incident.label}</h4>
                <p className="text-xs text-slate-500">
                  Mis à jour {new Date(ride.ambulancePos.updatedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Map (full height) */}
          <div className="card" style={{ gridColumn: "span 1", gridRow: "span 2" }}>
            <div className="cardHead">
              <div>
                <div className="muted">Carte</div>
                <div className="cardTitle">Trajectoire ambulance</div>
              </div>
            </div>

            <div className="cardBody p-0" style={{ minHeight: "100%" }}>
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
        </section>

        {/* Footer info */}
        <section className="toolbar" style={{ marginTop: "2rem" }}>
          <div className="text-center text-xs text-slate-400">
            <p>Votre localisation exacte est partagée avec l'ambulance.</p>
            <p>Elle arrivera dès que possible.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
