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
      setTranscript("");

      console.log("🔌 Connexion WebSocket à:", WS_URL);
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log("✅ WebSocket connecté");
        setCallStatus("🟢 En ligne - Parlez maintenant");
        
        const msg = JSON.stringify({ type: "start_call" });
        console.log("📤 Envoi:", msg);
        wsRef.current?.send(msg);
      };

      wsRef.current.onmessage = (event) => {
        console.log("📥 Message reçu:", event.data);
        
        try {
          const message = JSON.parse(event.data);
          console.log("📦 Message parsé:", message);
          
          if (message.type === "partial_transcript") {
            const newText = message.payload.text;
            console.log("📝 Nouvelle transcription:", newText);
            
            setTranscript((prev) => {
              const updated = prev + " " + newText;
              console.log("📄 Transcription complète:", updated);
              return updated;
            });
          }
          
          if (message.type === "info") {
            console.log("ℹ️ Info:", message.payload.message);
            if (message.payload.callId) {
              console.log("🆔 Call ID:", message.payload.callId);
            }
          }
        } catch (e) {
          console.error("❌ Erreur parsing message:", e);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ Erreur WebSocket:", error);
        setCallStatus("❌ Erreur de connexion");
      };

      wsRef.current.onclose = (event) => {
        console.log("🔴 WebSocket fermé:", event.code, event.reason);
        setCallStatus("Appel terminé");
      };

      // Capture micro
      console.log("🎤 Demande accès micro...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ Micro autorisé");
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        console.log("⚠️  Fallback sur:", mimeType);
      }
      console.log("🎙️  Format audio:", mimeType);

      const mediaRecord = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecord;
      
      mediaRecord.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log(`🎵 Chunk audio disponible: ${event.data.size} bytes`);
          
          const arrayBuf = await event.data.arrayBuffer();
          
          // Envoie type puis données
          console.log("📤 Envoi: audio_chunk");
          wsRef.current.send(JSON.stringify({ type: "audio_chunk" }));
          
          console.log(`📤 Envoi: ${arrayBuf.byteLength} bytes audio`);
          wsRef.current.send(arrayBuf);
        } else {
          console.warn("⚠️  Impossible d'envoyer, WebSocket pas prêt");
        }
      };

      mediaRecord.onerror = (error) => {
        console.error("❌ Erreur MediaRecorder:", error);
      };
      
      // Chunks de 2 secondes
      console.log("▶️  Démarrage enregistrement (chunks 2s)");
      mediaRecord.start(2000);
      setRecording(true);
      
    } catch (error) {
      console.error('❌ Erreur startCall:', error);
      alert("Impossible d'accéder au microphone");
    }
  };
  
  const stopCall = () => {
    console.log("⏹️  Arrêt de l'enregistrement");
    
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(track => {
      track.stop();
      console.log("🛑 Track audio arrêté");
    });
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("📤 Envoi: end_call");
      wsRef.current.send(JSON.stringify({ type: "end_call" }));
      wsRef.current.close();
    }
    
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
          color: transcript ? "#000" : "#999",
          whiteSpace: "pre-wrap"
        }}>
          {transcript || "En attente... Parlez dans le micro."}
        </p>
      </div>

      {/* Console debug */}
      <div style={{ 
        marginTop: "20px", 
        padding: "10px", 
        background: "#f5f5f5",
        borderRadius: "8px",
        fontSize: "12px"
      }}>
        <strong>Debug:</strong> Ouvrez la console navigateur (F12) pour voir les logs détaillés
      </div>
    </div>
  );
}
