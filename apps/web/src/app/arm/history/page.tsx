"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import MedlinkLayout from "../../ui/MedlinkLayout";
import { jsPDF } from "jspdf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CallHistory {
  callId: string;
  citizenId: string;
  dateHeure: string;
  status: string;
  locationInputText: string;
  extractedAddress: string;
  duration: string;
  triage: {
    priority: string;
    priorityNumeric: number;
    aiExplanation: string;
    confidence: number;
    nearestHospitalData: unknown;
    patientLocation: unknown;
    estimatedArrivalMinutes: number | null;
    isVitalEmergency: boolean;
  } | null;
  transcriptionCount: number;
  transcriptions: { text: string; createdAt: string }[];
}

function priorityBadge(priority: string | undefined) {
  if (!priority) return "badge badgePrioLow";
  if (priority === "P0" || priority === "P1") return "badge badgePrioHigh";
  if (priority === "P2") return "badge badgePrioMed";
  return "badge badgePrioLow";
}

function priorityLabel(priority: string | undefined) {
  const labels: Record<string, string> = {
    P0: " P0 — Urgence absolue",
    P1: "🟠 P1 — Urgence vitale",
    P2: "🟡 P2 — Urgence relative",
    P3: " P3 — Peu urgent",
    P5: " P5 — Conseil médical",
  };
  return labels[priority || ""] || priority || "—";
}

