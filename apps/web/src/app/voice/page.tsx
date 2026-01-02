"use client";

import { useState, useRef, useEffect } from "react";

export default function VoicePage() {
  const [recording, setRecording] = useState(false);
  const [callStatus, setCallStatus] = useState("Prêt à appeler");
  const [transcript, setTranscript] = useState("");
  const [conversation, setConversation] = useState<{ role: string; text: string }[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startCall = async () => {
    try {
      // Connect WebSocket
      const ws = new WebSocket("ws://localhost:3002");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connecté");
        ws.send(JSON.stringify({ type: "start_call" }));
        setCallStatus("Connexion établie");
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        // Handle greeting
        if (message.type === "greeting") {
          setConversation(prev => [...prev, {
            role: "agent",
            text: message.payload.text
          }]);
        }

        // Handle patient speech
        if (message.type === "patient_speech") {
          setConversation(prev => [...prev, {
            role: "patient",
            text: message.payload.text
          }]);
        }

        // Handle agent speech
        if (message.type === "agent_speech") {
          const agentText = message.payload.text;
          const audioBase64 = message.payload.audio;

          setConversation(prev => [...prev, {
            role: "agent",
            text: agentText
          }]);

          // ⏸️ PAUSE micro pendant que l'agent parle
          setAgentSpeaking(true);
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.pause();
            console.log("⏸️ Micro mis en pause (agent parle)");
          }

          // Play agent audio
          try {
            const audioBlob = new Blob([Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.play().catch(err => {
              console.error("❌ Error playing audio:", err);
              setAgentSpeaking(false);
              if (mediaRecorderRef.current?.state === "paused") {
                mediaRecorderRef.current.resume();
              }
            });

            audio.onended = () => {
              console.log("✅ Audio terminé, reprise micro");
              setAgentSpeaking(false);
              if (mediaRecorderRef.current?.state === "paused") {
                mediaRecorderRef.current.resume();
                console.log("▶️ Micro réactivé");

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
            setAgentSpeaking(false);
            if (mediaRecorderRef.current?.state === "paused") {
              mediaRecorderRef.current.resume();
            }
          }
        }

        if (message.type === "partial_transcript") {
          const newText = message.payload.text;
          setTranscript((prev) => prev + " " + newText);
        }

        if (message.type === "info") {
          console.log("ℹ️", message.payload.message);
        }
      };

      ws.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
        setCallStatus("Erreur de connexion");
      };

      ws.onclose = () => {
        console.log("🔴 WebSocket closed");
        setCallStatus("Déconnecté");
      };

      // Start microphone capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
        },
      });

      const mimeType = "audio/webm;codecs=opus";
      const mediaRecord = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecord;

      mediaRecord.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecord.onstop = async () => {
        if (audioChunksRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const completeBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log(`🎵 Sending complete audio: ${completeBlob.size} bytes`);

          const arrayBuf = await completeBlob.arrayBuffer();
          wsRef.current.send(arrayBuf);

          audioChunksRef.current = [];
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.stream.active) {
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'recording') {
              console.log('🔄 Restarting recording cycle...');
              mediaRecorderRef.current.start();

              setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
              }, 3000);
            }
          }, 100);
        }
      };

      mediaRecord.start();

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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        background: "white",
        borderRadius: "24px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        padding: "40px",
        maxWidth: "600px",
        width: "100%"
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: "30px"
        }}>
          <div style={{
            fontSize: "48px",
            marginBottom: "10px"
          }}>🚑</div>
          <h1 style={{
            fontSize: "32px",
            fontWeight: "700",
            color: "#1a1a1a",
            margin: "0 0 10px 0"
          }}>Urgences Médicales</h1>
          <p style={{
            color: "#666",
            fontSize: "16px",
            margin: 0
          }}>Service d'aide médicale - 15</p>
        </div>

        <div style={{
          padding: "20px",
          background: recording ? "#af2338ff" : "#099e16ff",
          borderRadius: "12px",
          marginBottom: "20px",
          textAlign: "center",
          color: "white",
          fontWeight: "600",
          fontSize: "18px"
        }}>
          {recording ? "🔴 Appel en cours" : "🟢 Prêt à appeler"}
        </div>

        {agentSpeaking && (
          <div style={{
            padding: "15px",
            background: "#2196f3",
            color: "white",
            borderRadius: "12px",
            marginBottom: "20px",
            textAlign: "center",
            fontWeight: "600"
          }}>
            🗣️ L'agent parle...
          </div>
        )}

        {recording && !agentSpeaking && (
          <div style={{
            padding: "15px",
            background: "#4caf50",
            color: "white",
            borderRadius: "12px",
            marginBottom: "20px",
            textAlign: "center",
            fontWeight: "600"
          }}>
            🎤 Vous parlez...
          </div>
        )}

        {conversation.length > 0 && (
          <div style={{
            marginBottom: "20px",
            maxHeight: "300px",
            overflowY: "auto",
            background: "#f5f5f5",
            borderRadius: "12px",
            padding: "15px"
          }}>
            {conversation.map((msg, idx) => (
              <div key={idx} style={{
                marginBottom: "12px",
                padding: "12px",
                background: msg.role === "patient" ? "#e3f2fd" : "#fff3e0",
                borderRadius: "8px",
                borderLeft: `4px solid ${msg.role === "patient" ? "#2196f3" : "#ff9800"}`
              }}>
                <div style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: msg.role === "patient" ? "#1976d2" : "#f57c00",
                  marginBottom: "4px"
                }}>
                  {msg.role === "patient" ? "👤 Vous" : "🚑 Agent ARM"}
                </div>
                <div style={{ fontSize: "14px", color: "#333" }}>{msg.text}</div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={recording ? stopCall : startCall}
          style={{
            width: "100%",
            padding: "18px",
            fontSize: "18px",
            fontWeight: "700",
            color: "white",
            background: recording
              ? "linear-gradient(135deg, #e53935 0%, #c62828 100%)"
              : "linear-gradient(135deg, #43a047 0%, #2e7d32 100%)",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            transition: "all 0.3s ease"
          }}
        >
          {recording ? "📞 Raccrocher" : "📞 Appeler le 15"}
        </button>
      </div>
    </div>
  );
}
