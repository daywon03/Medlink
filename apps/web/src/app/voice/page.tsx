"use client";
import { useEffect, useRef, useState } from "react";

export default function VoicePage() {
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [callStatus, setCallStatus] = useState<string>("Prêt à appeler");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: 'patient' | 'agent', text: string }>>([]);

  const WS_URL = process.env.NEXT_PUBLIC_API_URL || "ws://localhost:3002";

  const startCall = async () => {
    try {
      setCallStatus("Connexion au 15...");
      setTranscript("");

      console.log("🔌 Connexion WebSocket");
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log("✅ Connecté");
        setCallStatus("🟢 En ligne - Parlez maintenant");
        wsRef.current?.send(JSON.stringify({ type: "start_call" }));
      };

      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);

        // Handle patient speech transcript
        if (message.type === "patient_speech") {
          const patientText = message.payload.text;
          setTranscript((prev) => prev + "\n👤 Patient: " + patientText);
          setConversation(prev => [...prev, { role: 'patient', text: patientText }]);
        }

        // Handle agent speech with audio playback
        if (message.type === "agent_speech") {
          const agentText = message.payload.text;
          const audioBase64 = message.payload.audio;

          // Display agent text
          setTranscript((prev) => prev + "\n🤖 Agent ARM: " + agentText);
          setConversation(prev => [...prev, { role: 'agent', text: agentText }]);

          // Play audio if available
          if (audioBase64) {
            try {
              console.log("🔊 Playing agent audio...");

              // ✅ PAUSE MICRO pendant que l'agent parle
              setAgentSpeaking(true);
              if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.pause();
                console.log("⏸️  Micro en pause");
              }

              // Decode base64 to binary
              const binaryString = atob(audioBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              // Create blob and play
              const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);

              audio.play().catch(err => {
                console.error("❌ Error playing audio:", err);
                // Resume micro même en cas d'erreur
                setAgentSpeaking(false);
                if (mediaRecorderRef.current?.state === "paused") {
                  mediaRecorderRef.current.resume();
                }
              });

              // ✅ RESUME MICRO quand audio terminé
              audio.onended = () => {
                console.log("✅ Audio terminé, reprise micro");
                setAgentSpeaking(false);
                if (mediaRecorderRef.current?.state === "paused") {
                  mediaRecorderRef.current.resume();
                  console.log("▶️  Micro réactivé");

                  // ✅ IMPORTANT: Redémarrer le cycle stop/start
                  setTimeout(() => {
                    if (mediaRecorderRef.current?.state === 'recording') {
                      mediaRecorderRef.current.stop();
                    }
                  }, 3000);
                }
                URL.revokeObjectURL(audioUrl);
              };

            } catch (error) {
              console.error("❌ Error decoding/playing audio:", error);
              // Resume micro en cas d'erreur
              setAgentSpeaking(false);
              if (mediaRecorderRef.current?.state === "paused") {
                mediaRecorderRef.current.resume();
              }
            }
          }
        }

        // Handle partial transcript (kept for backward compatibility)
        if (message.type === "partial_transcript") {
          const newText = message.payload.text;
          setTranscript((prev) => prev + " " + newText);
        }

        if (message.type === "info") {
          console.log("ℹ️", message.payload.message);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ Erreur WebSocket:", error);
        setCallStatus("❌ Erreur de connexion");
      };

      wsRef.current.onclose = () => {
        setCallStatus("Appel terminé");
      };

      // Capture micro
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecord.onstop = async () => {
        if (audioChunksRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Create complete WebM blob from accumulated chunks
          const completeBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log(`🎵 Sending complete audio: ${completeBlob.size} bytes`);

          const arrayBuf = await completeBlob.arrayBuffer();
          wsRef.current.send(arrayBuf);

          // Clear chunks for next recording
          audioChunksRef.current = [];
        }

        // IMPORTANT: Toujours redémarrer l'enregistrement si le MediaRecorder existe et n'est pas intentionnellement arrêté
        // On vérifie que le MediaRecorder existe toujours (pas supprimé par stopCall)
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream.active) {
          // Attendre un peu avant de redémarrer (éviter spam)
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'recording') {
              console.log('🔄 Restarting recording cycle...');
              mediaRecorderRef.current.start();

              // Reprogrammer le prochain stop après 3 secondes
              setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
              }, 3000);
            }
          }, 100);
        }
      };

      // Start recording
      mediaRecord.start();

      // Stop after 3 seconds to trigger onstop and send accumulated data
      setTimeout(() => {
        if (mediaRecord.state === 'recording') {
          mediaRecord.stop();
        }
      }, 3000);

      setRecording(true);

    } catch (error) {
      console.error('❌ Erreur:', error);
      alert("Impossible d'accéder au microphone");
    }
  };

  const stopCall = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

    if (wsRef.current?.readyState === WebSocket.OPEN) {
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
        {agentSpeaking && (
          <p style={{ color: "#2196f3", fontSize: "16px", margin: "10px 0" }}>
            🤖 Agent ARM parle... (micro en pause)
          </p>
        )}
        {recording && !agentSpeaking && (
          <p style={{ color: "#4caf50", fontSize: "16px", margin: "10px 0" }}>
            🎤 À votre tour de parler (chunks 2s)
          </p>
        )}
      </div>

      {/* Conversation History */}
      {conversation.length > 0 && (
        <div style={{
          maxWidth: "800px",
          margin: "20px auto",
          padding: "20px",
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          maxHeight: "400px",
          overflowY: "auto",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>📝 Historique de conversation</h3>
          {conversation.map((msg, idx) => (
            <div key={idx} style={{
              padding: "12px 16px",
              margin: "10px 0",
              borderRadius: "8px",
              backgroundColor: msg.role === 'agent' ? '#e3f2fd' : '#fff3e0',
              border: msg.role === 'agent' ? '2px solid #2196f3' : '2px solid #ff9800'
            }}>
              <strong style={{ color: msg.role === 'agent' ? '#1565c0' : '#e65100', fontSize: '14px' }}>
                {msg.role === 'agent' ? '🤖 Agent ARM:' : '👤 Patient:'}
              </strong>
              <p style={{ margin: '8px 0 0 0', color: '#212121', fontSize: '15px', lineHeight: '1.5' }}>{msg.text}</p>
            </div>
          ))}
        </div>
      )}

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
          {transcript || "En attente..."}
        </p>
      </div>
    </div >
  );
}
