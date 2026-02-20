'use client';

import { useEffect, useState } from 'react';

interface TriageReport {
  call_id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  summary: string;
  confidence: number;
  validated: boolean;
  created_at: string;
  call_info?: {
    call_timestamp: string;
    location_input_text: string;
    status: string;
  };
}

function priorityColor(priority: string) {
  switch (priority) {
    case 'P0': return 'bg-red-600 text-white';
    case 'P1': return 'bg-orange-500 text-white';
    case 'P2': return 'bg-yellow-500 text-black';
    case 'P3': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
}

function priorityLabel(priority: string) {
  switch (priority) {
    case 'P0': return 'URGENCE VITALE';
    case 'P1': return 'Urgence absolue';
    case 'P2': return 'Urgence relative';
    case 'P3': return 'Urgence dépassée';
    default: return priority;
  }
}

export default function TriageList() {
  const [reports, setReports] = useState<TriageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('http://localhost:3001/api/triage');
        const json = await res.json();

        if (json.success) {
          setReports(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();

    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(fetchReports, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement des rapports de triage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700"> Erreur: {error}</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        Aucun rapport de triage disponible
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-2xl font-bold mb-6"> Rapports de Triage IA</h2>

      {reports.map((report) => (
        <div
          key={report.call_id}
          className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Header avec priorité */}
          <div className="flex items-center justify-between mb-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${priorityColor(report.priority)}`}>
              {report.priority} - {priorityLabel(report.priority)}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(report.created_at).toLocaleString('fr-FR')}
            </span>
          </div>

          {/* Résumé IA */}
          <div className="mb-3">
            <p className="text-gray-800 font-medium">{report.summary}</p>
          </div>

          {/* Métadonnées */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {report.call_info?.location_input_text && (
              <span className="flex items-center gap-1">
                 {report.call_info.location_input_text}
              </span>
            )}
            <span className="flex items-center gap-1">
               Confiance: {Math.round(report.confidence * 100)}%
            </span>
            {report.validated ? (
              <span className="text-green-600 font-medium"> Validé</span>
            ) : (
              <span className="text-orange-600">️ Validation requise</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
