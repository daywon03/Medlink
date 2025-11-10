// apps/web/app/voice/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";

export default function VoicePage() {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [callStatus, setCallStatus] = useState<string>("Prêt à appeler");

  const WS_URL = process.env.NEXT_PUBLIC_API_URL || "ws://localhost:3002";

  const startCall = async () => {
    try {
      setCallStatus("Connexion au 15...");

      // 1. Connexion WebSocket
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log("✅ Connecté au 15");
        setCallStatus("🟢 En ligne avec le 15");

        // 2. Démarrer l'appel (pas d'infos nécessaires)
        wsRef.current?.send(JSON.stringify({
          type: "start_call"
        }));
      };

      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === "partial_transcript") {
          setTranscript((prev) => prev + " " + message.payload.text);
        }
        
        if (message.type === "info") {
          console.log("📢 Info:", message.payload.message);
        }
      };

      wsRef.current.onerror = () => {
        setCallStatus("❌ Erreur de connexion");
      };

      wsRef.current.onclose = () => {
        setCallStatus("Appel terminé");
      };

      // 3. Capture micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }

      const mediaRecord = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecord;
      
      mediaRecord.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const arrayBuf = await event.data.arrayBuffer();
          wsRef.current.send(JSON.stringify({ type: "audio_chunk" }));
          wsRef.current.send(arrayBuf);
        }
      };
      
      mediaRecord.start(2000);
      setRecording(true);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      alert("Impossible d'accéder au microphone. Autorisez l'accès dans votre navigateur.");
    }
  };
  
  const stopCall = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_call" }));
    }
    
    wsRef.current?.close();
    setRecording(false);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center" }}>🚨 Urgences Médicales</h1>
      
      <div style={{ 
        padding: "20px", 
        background: recording ? "#ffebee" : "#e8f5e9", 
        borderRadius: "12px",
        marginBottom: "20px",
        textAlign: "center"
      }}>
        <h2>{callStatus}</h2>
        {recording && (
          <p style={{ color: "#d32f2f", fontSize: "18px", margin: "10px 0" }}>
            🔴 Enregistrement en cours...
          </p>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        {!recording ? (
          <button 
            onClick={startCall}
            style={{
              padding: "20px 40px",
              fontSize: "24px",
              background: "#d32f2f",
              color: "white",
              border: "none",
              borderRadius: "50px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(211, 47, 47, 0.4)"
            }}
          >
            📞 Appeler le 15
          </button>
        ) : (
          <button 
            onClick={stopCall}
            style={{
              padding: "20px 40px",
              fontSize: "24px",
              background: "#424242",
              color: "white",
              border: "none",
              borderRadius: "50px",
              cursor: "pointer"
            }}
          >
            ⏹️ Raccrocher
          </button>
        )}
      </div>

      <div style={{ 
        background: "#fff", 
        padding: "20px", 
        borderRadius: "12px",
        border: "1px solid #ddd",
        minHeight: "200px"
      }}>
        <h3>📝 Transcription en temps réel</h3>
        <p style={{ 
          fontSize: "16px",
          lineHeight: "1.8",
          color: transcript ? "#000" : "#999"
        }}>
          {transcript || "Dites votre adresse et décrivez la situation..."}
        </p>
      </div>
    </div>
  );
}
