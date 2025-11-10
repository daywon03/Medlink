"use client";
import { useEffect, useRef, useState } from "react";

export default function VoicePage() {
    const wsRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState<string>("");

    // Utiliser la variable d'environnement
    const WS_URL = process.env.NEXT_PUBLIC_API_URL || "ws://localhost:3002";
    console.log("Using WS_URL:", WS_URL);

    // Initialisation WebSocket
    useEffect(() => {
        if (!wsRef.current && !recording) {
            wsRef.current = new WebSocket("ws://localhost:3002");
            
            wsRef.current.onopen = () => {
                console.log("WebSocket connection opened");
            };

            wsRef.current.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === "partial_transcript") {
                    setTranscript((prev) => prev + " " + message.payload.text);
                }
                if (message.type === "info") {
                    console.log("Info from server:", message.payload);
                }
            };
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [recording, WS_URL]);

    const startCall = async () => {
        try {
            // Détection du format supporté
            let mimeType = 'audio/webm';
            
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                mimeType = 'audio/ogg';
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecord = new MediaRecorder(stream, { 
                mimeType,
                audioBitsPerSecond: 128000
            });

            console.log('Format audio utilisé:', mimeType);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ 
                    type: "start_call",
                    payload: {
                        citizenId: "demo-citizen-uuid",
                        location_input_text: "12 rue de la paix, Paris",
                    }
                }));
            }

            mediaRecorderRef.current = mediaRecord;
            
            mediaRecord.ondataavailable = async (event) => {
                if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                    const arrayBuf = await event.data.arrayBuffer();
                    wsRef.current.send(JSON.stringify({type: "audio_chunk"}));
                    wsRef.current.send(arrayBuf);
                }
            };
            
            mediaRecord.start(2000);
            setRecording(true);
        } catch (error) {
            console.error('Erreur MediaRecorder:', error);
            alert('Erreur: impossible d\'accéder au microphone');
        }
    };
    
    const stopCall = () => {
        mediaRecorderRef.current?.stop();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "end_call" }));
        }
        setRecording(false);
    };

    return (
        <div style={{ padding: "20px" }}>
            <h1>Appel d'urgence - Transcription</h1>
            <div style={{display: "flex", gap: 8}}>
                {!recording ? (
                    <button onClick={startCall}>Démarrer</button>
                ) : (
                    <button onClick={stopCall}>Arrêter</button>
                )}
            </div>
            <h3>Transcription:</h3>
            <pre>{transcript}</pre>
        </div>
    );
}