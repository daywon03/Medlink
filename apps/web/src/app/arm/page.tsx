"use client";

import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import io, { Socket } from "socket.io-client";

type IncidentStatus = "nouveau" | "en_cours" | "clos";
type Incident = {
  id: string;
  createdAt: string;
  status: IncidentStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  locationLabel: string;
  lat: number;
  lng: number;
  symptoms: string[];
  notes?: string;
};

const MapPanel = dynamic(() => import("./ui/MapPanel"), { ssr: false });

const PAGE_SIZE = 8;

const MOCK: Incident[] = [
  {
    id: "INC-1024",
    createdAt: "2025-12-26 12:20",
    status: "nouveau",
    priority: 2,
    title: "Douleur thoracique + nausées",
    locationLabel: "Paris 15e",
    lat: 48.8414,
    lng: 2.3007,
    symptoms: ["douleur poitrine", "nausées", "sueurs"],
    notes: "Patient anxieux, douleur depuis 20 min.",
  },
  {
    id: "INC-1025",
    createdAt: "2025-12-26 12:23",
    status: "en_cours",
    priority: 3,
    title: "Fièvre + vertiges",
    locationLabel: "Issy-les-Moulineaux",
    lat: 48.8245,
    lng: 2.2736,
    symptoms: ["fièvre", "vertiges", "fatigue"],
    notes: "Température 39°C, état général altéré.",
  },
];

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
  const [incidents, setIncidents] = useState<Incident[]>(MOCK);
  const incidentsRef = useRef<Incident[]>(MOCK);
  const [selectedId, setSelectedId] = useState<string>(MOCK[0]?.id ?? "");
  const selected = incidents.find((i: Incident) => i.id === selectedId) ?? incidents[0];

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "tous">("tous");

  // pagination
  const [page, setPage] = useState(1);

  // modals
  const [openAssign, setOpenAssign] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openNotify, setOpenNotify] = useState(false);

  // form states
  const [assignTeam, setAssignTeam] = useState("AMB-12");
  const [editNotes, setEditNotes] = useState(selected?.notes ?? "");
  const [notifyMsg, setNotifyMsg] = useState("Une équipe est en cours d’assignation. Restez joignable.");  const [trackingUrl, setTrackingUrl] = useState("");
  useEffect(() => {
    setEditNotes(selected?.notes ?? "");
    incidentsRef.current = incidents;
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Socket init */
useEffect(() => {
  let s: Socket | null = null;
  let cancelled = false;

  (async () => {
    await fetch("/api/socket");
    if (cancelled) return;

    s = io({ path: "/api/socketio" });

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

        s?.emit("tracking:assign", {
          token: found.id,
          status: "assigned",
          ambulance: { label: team },
          incident: { label: found.locationLabel, lat: found.lat, lng: found.lng },
          destinationHospital: {
            name: "Hôpital Européen Georges-Pompidou",
            address: "20 Rue Leblanc, 75015 Paris",
            lat: 48.8414,
            lng: 2.2790,
          },
          ambulancePos: { lat: found.lat, lng: found.lng, updatedAt: new Date().toISOString() },
          etaMinutes: 7,
          expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
        });
      } catch (e) {
        console.error("tracking:request handler error", e);
      }
    });

    setSocket(s);
  })();

  return () => {
    cancelled = true;
    if (s) {
      s.removeAllListeners();
      s.disconnect(); // <= IMPORTANT: on ne "return" pas le résultat
    }
  };
}, []);


  /** Filter + paginate */
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return incidents.filter((i) => {
      const okStatus = status === "tous" ? true : i.status === status;
      const hay = `${i.id} ${i.title} ${i.locationLabel} ${i.symptoms.join(" ")} ${i.notes ?? ""}`.toLowerCase();
      const okQ = qq ? hay.includes(qq) : true;
      return okStatus && okQ;
    });
  }, [incidents, q, status]);

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
    setIncidents((prev) =>
      prev.map((i) =>
        i.id === selected.id ? { ...i, status: "en_cours", notes: (i.notes ?? "") + `\nAssigné: ${assignTeam}` } : i
      )
    );
    
    // Emit to ARM backend
    emitAction("assign_ambulance", { incidentId: selected.id, team: assignTeam });
    
    // Generate tracking URL
    const trackingToken = selected.id;
    const url = `/t/${trackingToken}`;
    setTrackingUrl(url);
    
    // Emit to tracking page (real-time update)
    socket?.emit("tracking:assign", {
      token: trackingToken,
      status: "assigned",
      ambulance: { label: assignTeam },
      incident: { 
        label: selected.locationLabel, 
        lat: selected.lat, 
        lng: selected.lng 
      },
      destinationHospital: {
        name: "Hôpital Européen Georges-Pompidou",
        address: "20 Rue Leblanc, 75015 Paris",
        lat: 48.8414,
        lng: 2.2790,
      },
      ambulancePos: { lat: selected.lat, lng: selected.lng, updatedAt: new Date().toISOString() },
      etaMinutes: 7,
      expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), // 30 min
    });
    
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

  return (
    <div className="armShell">
      {/* header */}
      <header className="armHeader">
        <div className="armHeaderInner">
          <div className="brand">
            <div className="brandIcon">🧭</div>
            <div>
              <div className="muted">Medlink • ARM Console</div>
              <div className="title">Centre d’opérations</div>
              <div className="sub">
                <span className="dot" />
                <span>En ligne</span>
                <span className="sep">•</span>
                <span>{filtered.length} incidents</span>
                <span className="sep">•</span>
                <span className="muted">{socket?.connected ? "Socket OK" : "Socket…"}</span>
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="btn btnGhost">Export</button>
            <button className="btn btnGhost">Paramètres</button>
            <div className="avatar" />
          </div>
        </div>
      </header>

      <main className="armMain">
        {/* toolbar */}
        <section className="toolbar">
          <input
            className="input"
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
          <div className="pager">
            <div>
              Page <b>{page}</b> / {totalPages}
            </div>
            <div className="pagerBtns">
              <button className="btn btnGhost" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ←
              </button>
              <button className="btn btnGhost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                →
              </button>
            </div>
          </div>
        </section>

        {/* grid */}
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
                  const newIncident: Incident = {
                    id,
                    createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
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

              {/* 🔥 IMPORTANT: key pour forcer un remount -> évite pas mal de glitch Leaflet */}
              <div className="mapWrap">
                <MapPanel
                  key={`${selected?.id}-${selected?.lat}-${selected?.lng}`}
                  lat={selected?.lat ?? 48.8566}
                  lng={selected?.lng ?? 2.3522}
                  label={selected?.locationLabel ?? "Paris"}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* MODALS */}
      <Modal open={openAssign} title="Assigner une ambulance" onClose={() => setOpenAssign(false)}>
        <div className="form">
          <div className="muted">
            Incident: <b className="strong">{selected?.id}</b>
          </div>
          <label className="label">Équipe / Ambulance</label>
          <input className="input" value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)} placeholder="ex: AMB-12" />
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
            </div>
          )}        </div>
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

      {/* CSS global intégré */}
      <style jsx global>{`
        :root {
          --bg: #070a12;
          --panel: rgba(255, 255, 255, 0.06);
          --panel2: rgba(0, 0, 0, 0.25);
          --stroke: rgba(255, 255, 255, 0.12);
          --text: #e5e7eb;
          --muted: rgba(255, 255, 255, 0.65);
          --muted2: rgba(255, 255, 255, 0.5);
        }

        html,
        body {
          height: 100%;
        }
        body {
          margin: 0;
          background: radial-gradient(1200px 800px at 30% -10%, rgba(14, 165, 233, 0.14), transparent 60%),
            radial-gradient(1200px 800px at 70% 110%, rgba(244, 63, 94, 0.12), transparent 60%),
            var(--bg);
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          overflow-x: hidden;
        }
        * {
          box-sizing: border-box;
        }

        /* Layout */
        .armShell {
          min-height: 100vh;
        }

        .armHeader {
          position: sticky;
          top: 0;
          z-index: 50;
          border-bottom: 1px solid var(--stroke);
          backdrop-filter: blur(10px);
          background: rgba(7, 10, 18, 0.7);
        }
        .armHeaderInner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .brand {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .brandIcon {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: grid;
          place-items: center;
        }
        .title {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .sub {
          margin-top: 6px;
          display: flex;
          gap: 8px;
          align-items: center;
          color: var(--muted);
          font-size: 13px;
          flex-wrap: wrap;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #34d399;
          display: inline-block;
        }
        .sep {
          color: rgba(255, 255, 255, 0.25);
        }

        .actions {
          display: none;
          align-items: center;
          gap: 8px;
        }
        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-left: 6px;
        }
        @media (min-width: 900px) {
          .actions {
            display: flex;
          }
        }

        .armMain {
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px 18px 24px;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        @media (min-width: 900px) {
          .toolbar {
            grid-template-columns: 1.5fr 0.7fr 0.8fr;
            align-items: center;
          }
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: start;
        }
        @media (min-width: 1100px) {
          .grid {
            grid-template-columns: 1.45fr 1fr;
          }
        }

        .rightCol {
          display: grid;
          gap: 14px;
        }

        /* Card */
        .card {
          background: var(--panel);
          border: 1px solid var(--stroke);
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        }
        .cardHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .cardTitle {
          font-size: 16px;
          font-weight: 700;
          margin-top: 2px;
        }
        .cardFoot {
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        /* Inputs */
        .input,
        .select,
        .textarea {
          width: 100%;
          border-radius: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          outline: none;
        }
        .textarea {
          min-height: 140px;
          resize: vertical;
        }
        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: rgba(255, 255, 255, 0.25);
        }

        .pager {
          border-radius: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: 13px;
        }

        /* Buttons */
        .btn {
          border-radius: 12px;
          padding: 9px 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.08);
          color: var(--text);
          cursor: pointer;
          transition: transform 0.06s ease, background 0.15s ease, border-color 0.15s ease;
          font-size: 13px;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btnGhost {
          background: rgba(255, 255, 255, 0.08);
        }
        .btnBlue {
          background: rgba(14, 165, 233, 0.16);
          border-color: rgba(14, 165, 233, 0.25);
        }
        .btnBlue:hover {
          background: rgba(14, 165, 233, 0.22);
        }
        .btnGreen {
          background: rgba(16, 185, 129, 0.16);
          border-color: rgba(16, 185, 129, 0.25);
        }
        .btnGreen:hover {
          background: rgba(16, 185, 129, 0.22);
        }

        .btnRow {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 700px) {
          .btnRow {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }

        /* Table */
        .tableWrap {
          margin-top: 12px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .table thead th {
          text-align: left;
          padding: 10px 10px;
          background: rgba(0, 0, 0, 0.28);
          color: rgba(255, 255, 255, 0.75);
          font-weight: 600;
        }
        .table tbody td {
          padding: 10px 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          vertical-align: top;
        }
        .row {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .row:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .row.active {
          background: rgba(255, 255, 255, 0.1);
        }
        .empty {
          padding: 18px 10px !important;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .strong {
          font-weight: 700;
        }
        .muted {
          color: var(--muted);
        }
        .small {
          font-size: 12px;
        }

        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          font-size: 12px;
          white-space: nowrap;
        }
        .badgePrioHigh {
          background: rgba(244, 63, 94, 0.14);
          border-color: rgba(244, 63, 94, 0.25);
          color: rgba(253, 164, 175, 0.95);
        }
        .badgePrioMed {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(245, 158, 11, 0.25);
          color: rgba(252, 211, 77, 0.95);
        }
        .badgePrioLow {
          background: rgba(139, 92, 246, 0.14);
          border-color: rgba(139, 92, 246, 0.25);
          color: rgba(196, 181, 253, 0.95);
        }
        .badgeStatusNew {
          background: rgba(16, 185, 129, 0.14);
          border-color: rgba(16, 185, 129, 0.25);
          color: rgba(110, 231, 183, 0.95);
        }
        .badgeStatusProgress {
          background: rgba(14, 165, 233, 0.14);
          border-color: rgba(14, 165, 233, 0.25);
          color: rgba(125, 211, 252, 0.95);
        }
        .badgeStatusClosed {
          background: rgba(161, 161, 170, 0.12);
          border-color: rgba(161, 161, 170, 0.22);
          color: rgba(228, 228, 231, 0.9);
        }

        .badgesCol {
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        /* Notes */
        .noteBox {
          margin-top: 10px;
          background: var(--panel2);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 10px;
        }
        .noteText {
          margin-top: 6px;
          white-space: pre-line;
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
          line-height: 1.35;
        }

        /* Map */
        .mapWrap {
          margin-top: 12px;
          height: 420px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.25);
        }
        @media (max-width: 520px) {
          .mapWrap {
            height: 320px;
          }
        }

        /* Leaflet critical fixes (empêche les tiles de partir en vrille) */
        .leaflet-container {
          width: 100%;
          height: 100%;
          background: #0b1020;
        }
        .leaflet-container img {
          max-width: none !important;
        }
        .leaflet-tile {
          max-width: none !important;
          max-height: none !important;
        }

        /* Modal */
        .modalRoot {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
        }
        .modalBackdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          border: 0;
        }
        .modalCard {
          position: relative;
          width: min(680px, 92vw);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: #0b1020;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
          padding: 14px;
        }
        .modalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .modalTitle {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
        }
        .modalBody {
          margin-top: 12px;
        }

        .form {
          display: grid;
          gap: 10px;
        }
        .label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.65);
        }
      `}</style>
    </div>
  );
}
