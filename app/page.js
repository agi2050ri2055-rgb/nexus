"use client";

import { useState, useEffect, useRef } from "react";
import { loadMessages, saveMessage, supabase } from "@/lib/supabase";

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SpeakerIcon({ on }) {
  return on ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [speakEnabled, setSpeakEnabled] = useState(true);

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load persisted conversation history on first render.
  useEffect(() => {
    setMounted(true);
    (async () => {
      const history = await loadMessages();
      setMessages(history);
      setHistoryLoaded(true);
    })();
  }, []);

  // Auto-scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Set up speech recognition once, if the browser supports it.
  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognitionCtor) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN"; // change to your preferred locale if needed
      recognitionRef.current = recognition;
    } else {
      setVoiceSupported(false);
    }
  }, []);

  // Attach the camera stream to the <video> element once it's mounted.
  useEffect(() => {
    if (isCameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOn]);

  // Stop the camera if the user navigates away without closing it.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speak = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (rawText) => {
    const trimmed = (rawText || "").trim();
    if (!trimmed) return;

    const userMsg = { role: "user", content: trimmed, created_at: new Date().toISOString() };
    const historySoFar = [...messages, userMsg];
    setMessages(historySoFar);
    saveMessage("user", trimmed);
    setInput("");
    setIsLoading(true);

    try {
      const historyForApi = historySoFar
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "I didn't get a response there — try again.";

      const assistantMsg = { role: "assistant", content: reply, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);
      saveMessage("assistant", reply);
      if (speakEnabled) speak(reply);
    } catch (err) {
      console.error(err);
      const errMsg = {
        role: "assistant",
        content: "I ran into a connection issue reaching the backend — check your API keys and try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const toggleMic = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    // Attach handlers fresh each time so they always see current state.
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    setInput("");
    setCameraError("");
    setIsListening(true);
    try {
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const toggleCamera = async () => {
    if (isCameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsCameraOn(false);
      return;
    }

    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setIsCameraOn(true);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera permission was denied, or no camera is available.");
    }
  };

  const handleCaptureAndAsk = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg", 0.85);

    const question = input.trim();
    const userLabel = question || "[Captured a frame from the camera]";
    const userMsg = { role: "user", content: userLabel, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    saveMessage("user", userLabel);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, question }),
      });
      const data = await res.json();
      const description = data.description || data.error || "I couldn't process that image.";

      const assistantMsg = { role: "assistant", content: description, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);
      saveMessage("assistant", description);
      if (speakEnabled) speak(description);
    } catch (err) {
      console.error(err);
      const errMsg = {
        role: "assistant",
        content: "I had trouble analyzing that image — check the connection and try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const presenceState = isListening ? "listening" : isLoading ? "thinking" : isCameraOn ? "seeing" : "idle";
  const supabaseConfigured = !!supabase;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className={`presence-ring ${presenceState}`}>
            <div className="presence-core" />
          </div>
          <div className="brand-text">
            <span className="brand-name">NEXUS</span>
            <span className="brand-sub">Enterprise AI Assistant</span>
          </div>
        </div>
        <div className="status-chip">
          <span className={`dot ${mounted ? "dot-live" : "dot-off"}`} />
          {mounted ? "Session active" : "Starting…"}
        </div>
      </header>

      <div className="body-grid">
        <aside className="sidebar">
          <div className="sidebar-section">
            <span className="sidebar-label">Session</span>
            <div className="sidebar-row">
              <span>Memory</span>
              <span>{supabaseConfigured ? `${messages.length} recalled` : "Not connected"}</span>
            </div>
            <div className="sidebar-row">
              <span>Voice</span>
              <span>{voiceSupported ? (isListening ? "Listening…" : "Ready") : "Unsupported"}</span>
            </div>
            <div className="sidebar-row">
              <span>Camera</span>
              <span>{isCameraOn ? "Active" : "Ready"}</span>
            </div>
            <div className="sidebar-row">
              <span>Reply audio</span>
              <span>{speakEnabled ? "On" : "Off"}</span>
            </div>
          </div>
          <div className="sidebar-section">
            <span className="sidebar-label">Capabilities</span>
            <div className="capability-chips">
              <span className="capability-chip">Voice input</span>
              <span className="capability-chip">Live vision</span>
              <span className="capability-chip">Persistent memory</span>
            </div>
          </div>
        </aside>

        <main className="chat-main">
          <div className="message-log">
            {!historyLoaded && <div className="log-hint">Loading memory…</div>}
            {historyLoaded && messages.length === 0 && (
              <div className="log-hint">
                No conversation yet — say hello, or try &ldquo;introduce yourself to the board&rdquo;.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id || i} className={`message-row ${m.role}`}>
                <div className="message-meta">
                  <span className="message-role">{m.role === "user" ? "YOU" : "NEXUS"}</span>
                  <span className="message-time">{formatTime(m.created_at)}</span>
                </div>
                <div className="message-bubble">{m.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row assistant">
                <div className="message-meta">
                  <span className="message-role">NEXUS</span>
                </div>
                <div className="message-bubble typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isCameraOn && (
            <div className="camera-panel">
              <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className="camera-controls">
                <button onClick={handleCaptureAndAsk} className="btn btn-accent" disabled={isLoading}>
                  Capture &amp; describe
                </button>
                <button onClick={toggleCamera} className="btn btn-ghost">
                  Close camera
                </button>
              </div>
            </div>
          )}
          {cameraError && <div className="inline-error">{cameraError}</div>}

          <div className="input-bar">
            <button
              onClick={toggleMic}
              className={`icon-btn ${isListening ? "active" : ""}`}
              disabled={!voiceSupported}
              title={voiceSupported ? "Voice input" : "Voice input not supported in this browser — try Chrome or Edge"}
              type="button"
            >
              <MicIcon />
            </button>
            <button
              onClick={toggleCamera}
              className={`icon-btn ${isCameraOn ? "active" : ""}`}
              title="Camera"
              type="button"
            >
              <CameraIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder={
                isListening ? "Listening…" : 'Message Nexus — or try "introduce yourself to the board"'
              }
              className="text-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="btn btn-accent send-btn"
              type="button"
            >
              Send
            </button>
            <button
              onClick={() => setSpeakEnabled((v) => !v)}
              className={`icon-btn ${speakEnabled ? "active" : ""}`}
              title="Toggle spoken replies"
              type="button"
            >
              <SpeakerIcon on={speakEnabled} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
