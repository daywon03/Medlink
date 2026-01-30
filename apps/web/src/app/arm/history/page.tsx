"use client";

import { useState, useEffect } from "react";
import MedlinkLayout from "../../ui/MedlinkLayout"; 
import { jsPDF } from "jspdf";

// 1. On déplace les types à l'extérieur du composant pour la clarté
type Hospital = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  distance?: number;
  id?: string;
  type?: string;
};

interface Incident {
  id: string;
  createdAt: string;
  createdAtRaw: string;
  updatedAtRaw?: string;
  status: 'nouveau' | 'en_cours' | 'terminé';
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  locationLabel: string;
  lat: number;
  lng: number;
  symptoms: string[];
  notes: string;
  nearestHospital?: Hospital;
  eta?: number | null;
  isActive?: boolean;
}

export default function HistoryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch('http://localhost:3001/api/calls/closed');
        const result = await response.json();
        
        if (result.success) {
          setIncidents(result.data);
        }
      } catch (error) {
        console.error("Erreur de récupération:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const getPriorityClass = (p: number) => {
    if (p <= 1) return "badgePrioHigh";
    if (p <= 3) return "badgePrioMedium";
    return "badgePrioLow";
  };

  const generateHistoryPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();

    // Configuration du style
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185); // Bleu MedLink
    doc.text("Rapport d'Interventions - MedLink", 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Généré le : ${dateStr}`, 20, 30);
    doc.text(`Nombre d'incidents : ${incidents.length}`, 20, 37);

    // Ligne de séparation
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    let yPos = 55;

    // Boucle sur les incidents
    incidents.forEach((inc, index) => {
      if (yPos > 270) { // Nouvelle page si plus de place
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`${index + 1}. [${inc.id.substring(0, 8)}] - ${inc.title}`, 20, yPos);
      
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Lieu : ${inc.locationLabel} | Priorité : P${inc.priority}`, 25, yPos + 7);
      doc.text(`Notes : ${inc.notes || "Aucune note"}`, 25, yPos + 12);
      
      yPos += 22; // Espace entre chaque incident
    });

    // Téléchargement
    doc.save(`MedLink_Historique_${dateStr.replace(/\//g, '-')}.pdf`);
  };

  return (
    <MedlinkLayout title="Historique" subtitle="Archives des appels">
      <div className="dashboard">
        <section className="grid">
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="cardHead">
              <div className="cardTitle">File des archives</div>
              <button className="btn btnBlue" onClick={generateHistoryPDF}>
                Exporter PDF
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
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="empty">Chargement...</td></tr>
                  ) : incidents.length > 0 ? (
                    incidents.map((i) => (
                      <tr key={i.id} className="row">
                        <td className="mono strong">{i.id.substring(0, 8)}</td>
                        <td className="strong">{i.title}</td>
                        <td className="muted">{i.locationLabel}</td>
                        <td>
                          <span className={`badge ${getPriorityClass(i.priority)}`}>
                            P{i.priority}
                          </span>
                        </td>
                        <td className="muted">{i.createdAt}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="empty">Aucun incident archivé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </MedlinkLayout>
  );
}