export default function HistoryPage() {
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const limit = 15;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`${API_URL}/api/reports/calls?${params}`);
      const json = await res.json();

      if (json.success) {
        setCalls(json.calls || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to fetch call history:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, priorityFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, priorityFilter, dateFrom, dateTo]);

  const selectedCall = useMemo(
    () => calls.find((c) => c.callId === selectedCallId) || null,
    [calls, selectedCallId]
  );

  // ─── PDF Export ───────────────────────────────────────────────────────────────
  async function exportCallPdf(callId: string) {
    setPdfLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/calls/${callId}/pdf-data`);
      const json = await res.json();

      if (!json.success || !json.data) {
        alert("Impossible de récupérer les données de l'appel.");
        return;
      }

      const data = json.data;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = margin;

      // Logo
      let logoData: string | null = null;
      try {
        const logoRes = await fetch("/MedLink_logo.png");
        const blob = await logoRes.blob();
        logoData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
      } catch {
        logoData = null;
      }

      if (logoData) {
        doc.addImage(logoData, "PNG", margin, y, 48, 48);
      }

      // Title
      doc.setFontSize(18);
      doc.setTextColor(28, 75, 182);
      doc.text("Rapport d'intervention", margin + 60, y + 20);
      doc.setFontSize(10);
      doc.setTextColor(108, 124, 156);
      doc.text(`Export du ${new Date().toLocaleString("fr-FR")}`, margin + 60, y + 38);
      y += 68;

      // Separator
      doc.setDrawColor(217, 227, 244);
      doc.line(margin, y, pageWidth - margin, y);
      y += 20;

      // Call Info
      doc.setFontSize(14);
      doc.setTextColor(27, 42, 74);
      doc.text("Informations de l'appel", margin, y);
      y += 20;

      doc.setFontSize(10);
      const fields = [
        ["ID Appel", data.callId],
        ["Date/Heure", new Date(data.dateHeure).toLocaleString("fr-FR")],
        ["Statut", data.status === "finished" ? "Terminé" : data.status],
        ["Durée", data.duration || "—"],
        ["Adresse saisie", data.locationInputText || "—"],
        ["Adresse extraite", data.extractedAddress || "—"],
      ];

      fields.forEach(([label, value]) => {
        doc.setTextColor(108, 124, 156);
        doc.text(`${label}:`, margin, y);
        doc.setTextColor(27, 42, 74);
        doc.text(String(value), margin + 120, y);
        y += 16;
      });
      y += 10;

      // Triage
      if (data.triage) {
        doc.setDrawColor(217, 227, 244);
        doc.line(margin, y, pageWidth - margin, y);
        y += 20;

        doc.setFontSize(14);
        doc.setTextColor(27, 42, 74);
        doc.text("Triage IA", margin, y);
        y += 20;

        doc.setFontSize(10);
        const triageFields = [
          ["Priorité", data.triage.priority],
          ["Confiance", `${Math.round(data.triage.confidence * 100)}%`],
          ["Urgence vitale", data.triage.isVitalEmergency ? "OUI ️" : "Non"],
          ["Validé par médecin", data.triage.validatedByDoctor ? "Oui " : "Non"],
        ];

        triageFields.forEach(([label, value]) => {
          doc.setTextColor(108, 124, 156);
          doc.text(`${label}:`, margin, y);
          doc.setTextColor(27, 42, 74);
          doc.text(String(value), margin + 120, y);
          y += 16;
        });

        if (data.triage.aiExplanation) {
          y += 6;
          doc.setTextColor(108, 124, 156);
          doc.text("Résumé IA:", margin, y);
          y += 14;
          doc.setTextColor(27, 42, 74);
          const lines = doc.splitTextToSize(data.triage.aiExplanation, pageWidth - 2 * margin);
          doc.text(lines, margin, y);
          y += lines.length * 12 + 10;
        }
      }

      // Transcriptions
      if (data.transcriptions && data.transcriptions.length > 0) {
        if (y > 600) {
          doc.addPage();
          y = margin;
        }

        doc.setDrawColor(217, 227, 244);
        doc.line(margin, y, pageWidth - margin, y);
        y += 20;

        doc.setFontSize(14);
        doc.setTextColor(27, 42, 74);
        doc.text(`Transcriptions (${data.transcriptions.length})`, margin, y);
        y += 20;

        doc.setFontSize(9);
        data.transcriptions.forEach(
          (t: { text: string; createdAt: string; wordCount: number }, idx: number) => {
            if (y > 750) {
              doc.addPage();
              y = margin;
            }

            doc.setTextColor(108, 124, 156);
            doc.text(
              `${idx + 1}. ${new Date(t.createdAt).toLocaleTimeString("fr-FR")} (${t.wordCount} mots)`,
              margin,
              y
            );
            y += 12;
            doc.setTextColor(27, 42, 74);
            const lines = doc.splitTextToSize(t.text, pageWidth - 2 * margin);
            doc.text(lines, margin + 10, y);
            y += lines.length * 11 + 8;
          }
        );
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text(
        "Document généré automatiquement par MedLink — Confidentiel",
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: "center" }
      );

      doc.save(`rapport-appel-${data.callId.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Erreur lors de l'export PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ["ID", "Date", "Statut", "Durée", "Adresse", "Priorité", "Confiance IA", "Nb Transcriptions"],
      ...calls.map((c) => [
        c.callId,
        new Date(c.dateHeure).toLocaleString("fr-FR"),
        c.status,
        c.duration || "—",
        c.extractedAddress || c.locationInputText || "—",
        c.triage?.priority || "—",
        c.triage ? `${Math.round(c.triage.confidence * 100)}%` : "—",
        String(c.transcriptionCount),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historique-appels-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MedlinkLayout
      title="Historique des Appels"
      subtitle={`${total} appel${total !== 1 ? "s" : ""} au total`}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btnGhost" onClick={exportCsv} disabled={calls.length === 0}>
             Export CSV
          </button>
          <button className="btn btnGhost" onClick={fetchHistory}>
             Actualiser
          </button>
        </div>
      }
    >
      {/* ─── Filters ───────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="cardHead">
          <div className="cardTitle"> Filtres de recherche</div>
        </div>
        <div className="cardBody">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <div className="label">Recherche</div>
              <input
                className="input"
                placeholder="ID, adresse, symptômes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <div className="label">Priorité</div>
              <select className="select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="">Toutes</option>
                <option value="P0">P0 — Urgence absolue</option>
                <option value="P1">P1 — Urgence vitale</option>
                <option value="P2">P2 — Urgence relative</option>
                <option value="P3">P3 — Peu urgent</option>
                <option value="P5">P5 — Conseil médical</option>
              </select>
            </div>
            <div>
              <div className="label">Date début</div>
              <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <div className="label">Date fin</div>
              <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Table ─────────────────────────────────────────────────────────────── */}
      <div className="grid" style={{ gridTemplateColumns: selectedCall ? "1.4fr 0.6fr" : "1fr" }}>
        <div className="card">
          <div className="cardHead">
            <div className="cardTitle"> Liste des appels</div>
            <div className="muted small">{total} résultat{total !== 1 ? "s" : ""}</div>
          </div>
          <div className="cardBody p-0">
            <div className="tableWrap">
              <div className="tableWrapScroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Adresse</th>
                      <th>Priorité</th>
                      <th>Durée</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          Chargement...
                        </td>
                      </tr>
                    ) : calls.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          Aucun appel trouvé
                        </td>
                      </tr>
                    ) : (
                      calls.map((call) => (
                        <tr
                          key={call.callId}
                          className={`row ${selectedCallId === call.callId ? "active" : ""}`}
                          onClick={() => setSelectedCallId(call.callId === selectedCallId ? null : call.callId)}
                        >
                          <td className="small">
                            {new Date(call.dateHeure).toLocaleDateString("fr-FR")}
                            <br />
                            <span className="muted">
                              {new Date(call.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td>
                            <div style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {call.extractedAddress || call.locationInputText || "—"}
                            </div>
                          </td>
                          <td>
                            <span className={priorityBadge(call.triage?.priority)}>
                              {call.triage?.priority || "—"}
                            </span>
                          </td>
                          <td className="mono small">{call.duration || "—"}</td>
                          <td>
                            <span className={`badge ${call.status === "finished" ? "badgeStatusClosed" : "badgeStatusProgress"}`}>
                              {call.status === "finished" ? "Terminé" : call.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btnGhost"
                              style={{ fontSize: 11, padding: "5px 10px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                exportCallPdf(call.callId);
                              }}
                              disabled={pdfLoading}
                            >
                               PDF
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="pager" style={{ marginTop: 12 }}>
              <span>
                Page {page} / {totalPages}
              </span>
              <div className="pagerBtns">
                <button className="btn btnGhost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← Précédent
                </button>
                <button className="btn btnGhost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Suivant →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Detail Panel ──────────────────────────────────────────────────── */}
        {selectedCall && (
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="muted small">Détail de l'appel</div>
                <div className="cardTitle">
                  {selectedCall.extractedAddress || selectedCall.locationInputText || "Appel"}
                </div>
              </div>
              <button
                className="btn btnGhost"
                style={{ fontSize: 11, padding: "5px 10px" }}
                onClick={() => exportCallPdf(selectedCall.callId)}
                disabled={pdfLoading}
              >
                 Export PDF
              </button>
            </div>
            <div className="cardBody stack">
              {/* Call info */}
              <div>
                <div className="label">Informations</div>
                <div className="noteBox">
                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <div>
                      <span className="muted">ID:</span>{" "}
                      <span className="mono">{selectedCall.callId.slice(0, 12)}…</span>
                    </div>
                    <div>
                      <span className="muted">Date:</span>{" "}
                      {new Date(selectedCall.dateHeure).toLocaleString("fr-FR")}
                    </div>
                    <div>
                      <span className="muted">Durée:</span> {selectedCall.duration || "—"}
                    </div>
                    <div>
                      <span className="muted">Statut:</span>{" "}
                      <span className={`badge ${selectedCall.status === "finished" ? "badgeStatusClosed" : "badgeStatusProgress"}`}>
                        {selectedCall.status === "finished" ? "Terminé" : selectedCall.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Triage */}
              {selectedCall.triage && (
                <div>
                  <div className="label">Triage IA</div>
                  <div className="noteBox">
                    <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      <div>
                        <span className={priorityBadge(selectedCall.triage.priority)}>
                          {priorityLabel(selectedCall.triage.priority)}
                        </span>
                      </div>
                      <div>
                        <span className="muted">Confiance:</span>{" "}
                        {Math.round(selectedCall.triage.confidence * 100)}%
                      </div>
                      {selectedCall.triage.isVitalEmergency && (
                        <div style={{ color: "#c03346", fontWeight: 700 }}>
                          ️ URGENCE VITALE
                        </div>
                      )}
                      {selectedCall.triage.aiExplanation && (
                        <div style={{ marginTop: 6 }}>
                          <span className="muted">Résumé:</span>
                          <div className="noteText">{selectedCall.triage.aiExplanation}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Transcriptions */}
              <div>
                <div className="label">
                  Transcriptions ({selectedCall.transcriptionCount})
                </div>
                {selectedCall.transcriptions.length > 0 ? (
                  <div className="noteBox" style={{ maxHeight: 300, overflowY: "auto" }}>
                    {selectedCall.transcriptions.map((t, idx) => (
                      <div key={idx} style={{ marginBottom: 8 }}>
                        <div className="muted small">
                          {new Date(t.createdAt).toLocaleTimeString("fr-FR")}
                        </div>
                        <div className="noteText" style={{ marginTop: 2 }}>
                          {t.text}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="noteBox muted small">Aucune transcription</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MedlinkLayout>
  );
}
