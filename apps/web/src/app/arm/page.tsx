"use client";

import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import io, { Socket } from "socket.io-client";
import MedlinkLayout from "../ui/MedlinkLayout";
import { jsPDF } from "jspdf";

type IncidentStatus = "nouveau" | "en_cours" | "clos";
type Hospital = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  distance?: number;
  id?: string;
  type?: string;
};

type Incident = {
  id: string;
  createdAt: string;
  createdAtRaw?: string;
  updatedAtRaw?: string;
  status: IncidentStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  locationLabel: string;
  lat: number;
  lng: number;
  symptoms: string[];
  notes?: string;
  nearestHospital?: Hospital | null;
  eta?: number | null;
};

const MapPanel = dynamic(() => import("./ui/MapPanel"), { ssr: false });
const TriageList = dynamic(() => import("./TriageList"), { ssr: false });

const PAGE_SIZE = 8;

function statusLabel(s: IncidentStatus) {
  if (s === "nouveau") return "Nouveau";
  if (s === "en_cours") return "En cours";
  return "Clos";
}

function statusClass(s: IncidentStatus) {
  if (s === "nouveau") return "badge badgeStatusNew";
  if (s === "en_cours") return "badge badgeStatusProgress";
  return "badge badgeStatusClosed";
}

function priorityClass(p: number) {
  if (p <= 2) return "badge badgePrioHigh";
  if (p === 3) return "badge badgePrioMed";
  return "badge badgePrioLow";
}

function normalizeHospital(value: unknown): Hospital | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return normalizeHospital(JSON.parse(value));
    } catch {
      return null;
    }
  }
  const hospital = value as Partial<Hospital>;
  if (!hospital.name) return null;
  const lat = Number(hospital.lat);
  const lng = Number(hospital.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    name: hospital.name,
    address: hospital.address,
    lat,
    lng,
    distance: hospital.distance,
    id: hospital.id,
    type: hospital.type,
  };
}

function buildHospitalMessage(incident: Incident, hospital: Hospital | null) {
  if (!hospital) return "";
  const eta = incident.eta != null ? ` ETA estimée ${incident.eta} min.` : "";
  return `Signalement arrivée patient depuis ${incident.locationLabel}. Destination: ${hospital.name}.${eta}`;
}

/** Modal simple (sans lib) */
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modalRoot" role="dialog" aria-modal="true">
      <button className="modalBackdrop" onClick={onClose} aria-label="Fermer la modale" />
      <div className="modalCard">
        <div className="modalHeader">
          <div>
            <div className="muted">Action</div>
            <h3 className="modalTitle">{title}</h3>
          </div>
          <button className="btn btnGhost" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

