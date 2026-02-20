"use client";

import { useState, useRef, useEffect } from "react";
import MedlinkLayout from "../ui/MedlinkLayout";

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
      const wsUrl = process.env.NEXT_PUBLIC_WS_VOICE_URL || "ws://localhost:3003";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(" WebSocket connecté");
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

          // ️ PAUSE micro pendant que l'agent parle
          setAgentSpeaking(true);
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.pause();
            console.log("️ Micro mis en pause (agent parle)");
          }

          // Play agent audio
          try {
            const audioBlob = new Blob([Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))], { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.play().catch(err => {
              console.error(" Error playing audio:", err);
              setAgentSpeaking(false);
              if (mediaRecorderRef.current?.state === "paused") {
                mediaRecorderRef.current.resume();
              }
            });

            audio.onended = () => {
              console.log(" Audio terminé, reprise micro");
              setAgentSpeaking(false);
              if (mediaRecorderRef.current?.state === "paused") {
                mediaRecorderRef.current.resume();
                console.log("️ Micro réactivé");

                setTimeout(() => {
                  if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                  }
                }, 3000);
              }
              URL.revokeObjectURL(audioUrl);
            };

          } catch (error) {
            console.error(" Error decoding/playing audio:", error);
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
          console.log("️", message.payload.message);
        }
      };

      ws.onerror = (err) => {
        console.error(" WebSocket error:", err);
        setCallStatus("Erreur de connexion");
      };

      ws.onclose = () => {
        console.log(" WebSocket closed");
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
          console.log(` Sending complete audio: ${completeBlob.size} bytes`);

          const arrayBuf = await completeBlob.arrayBuffer();
          wsRef.current.send(arrayBuf);

          audioChunksRef.current = [];
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.stream.active) {
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'recording') {
              console.log(' Restarting recording cycle...');
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
      console.error(' Erreur:', error);
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
    <MedlinkLayout
      title="Centre d’assistance médicale"
      subtitle={`Appel vocal • ${recording ? "En cours" : "Prêt"}`}
      hideSidebar
    >
      <div className="medCenteredContent">
        <section className="grid">
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="muted">Etat de l'appel</div>
                <div className="cardTitle">Contrôle en direct</div>
              </div>
              <span className={`badge ${recording ? "badgeStatusProgress" : "badgeStatusNew"}`}>
                {recording ? "En cours" : "Disponible"}
              </span>
            </div>

            <div className="cardBody">
              <div className="noteBox">
                <div className="muted small">Statut</div>
                <div className="strong">{callStatus}</div>
                {agentSpeaking && <div className="noteText">️ L'agent parle...</div>}
                {recording && !agentSpeaking && <div className="noteText"> Vous parlez...</div>}
                {!recording && <div className="noteText">🟢 Prêt a lancer l'appel</div>}
              </div>

              <div className="btnRow">
                <button
                  className={`btn ${recording ? "btnRed" : "btnGreen"}`}
                  onClick={recording ? stopCall : startCall}
                  style={{ gridColumn: "1 / -1" }}
                >
                  {recording ? " Raccrocher" : " Appeler le 15"}
                </button>
              </div>
            </div>
          </div>

          <div className="rightCol">
            <div className="card">
              <div className="cardHead">
                <div>
                  <div className="muted">Conversation</div>
                  <div className="cardTitle">Echanges en direct</div>
                </div>
              </div>
              <div className="cardBody">
                {conversation.length === 0 ? (
                  <div className="muted small">Aucun message pour le moment.</div>
                ) : (
                  conversation.map((msg, idx) => (
                    <div className="noteBox" key={`${msg.role}-${idx}`}>
                      <div className="muted small">{msg.role === "patient" ? " Vous" : " Agent ARM"}</div>
                      <div className="noteText">{msg.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="cardHead">
                <div>
                  <div className="muted">Transcription</div>
                  <div className="cardTitle">Flux temps reel</div>
                </div>
              </div>
              <div className="cardBody">
                {transcript.trim() ? (
                  <div className="noteText">{transcript}</div>
                ) : (
                  <div className="muted small">La transcription apparait ici pendant l'appel.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

    </MedlinkLayout>
  );
}
