import { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSendMessage } from "@workspace/api-client-react";
import { Live2DCanvas } from "@/components/Live2DCanvas";
import { Input } from "@/components/ui/input";
import { Volume2, VolumeX, Mic, MicOff, Send, Video, Play } from "lucide-react";
import NotFound from "@/pages/not-found";
import type { ChatMessage } from "@workspace/api-client-react";

const queryClient = new QueryClient();

function Home() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [expression, setExpression] = useState<string | null>(null);
  const [mouthValue, setMouthValue] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const talkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessageMutation = useSendMessage();

  const animateMouth = useCallback((durationMs: number) => {
    let t = 0;
    if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
    talkingTimerRef.current = setInterval(() => {
      setMouthValue(Math.abs(Math.sin(t * 10)) * 0.9);
      t += 0.1;
    }, 50);
    setTimeout(() => {
      if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
      setMouthValue(0);
    }, durationMs);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.35;
    utter.volume = 1.0;

    const pickVoice = (voices: SpeechSynthesisVoice[]) => {
      // Priority: Google UK English Female → Google US English Female → any Google female → any English female
      return (
        voices.find(v => /google uk english female/i.test(v.name)) ||
        voices.find(v => /google us english female/i.test(v.name)) ||
        voices.find(v => /google.*female/i.test(v.name)) ||
        voices.find(v => /zira|samantha|victoria|karen|moira|fiona|tessa/i.test(v.name)) ||
        voices.find(v => /female|woman|girl/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith("en-")) ||
        voices[0]
      );
    };

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const voice = pickVoice(voices);
      if (voice) utter.voice = voice;
      const estimatedDuration = Math.max((text.length / 12) * 1000, 1500);
      animateMouth(estimatedDuration);
      utter.onend = () => {
        if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
        setMouthValue(0);
      };
      speechRef.current = utter;
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => doSpeak();
    }
  }, [voiceEnabled, animateMouth]);

  const handleExpression = useCallback((expr: string | null) => {
    setExpression(expr);
    if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    if (expr) {
      expressionTimerRef.current = setTimeout(() => setExpression(null), 8000);
    }
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || sendMessageMutation.isPending) return;
    const newUserMsg: ChatMessage = { role: "user", content: text.trim() };
    const currentHistory = [...chatHistory];
    setChatHistory([...currentHistory, newUserMsg]);
    setUserInput("");

    sendMessageMutation.mutate(
      { data: { message: newUserMsg.content, history: currentHistory } },
      {
        onSuccess: (response) => {
          handleExpression(response.expression || null);
          speak(response.reply);
          setLastReply(response.reply);
          setChatHistory(prev => [...prev, { role: "assistant", content: response.reply }]);
        },
        onError: () => {
          const errMsg = "Abhi mujhe setup karna baaki hai babe 🙈 Pehle GEMINI_API_KEY add karo Secrets mein!";
          setLastReply(errMsg);
          handleExpression("h");
          setChatHistory(prev => [...prev, { role: "assistant", content: errMsg }]);
        },
      }
    );
  }, [chatHistory, sendMessageMutation, handleExpression, speak]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(userInput);
  };

  // Voice input (speech recognition)
  const handleMicToggle = useCallback(() => {
    type SR = {
      new(): {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start(): void;
      };
    };
    const win = window as typeof window & { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening, sendMessage]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
      if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    };
  }, []);

  const lastUserMsg = [...chatHistory].reverse().find(m => m.role === "user");

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden dark" style={{ background: "#0d0a1a" }}>
      {/* Ambient glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[55%] h-[55%] rounded-full opacity-30" style={{ background: "radial-gradient(circle, #5b21b6 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[-10%] right-[10%] w-[45%] h-[45%] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      {/* ── HEADER ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 shadow-lg" style={{ background: "linear-gradient(135deg, #4c1d95, #6d28d9)", borderColor: "rgba(167,139,250,0.4)" }}>
            🐱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base tracking-tight">Alexia</span>
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
            </div>
            <span className="text-xs font-medium" style={{ color: "rgba(196,181,253,0.7)" }}>AI Companion</span>
          </div>
        </div>

        <button
          onClick={() => {
            setVoiceEnabled(v => !v);
            if (voiceEnabled) window.speechSynthesis?.cancel();
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center border transition-all"
          style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }}
          title={voiceEnabled ? "Mute voice" : "Enable voice"}
        >
          {voiceEnabled
            ? <Volume2 className="w-4 h-4" style={{ color: "rgba(196,181,253,0.8)" }} />
            : <VolumeX className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          }
        </button>
      </div>

      {/* ── AVATAR (full screen) ── */}
      <div className="absolute inset-0 z-10">
        <Live2DCanvas
          modelUrl="/models/Alexia/Alexia.model3.json"
          expression={expression}
          mouthValue={mouthValue}
        />
      </div>

      {/* ── BOTTOM OVERLAY ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>

        {/* Chat bubble - Alexia's last reply */}
        {(lastReply || sendMessageMutation.isPending) && (
          <div className="px-4 pb-3">
            <div
              className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[90%]"
              style={{
                background: "rgba(13,10,26,0.82)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {sendMessageMutation.isPending ? (
                <span className="flex items-center gap-1.5" style={{ color: "rgba(196,181,253,0.7)" }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : (
                lastReply
              )}
            </div>
          </div>
        )}

        {/* User last message bubble */}
        {lastUserMsg && !sendMessageMutation.isPending && (
          <div className="px-4 pb-2 flex justify-end">
            <div
              className="rounded-2xl px-4 py-2 text-sm max-w-[75%]"
              style={{
                background: "rgba(109,40,217,0.85)",
                backdropFilter: "blur(12px)",
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {lastUserMsg.content}
            </div>
          </div>
        )}

        {/* Control buttons row */}
        <div className="flex items-center justify-center gap-5 pb-3 pt-1">
          <button
            className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}
            title="Video (coming soon)"
          >
            <Video className="w-5 h-5" style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>

          <button
            onClick={() => {
              setVoiceEnabled(v => !v);
              if (voiceEnabled) window.speechSynthesis?.cancel();
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}
            title={voiceEnabled ? "Mute" : "Unmute"}
          >
            {voiceEnabled
              ? <Volume2 className="w-5 h-5" style={{ color: "rgba(255,255,255,0.6)" }} />
              : <VolumeX className="w-5 h-5" style={{ color: "rgba(255,255,255,0.3)" }} />
            }
          </button>

          <button
            onClick={handleMicToggle}
            className="w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all active:scale-95 shadow-lg"
            style={{
              background: isListening
                ? "linear-gradient(135deg, #7c3aed, #9f1fe8)"
                : "linear-gradient(135deg, #6d28d9, #7c3aed)",
              borderColor: isListening ? "rgba(196,181,253,0.6)" : "rgba(139,92,246,0.5)",
              boxShadow: isListening ? "0 0 24px rgba(124,58,237,0.7)" : "0 0 16px rgba(109,40,217,0.4)",
            }}
            title={isListening ? "Listening..." : "Speak"}
          >
            {isListening
              ? <Mic className="w-7 h-7 text-white animate-pulse" />
              : <Mic className="w-7 h-7 text-white" />
            }
          </button>

          <button
            onClick={() => sendMessage(userInput || "Continue...")}
            disabled={sendMessageMutation.isPending}
            className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-all active:scale-95 disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}
            title="Send"
          >
            <Play className="w-5 h-5" style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>
        </div>

        {/* Input field */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-4">
          <input
            ref={inputRef}
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder="Ask Anything..."
            disabled={sendMessageMutation.isPending}
            className="flex-1 h-12 rounded-2xl px-4 text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              caretColor: "#a78bfa",
            }}
            onFocus={e => {
              (e.target as HTMLInputElement).style.borderColor = "rgba(139,92,246,0.5)";
            }}
            onBlur={e => {
              (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          />
          <button
            type="submit"
            disabled={!userInput.trim() || sendMessageMutation.isPending}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            style={{
              background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
              boxShadow: "0 0 12px rgba(109,40,217,0.4)",
            }}
          >
            <Send className="w-4 h-4 text-white ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