export default function ArmPage() {
  const [socket, setSocket] = useState<Socket | null>(null);

  // data
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [closedIncidents, setClosedIncidents] = useState<Incident[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const incidentsRef = useRef<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const selectedIdRef = useRef<string>("");
  const allIncidents = useMemo(() => {
    const map = new Map<string, Incident>();
    incidents.forEach((i) => map.set(i.id, i));
    closedIncidents.forEach((i) => map.set(i.id, i));
    return Array.from(map.values());
  }, [incidents, closedIncidents]);

  const selected = allIncidents.find((i: Incident) => i.id === selectedId) ?? allIncidents[0];
  const selectedHospital = useMemo(
    () => normalizeHospital(selected?.nearestHospital),
    [selected?.nearestHospital]
  );

  function mapPriorityToLabel(priority: number): "P0" | "P1" | "P2" | "P3" {
    if (priority <= 1) return "P0";
    if (priority === 2) return "P1";
    if (priority === 3) return "P2";
    return "P3";
  }

  async function fetchNearestHospital(incident: Incident) {
    setHospitalLoading(true);
    setHospitalError("");
    setHospitalResult(null);
    setHospitalEta(null);
    setHospitalSaved(false);
    try {
      const res = await fetch("http://localhost:3001/api/hospitals/nearest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: incident.locationLabel,
          lat: incident.lat,
          lng: incident.lng,
          priority: mapPriorityToLabel(incident.priority),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Aucun hôpital trouvé");
      }
      const hospital = normalizeHospital(json.nearestHospital);
      if (!hospital) {
        throw new Error("Données hôpital invalides");
      }
      setHospitalResult(hospital);
      setHospitalEta(typeof json.eta === "number" ? json.eta : null);
    } catch (err: any) {
      setHospitalError(err?.message ?? "Erreur de recherche d’hôpital");
    } finally {
      setHospitalLoading(false);
    }
  }

  function extractAssignedTeam(notes: string | undefined) {
    if (!notes) return "AMB-?";
    const match = notes.match(/Assigné:\s*([A-Z0-9-]+)/i);
    return match ? match[1] : "AMB-?";
  }

  async function applyHospitalAssignment(incident: Incident, hospital: Hospital, eta: number | null) {
    const noteSuffix = `\n🏥 Hôpital assigné: ${hospital.name}`;
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? {
              ...i,
              nearestHospital: hospital,
              eta: eta ?? i.eta ?? null,
              notes: `${i.notes ?? ""}${noteSuffix}`,
            }
          : i
      )
    );
    incidentsRef.current = incidentsRef.current.map((i) =>
      i.id === incident.id
        ? {
            ...i,
            nearestHospital: hospital,
            eta: eta ?? i.eta ?? null,
            notes: `${i.notes ?? ""}${noteSuffix}`,
          }
        : i
    );

    emitAction("notify_hospital", {
      incidentId: incident.id,
      hospital: {
        name: hospital.name,
        address: hospital.address,
        lat: hospital.lat,
        lng: hospital.lng,
      },
      message: buildHospitalMessage(incident, hospital),
      etaMinutes: eta ?? undefined,
    });

    try {
      const res = await fetch(`http://localhost:3001/api/triage/${incident.id}/hospital`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospital,
          etaMinutes: eta ?? undefined,
        }),
      });
      if (!res.ok) {
        throw new Error("persist_failed");
      }
      setHospitalSaved(true);
    } catch {
      setHospitalSaved(false);
    }

    socket?.emit("tracking:assign", {
      token: incident.id,
      status: "assigned",
      ambulance: { label: extractAssignedTeam(incident.notes) },
      incident: { label: incident.locationLabel, lat: incident.lat, lng: incident.lng },
      destinationHospital: {
        name: hospital.name,
        address: hospital.address ?? "",
        lat: hospital.lat,
        lng: hospital.lng,
      },
      ambulancePos: { lat: incident.lat, lng: incident.lng, updatedAt: new Date().toISOString() },
      etaMinutes: eta ?? undefined,
      expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
    });
  }

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "tous">("tous");

  // pagination
  const [page, setPage] = useState(1);

  // modals
  const [openAssign, setOpenAssign] = useState(false);
  const [openAssignHospital, setOpenAssignHospital] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openNotify, setOpenNotify] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openAssist, setOpenAssist] = useState(false);

  // form states
  const [assignTeam, setAssignTeam] = useState("AMB-12");
  const [editNotes, setEditNotes] = useState(selected?.notes ?? "");
  const [notifyMsg, setNotifyMsg] = useState("Une équipe est en cours d’assignation. Restez joignable.");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [victimPhone, setVictimPhone] = useState("");
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [hospitalError, setHospitalError] = useState("");
  const [hospitalResult, setHospitalResult] = useState<Hospital | null>(null);
  const [hospitalEta, setHospitalEta] = useState<number | null>(null);
  const [hospitalSaved, setHospitalSaved] = useState(false);
  useEffect(() => {
    setEditNotes(selected?.notes ?? "");
    incidentsRef.current = incidents;
    selectedIdRef.current = selectedId; // Sync ref with state
    setHospitalError("");
    setHospitalResult(null);
    setHospitalEta(null);
    setHospitalSaved(false);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Socket init */
  useEffect(() => {
    let s: Socket | null = null;
    let cancelled = false;

    (async () => {
      if (cancelled) return;

      // Connect directly to NestJS backend
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";
      s = io(wsUrl);

      s.on("connect", () => console.log("socket connected", s?.id));
      s.on("arm:connected", (p) => console.log("arm:connected", p));
      s.on("incident:update", (evt) => console.log("incident:update", evt));

      // Respond to tracking clients requesting current state
      s.on("tracking:request", (evt: any) => {
        try {
          if (!evt?.token) return;
          const found = incidentsRef.current.find((i: Incident) => i.id === evt.token);
          if (!found) return;

          // extract last assigned team from notes if present
          const notes = found.notes ?? "";
          const m = notes.match(/Assigné:\s*([A-Z0-9-]+)/i);
          const team = m ? m[1] : "AMB-?";
          const hospital = normalizeHospital(found.nearestHospital);
          const etaMinutes = typeof found.eta === "number" ? found.eta : undefined;

          const payload: Record<string, unknown> = {
            token: found.id,
            status: "assigned",
            ambulance: { label: team },
            incident: { label: found.locationLabel, lat: found.lat, lng: found.lng },
            ambulancePos: { lat: found.lat, lng: found.lng, updatedAt: new Date().toISOString() },
            expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
          };

          if (hospital) {
            payload.destinationHospital = {
              name: hospital.name,
              address: hospital.address ?? "",
              lat: hospital.lat,
              lng: hospital.lng,
            };
          }
          if (etaMinutes != null) {
            payload.etaMinutes = etaMinutes;
          }

          s?.emit("tracking:assign", payload);
        } catch (e) {
          console.error("tracking:request handler error", e);
        }
      });

      // 🆕 Écouter updates appels temps réel
      s.on('call:update', (data: any) => {
        console.log('📡 Call update received:', data);

        setIncidents(prev => {
          const index = prev.findIndex(i => i.id === data.callId);

          if (index !== -1) {
            // Update appel existant
            const updated = [...prev];
            const priorityMap: Record<string, 1 | 2 | 3 | 4 | 5> = { 'P0': 1, 'P1': 2, 'P2': 3, 'P3': 4, 'P5': 5 };

            updated[index] = {
              ...updated[index],
              title: data.summary?.substring(0, 60) || updated[index].title,
              priority: data.priority ? (priorityMap[data.priority] ?? updated[index].priority) : updated[index].priority,
              notes: data.summary || updated[index].notes,
              status: data.isPartial ? 'en_cours' : 'nouveau'
            };

            return updated;
          } else {
            // Nouvel appel pas encore dans la liste - re-fetch
            console.log('New call detected, refreshing list...');
            fetchCalls();
            return prev;
          }
        });
      });

      // 🆕 Écouter mises à jour géolocalisation (recherche async background)
      s.on('call:geolocation', (data: any) => {
        console.log('📍 Geolocation update received:', data);

        setIncidents(prev => {
          const index = prev.findIndex(i => i.id === data.callId);

          if (index !== -1) {
            const updated = [...prev];

            // Mettre à jour avec données geocoding
            updated[index] = {
              ...updated[index],
              lat: data.patientLocation?.lat || updated[index].lat,
              lng: data.patientLocation?.lng || updated[index].lng,
              locationLabel: data.patientLocation?.address || updated[index].locationLabel,
              nearestHospital: normalizeHospital(data.nearestHospital) ?? updated[index].nearestHospital,
              eta: data.eta ?? updated[index].eta,
              // Sauvegarder infos supplémentaires dans notes si hôpital trouvé
              notes: data.nearestHospital
                ? `${updated[index].notes || ''}\n🏥 Hôpital: ${data.nearestHospital.name} (ETA: ${data.eta || '?'}min)`
                : updated[index].notes
            };

            console.log(`✅ Updated incident ${data.callId} with geolocation`);
            return updated;
          }

          return prev;
        });
      });

      setSocket(s);
    })();

    return () => {
      cancelled = true;
      if (s) {
        s.removeAllListeners();
        s.disconnect();
      }
    };
  }, []);

  /** Fetch real calls from API */
  const fetchCalls = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/calls');
      const json = await res.json();

      if (json.success && json.data) {
        const mapped = json.data.map((call: any) => ({
          ...call,
          nearestHospital: normalizeHospital(call.nearestHospital),
          eta: typeof call.eta === "number" ? call.eta : call.eta != null ? Number(call.eta) : null,
        }));
        setIncidents(mapped);
        incidentsRef.current = mapped;
        // Auto-select first if none selected (use ref to avoid closure issue)
        if (!selectedIdRef.current && mapped.length > 0) {
          setSelectedId(mapped[0].id);
          selectedIdRef.current = mapped[0].id;
        }
      }
    } catch (err) {
      console.error('Failed to fetch calls:', err);
      // Keep empty incidents on error
    }
  };

  useEffect(() => {
    fetchCalls();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchCalls, 10000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchClosedIncidents(opts?: { silent?: boolean }) {
    if (!opts?.silent) setClosedLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/incidents/closed');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setClosedIncidents(json.data);
        return json.data as Incident[];
      }
    } catch (err) {
      console.error('Failed to fetch closed incidents:', err);
    } finally {
      if (!opts?.silent) setClosedLoading(false);
    }
    setClosedIncidents([]);
    return [];
  }

  useEffect(() => {
    fetchClosedIncidents({ silent: true });
    const interval = setInterval(() => fetchClosedIncidents({ silent: true }), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!openHistory) return;
    fetchClosedIncidents();
    const interval = setInterval(fetchClosedIncidents, 10000);
    return () => clearInterval(interval);
  }, [openHistory]);



  /** Filter + paginate */
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return allIncidents.filter((i) => {
      const okStatus = status === "tous" ? true : i.status === status;
      const hay = `${i.id} ${i.title} ${i.locationLabel} ${i.symptoms.join(" ")} ${i.notes ?? ""}`.toLowerCase();
      const okQ = qq ? hay.includes(qq) : true;
      return okStatus && okQ;
    });
  }, [allIncidents, q, status]);

  const slaMinutes = useMemo(() => {
    const samples = closedIncidents
      .map((i) => {
        const start = i.createdAtRaw ?? i.createdAt;
        const end = i.updatedAtRaw ?? i.createdAtRaw ?? i.createdAt;
        const startMs = Date.parse(start);
        const endMs = Date.parse(end);
        if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
        return (endMs - startMs) / 60000;
      })
      .filter((v): v is number => v !== null);

    if (samples.length === 0) return null;
    const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    return Math.max(1, Math.round(avg));
  }, [closedIncidents]);

  const totalCount = useMemo(() => {
    const ids = new Set<string>();
    incidents.forEach((i) => ids.add(i.id));
    closedIncidents.forEach((i) => ids.add(i.id));
    return ids.size;
  }, [incidents, closedIncidents]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  /** Actions */
  function emitAction(type: string, payload: unknown) {
    socket?.emit("arm:action", { type, ...(payload as Record<string, unknown>) });
  }

  function onAssign() {
    if (!selected) return;
    const hospital = normalizeHospital(selected.nearestHospital);
    const etaMinutes = typeof selected.eta === "number" ? selected.eta : undefined;
    const hospitalMessage = buildHospitalMessage(selected, hospital);

    setIncidents((prev) =>
      prev.map((i) =>
        i.id === selected.id
          ? {
              ...i,
              status: "en_cours",
              notes:
                (i.notes ?? "") +
                `\nAssigné: ${assignTeam}` +
                (hospital ? `\n🏥 Hôpital: ${hospital.name}` : ""),
            }
          : i
      )
    );

    // Emit to ARM backend
    emitAction("assign_ambulance", { incidentId: selected.id, team: assignTeam });
    if (hospital && hospitalMessage) {
      emitAction("notify_hospital", {
        incidentId: selected.id,
        hospital: {
          name: hospital.name,
          address: hospital.address,
          lat: hospital.lat,
          lng: hospital.lng,
        },
        message: hospitalMessage,
        etaMinutes,
      });
    }

    // Generate tracking URL
    const trackingToken = selected.id;
    const url = `/t/${trackingToken}`;
    setTrackingUrl(url);

    // Emit to tracking page (real-time update)
    const trackingPayload: Record<string, unknown> = {
      token: trackingToken,
      status: "assigned",
      ambulance: { label: assignTeam },
      incident: {
        label: selected.locationLabel,
        lat: selected.lat,
        lng: selected.lng
      },
      ambulancePos: { lat: selected.lat, lng: selected.lng, updatedAt: new Date().toISOString() },
      expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), // 30 min
    };

    if (hospital) {
      trackingPayload.destinationHospital = {
        name: hospital.name,
        address: hospital.address ?? "",
        lat: hospital.lat,
        lng: hospital.lng,
      };
    }
    if (etaMinutes != null) {
      trackingPayload.etaMinutes = etaMinutes;
    }

    socket?.emit("tracking:assign", trackingPayload);

    setOpenAssign(false);
  }

  function onEdit() {
    if (!selected) return;
    setIncidents((prev) => prev.map((i) => (i.id === selected.id ? { ...i, notes: editNotes } : i)));
    emitAction("edit_incident", { incidentId: selected.id, notes: editNotes });
    setOpenEdit(false);
  }

  function onNotify() {
    if (!selected) return;
    emitAction("notify_citizen", { incidentId: selected.id, message: notifyMsg });
    setOpenNotify(false);
  }

  function exportIncidentsCsv() {
    const rows = [
      ["id", "createdAt", "status", "priority", "title", "locationLabel", "lat", "lng", "symptoms", "notes"],
      ...incidents.map((i) => [
        i.id,
        i.createdAt,
        i.status,
        String(i.priority),
        i.title,
        i.locationLabel,
        String(i.lat),
        String(i.lng),
        i.symptoms.join("|"),
        i.notes ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadClosedIncidentsPdf() {
    const closed = await fetchClosedIncidents();
    if (closed.length === 0) {
      alert("Aucun incident clos à exporter.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = margin;

    let logoData: string | null = null;
    try {
      const res = await fetch("/MedLink_logo.png");
      const blob = await res.blob();
      logoData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch {
      logoData = null;
    }

    if (logoData) {
      doc.addImage(logoData, "PNG", margin, y, 52, 52);
    }

    doc.setFontSize(18);
    doc.text("Historique des incidents clos", margin + 70, y + 24);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Export du ${new Date().toLocaleString()}`, margin + 70, y + 42);
    doc.setTextColor(0);
    y += 72;

    const colWidths = [70, 210, 120, 55, 85];
    const headers = ["ID", "Titre", "Lieu", "Priorité", "Heure"];

    const drawRow = (row: string[], isHeader = false) => {
      const lineHeight = isHeader ? 12 : 11;
      const cellLines = row.map((cell, idx) => {
        const maxWidth = colWidths[idx] - 6;
        return doc.splitTextToSize(cell, maxWidth);
      });
      const maxLines = Math.max(...cellLines.map((lines) => lines.length));
      const rowHeight = Math.max(lineHeight + 6, maxLines * lineHeight + 4);

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(isHeader ? 10 : 9);
      doc.setTextColor(isHeader ? 70 : 40);
      let x = margin;
      cellLines.forEach((lines, idx) => {
        doc.text(lines, x + 3, y + lineHeight);
        x += colWidths[idx];
      });

      doc.setDrawColor(220);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      y += rowHeight;
      doc.setTextColor(0);
    };

    drawRow(headers, true);

    closed.forEach((i) => {
      const shortId = i.id.length > 12 ? `${i.id.slice(0, 8)}…${i.id.slice(-4)}` : i.id;
      drawRow(
        [
          shortId,
          i.title,
          i.locationLabel,
          `P${i.priority}`,
          i.createdAt,
        ],
        false
      );
    });

    doc.save(`incidents-clos-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const kNew = incidents.filter((i) => i.status === "nouveau").length;
  const kProg = incidents.filter((i) => i.status === "en_cours").length;
  const kClosed = closedIncidents.length;

  return (
    <MedlinkLayout
      title="Centre d’opérations"
      subtitle={`${totalCount} incidents • ${status === "tous" ? "Tous statuts" : statusLabel(status)}`}
      requireAuth
      actions={
        <>
          <button className="btn btnGhost" onClick={downloadClosedIncidentsPdf}>
            Historique
          </button>
          <button className="btn btnGhost" onClick={() => setOpenAssist(true)}>
            Assistance
          </button>
          <input
            className="medSearch"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher (id, lieu, symptôme, notes...)"
          />
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as IncidentStatus | "tous");
              setPage(1);
            }}
          >
            <option value="tous">Tous</option>
            <option value="nouveau">Nouveaux</option>
            <option value="en_cours">En cours</option>
            <option value="clos">Clos</option>
          </select>
          <button className="btn btnGhost" onClick={() => setOpenHistory(true)}>
            Logs
          </button>
          <button className="btn btnGhost" onClick={exportIncidentsCsv}>
            Export
          </button>
          <div className="medAvatar" />
        </>
      }
    >
      <section className="kpiRow">
        <div className="kpiCard">
          <div className="kpiLabel">Nouveaux</div>
          <div className="kpiValue">{kNew}</div>
          <div className="kpiHint">Aujourd’hui</div>
        </div>
        <div className="kpiCard">
          <div className="kpiLabel">En cours</div>
          <div className="kpiValue">{kProg}</div>
          <div className="kpiHint">Aujourd’hui</div>
        </div>
        <div className="kpiCard">
          <div className="kpiLabel">Clos</div>
          <div className="kpiValue">{kClosed}</div>
          <div className="kpiHint">Aujourd’hui</div>
        </div>
        <div className="kpiCard">
          <div className="kpiLabel">SLA (démo)</div>
          <div className="kpiValue">{slaMinutes === null ? "—" : `${slaMinutes} min`}</div>
          <div className="kpiHint">Aujourd’hui</div>
        </div>
      </section>

      <section className="grid">
          {/* LEFT */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="muted">Incidents</div>
                <div className="cardTitle">File opérationnelle</div>
              </div>
              <button
                className="btn btnGhost"
                onClick={() => {
                  const id = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
                  const nowIso = new Date().toISOString();
                  const newIncident: Incident = {
                    id,
                    createdAt: nowIso.slice(0, 16).replace("T", " "),
                    createdAtRaw: nowIso,
                    updatedAtRaw: nowIso,
                    status: "nouveau",
                    priority: 3,
                    title: "Nouveau signalement (démo)",
                    locationLabel: "Paris",
                    lat: 48.8566,
                    lng: 2.3522,
                    symptoms: ["fièvre"],
                    notes: "Créé depuis UI",
                  };
                  setIncidents((prev) => [newIncident, ...prev]);
                  emitAction("create_incident", { incident: newIncident });
                }}
              >
                + Ajouter (démo)
              </button>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Titre</th>
                    <th>Lieu</th>
                    <th>P</th>
                    <th>Statut</th>
                    <th>Heure</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((i) => {
                    const active = i.id === selected?.id;
                    return (
                      <tr key={i.id} className={active ? "row active" : "row"} onClick={() => setSelectedId(i.id)}>
                        <td className="mono strong">{i.id}</td>
                        <td>
                          <div className="strong">{i.title}</div>
                          <div className="muted small">{i.symptoms.slice(0, 3).join(" • ")}</div>
                        </td>
                        <td className="muted">{i.locationLabel}</td>
                        <td>
                          <span className={`${priorityClass(i.priority)}`}>P{i.priority}</span>
                        </td>
                        <td>
                          <span className={`${statusClass(i.status)}`}>{statusLabel(i.status)}</span>
                        </td>
                        <td className="muted">{i.createdAt}</td>
                      </tr>
                    );
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        Aucun incident ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="cardFoot">
              <div className="muted">
                Affichés: {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}
              </div>
              <div className="pagerBtns">
                <button className="btn btnGhost" onClick={() => setPage(1)}>
                  Début
                </button>
                <button className="btn btnGhost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Précédent
                </button>
                <button className="btn btnGhost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Suivant
                </button>
                <button className="btn btnGhost" onClick={() => setPage(totalPages)}>
                  Fin
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rightCol">
            <div className="card">
              <div className="cardHead">
                <div>
                  <div className="muted">Détails</div>
                  <div className="cardTitle">{selected ? selected.title : "—"}</div>
                  {selected && (
                    <div className="muted small">
                      {selected.id} • {selected.locationLabel} • {selected.createdAt}
                    </div>
                  )}
                </div>

                <div className="badgesCol">
                  {selected && (
                    <>
                      <span className={`${priorityClass(selected.priority)}`}>Priorité P{selected.priority}</span>
                      <span className={`${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="noteBox">
                <div className="muted small">Notes</div>
                <div className="noteText">{selected?.notes ?? "Aucune note"}</div>
              </div>

              <div className="btnRow">
                <button className="btn btnBlue" onClick={() => setOpenAssign(true)} disabled={!selected}>
                  🚑 Assigner
                </button>
                <button className="btn btnGhost" onClick={() => {
                  if (!selected) return;
                  setOpenAssignHospital(true);
                  const existingHospital = normalizeHospital(selected.nearestHospital);
                  if (existingHospital) {
                    setHospitalResult(existingHospital);
                    setHospitalEta(typeof selected.eta === "number" ? selected.eta : null);
                  } else {
                    fetchNearestHospital(selected);
                  }
                }} disabled={!selected}>
                  🏥 Assigner hôpital
                </button>
                <button className="btn btnGhost" onClick={() => setOpenEdit(true)} disabled={!selected}>
                  ✏️ Corriger
                </button>
                <button className="btn btnGreen" onClick={() => setOpenNotify(true)} disabled={!selected}>
                  📩 Notifier
                </button>
              </div>
            </div>

            <div className="card">
              <div className="cardHead">
                <div>
                  <div className="muted">Carte</div>
                  <div className="cardTitle">Localisation</div>
                </div>
                <div className="muted small">
                  {selected ? `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}` : "—"}
                </div>
              </div>

              {/* Remount key pour forcer le rafraîchissement de la carte */}
              <div className="mapWrap">
                <MapPanel
                  key={`${selected?.id}-${selected?.lat}-${selected?.lng}`}
                  lat={selected?.lat ?? 48.8566}
                  lng={selected?.lng ?? 2.3522}
                  address={selected?.locationLabel}
                  label={selected?.locationLabel ?? "Paris"}
                />
              </div>
            </div>
          </div>
      </section>

      {/* MODALS */}
      <Modal open={openAssign} title="Assigner une ambulance" onClose={() => setOpenAssign(false)}>
        <div className="form">
          <div className="muted">
            Incident: <b className="strong">{selected?.id}</b>
          </div>
          <label className="label">Équipe / Ambulance</label>
          <input className="input" value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)} placeholder="ex: AMB-12" />
          <label className="label">Téléphone victime</label>
          <input
            className="input"
            value={victimPhone}
            onChange={(e) => setVictimPhone(e.target.value)}
            placeholder="ex: +33612345678"
          />
          <div className="muted small">
            Hôpital: {selectedHospital ? `${selectedHospital.name}${selectedHospital.address ? ` • ${selectedHospital.address}` : ""}` : "Recherche en cours"}
          </div>
          {selected?.eta != null && (
            <div className="muted small">ETA estimée: {selected.eta} min</div>
          )}
          <button className="btn btnBlue" onClick={onAssign}>
            Confirmer l’assignation
          </button>
          {trackingUrl && (
            <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: "0.75rem", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <div style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Lien de suivi créé :</div>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#10b981",
                  textDecoration: "none",
                  fontWeight: "600",
                  wordBreak: "break-all"
                }}
              >
                {window.location.origin}{trackingUrl}
              </a>
              <button
                className="btn btnGhost"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + trackingUrl);
                  alert("Lien copié !");
                }}
                style={{ marginTop: "0.75rem", width: "100%" }}
              >
                📋 Copier le lien
              </button>
              <button
                className="btn btnGreen"
                onClick={() => {
                  if (!victimPhone.trim()) {
                    alert("Veuillez renseigner un numéro de téléphone.");
                    return;
                  }
                  const smsBody = `Votre suivi MedLink: ${window.location.origin}${trackingUrl}`;
                  const smsUrl = `sms:${victimPhone}?&body=${encodeURIComponent(smsBody)}`;
                  window.location.href = smsUrl;
                }}
                style={{ marginTop: "0.75rem", width: "100%" }}
              >
                📲 Envoyer par SMS
              </button>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={openAssignHospital} title="Assigner un hôpital" onClose={() => setOpenAssignHospital(false)}>
        <div className="form">
          <div className="muted">
            Incident: <b className="strong">{selected?.id}</b>
          </div>
          <div className="muted small">Adresse: {selected?.locationLabel || "Adresse inconnue"}</div>

          {hospitalLoading ? (
            <div className="muted">Recherche du centre le plus proche…</div>
          ) : hospitalError ? (
            <div className="muted" style={{ color: "#f87171" }}>
              {hospitalError}
            </div>
          ) : hospitalResult ? (
            <div style={{ padding: "0.75rem", borderRadius: "0.75rem", background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(148, 163, 184, 0.2)" }}>
              <div className="strong">{hospitalResult.name}</div>
              {hospitalResult.address && <div className="muted small">{hospitalResult.address}</div>}
              {hospitalEta != null && <div className="muted small">ETA estimée: {hospitalEta} min</div>}
            </div>
          ) : (
            <div className="muted">Aucun résultat pour l’instant.</div>
          )}
          {hospitalSaved && (
            <div className="muted small" style={{ color: "#10b981" }}>
              ✅ Hôpital enregistré et envoyé au suivi patient.
            </div>
          )}

          <div className="btnRow">
            <button
              className="btn btnGhost"
              onClick={() => selected && fetchNearestHospital(selected)}
              disabled={!selected || hospitalLoading}
            >
              🔄 Rechercher
            </button>
            <button
              className="btn btnBlue"
              onClick={async () => {
                if (!selected || !hospitalResult) return;
                await applyHospitalAssignment(selected, hospitalResult, hospitalEta);
                setOpenAssignHospital(false);
              }}
              disabled={!selected || !hospitalResult}
            >
              ✅ Confirmer l’hôpital
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={openEdit} title="Corriger les informations" onClose={() => setOpenEdit(false)}>
        <div className="form">
          <label className="label">Notes opérateur</label>
          <textarea className="textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          <button className="btn btnGhost" onClick={onEdit}>
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={openNotify} title="Notifier le citoyen" onClose={() => setOpenNotify(false)}>
        <div className="form">
          <label className="label">Message</label>
          <textarea className="textarea" value={notifyMsg} onChange={(e) => setNotifyMsg(e.target.value)} />
          <button className="btn btnGreen" onClick={onNotify}>
            Envoyer la notification
          </button>
        </div>
      </Modal>

      <Modal open={openHistory} title="Historique des incidents clos" onClose={() => setOpenHistory(false)}>
        <div className="tableWrap tableWrapScroll">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Titre</th>
                <th>Lieu</th>
                <th>Priorité</th>
                <th>Heure</th>
              </tr>
            </thead>
            <tbody>
              {closedIncidents.map((i) => (
                <tr key={i.id}>
                  <td className="mono strong">{i.id}</td>
                  <td>
                    <div className="strong">{i.title}</div>
                    <div className="muted small">{i.symptoms.slice(0, 3).join(" • ")}</div>
                  </td>
                  <td className="muted">{i.locationLabel}</td>
                  <td>
                    <span className={`${priorityClass(i.priority)}`}>P{i.priority}</span>
                  </td>
                  <td className="muted">{i.createdAt}</td>
                </tr>
              ))}
              {closedIncidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    {closedLoading ? "Chargement des incidents clos..." : "Aucun incident clos pour le moment."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal open={openAssist} title="Assistance MedLink" onClose={() => setOpenAssist(false)}>
        <div className="form">
          <div className="noteBox">
            <div className="muted small">Numéro vert</div>
            <div className="strong">0800 000 000</div>
            <div className="muted small">Disponible 24/7</div>
          </div>
          <button
            className="btn btnGhost"
            onClick={() => {
              window.location.href = "tel:0800000000";
            }}
          >
            Appeler le support
          </button>
          <button
            className="btn btnBlue"
            onClick={() => {
              window.location.href = "mailto:support@medlink.fr?subject=Ticket%20MedLink&body=Décrivez%20le%20problème%20ici.";
            }}
          >
            Créer un ticket
          </button>
        </div>
      </Modal>

    </MedlinkLayout>
  );
}
