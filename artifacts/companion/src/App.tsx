import { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSendMessage } from "@workspace/api-client-react";
import { Live2DCanvas } from "@/components/Live2DCanvas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Volume2, VolumeX } from "lucide-react";
import NotFound from "@/pages/not-found";
import type { ChatMessage } from "@workspace/api-client-react";

const queryClient = new QueryClient();

function Home() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [expression, setExpression] = useState<string | null>(null);
  const [mouthValue, setMouthValue] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const talkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const sendMessageMutation = useSendMessage();

  // Animate mouth while speaking
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

  // Speak text using browser TTS + animate mouth
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.3;
    utter.volume = 1.0;

    // Try to pick a female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v =>
      /female|woman|girl|zira|susan|samantha|victoria|karen|moira|fiona|tessa/i.test(v.name)
    ) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (femaleVoice) utter.voice = femaleVoice;

    // Estimate duration from text length (avg ~12 chars/sec speaking)
    const estimatedDuration = Math.max((text.length / 12) * 1000, 1500);
    animateMouth(estimatedDuration);

    utter.onend = () => {
      if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
      setMouthValue(0);
    };
    speechRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [voiceEnabled, animateMouth]);

  const handleExpression = useCallback((expr: string | null) => {
    setExpression(expr);
    if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    if (expr) {
      expressionTimerRef.current = setTimeout(() => setExpression(null), 7000);
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || sendMessageMutation.isPending) return;

    const newUserMsg: ChatMessage = { role: "user", content: userInput.trim() };
    const currentHistory = [...chatHistory];
    setChatHistory([...currentHistory, newUserMsg]);
    setUserInput("");

    sendMessageMutation.mutate(
      { data: { message: newUserMsg.content, history: currentHistory } },
      {
        onSuccess: (response) => {
          handleExpression(response.expression || null);
          speak(response.reply);
          setChatHistory(prev => [...prev, { role: "assistant", content: response.reply }]);
        },
      }
    );
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, sendMessageMutation.isPending]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
      if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    };
  }, []);

  const expressions = [
    { id: "bbt", label: "Cute" },
    { id: "xxy", label: "Star ★" },
    { id: "lh", label: "Blush" },
    { id: "wh", label: "Wink" },
    { id: "y", label: "Dizzy" },
    { id: "h", label: "Sweat" },
    { id: "k", label: "Cry" },
    { id: "lzx", label: "Smirk" },
    { id: "mj", label: "Cool" },
    { id: "sq", label: "Soft" },
    { id: "dyj", label: "Glasses" },
    { id: "zs1", label: "Pose" },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-background overflow-hidden relative dark">
      {/* Ambient background glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[20%] w-[40%] h-[40%] rounded-full bg-pink-900/15 blur-[120px]" />
        <div className="absolute top-[30%] right-[-5%] w-[25%] h-[35%] rounded-full bg-indigo-900/15 blur-[100px]" />
      </div>

      {/* ── LEFT: Avatar panel ── */}
      <div className="flex-1 relative z-10 h-[58dvh] md:h-full flex flex-col min-w-0">
        {/* Header */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            <img src="/favicon.svg" alt="Alexia" className="w-full h-full object-cover bg-card" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white/90">Alexia</h1>
            <p className="text-[11px] text-purple-300/80 font-medium">AI Companion</p>
          </div>
        </div>

        {/* Voice toggle */}
        <button
          onClick={() => {
            setVoiceEnabled(v => !v);
            if (voiceEnabled) window.speechSynthesis?.cancel();
          }}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          title={voiceEnabled ? "Mute voice" : "Enable voice"}
        >
          {voiceEnabled
            ? <Volume2 className="w-4 h-4 text-purple-300/80" />
            : <VolumeX className="w-4 h-4 text-white/30" />
          }
        </button>

        {/* Live2D canvas */}
        <div className="flex-1 w-full h-full relative">
          <Live2DCanvas
            modelUrl="/models/Alexia/Alexia.model3.json"
            expression={expression}
            mouthValue={mouthValue}
          />
        </div>

        {/* Expression buttons */}
        <div className="absolute bottom-4 left-3 right-3 z-20 flex gap-1.5 flex-wrap justify-center">
          {expressions.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleExpression(expression === id ? null : id)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all backdrop-blur-sm cursor-pointer tracking-wide ${
                expression === id
                  ? "bg-purple-500/40 border-purple-400/60 text-purple-100"
                  : "bg-black/30 border-white/10 text-white/50 hover:bg-purple-900/30 hover:border-purple-500/40 hover:text-purple-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Chat panel ── */}
      <div className="w-full md:w-[380px] lg:w-[440px] h-[42dvh] md:h-full flex flex-col bg-black/40 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/8 z-10 shadow-[-8px_0_40px_rgba(0,0,0,0.3)]">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-white/40 uppercase">Whispers</h2>
          {sendMessageMutation.isPending && (
            <div className="flex items-center gap-1.5 text-xs text-purple-300/80">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Alexia is thinking...</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5" ref={scrollRef}>
          {chatHistory.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-40">
              <div className="w-14 h-14 rounded-full bg-purple-900/40 flex items-center justify-center border border-purple-500/20">
                <Send className="w-5 h-5 text-purple-300/70" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/70">Say hello to Alexia</p>
                <p className="text-xs mt-1 text-white/40 max-w-[200px]">She's listening and ready to chat with you.</p>
              </div>
            </div>
          )}

          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col max-w-[86%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <span className="text-[9px] text-white/25 mb-1 px-1 font-medium uppercase tracking-widest">
                {msg.role === "user" ? "You" : "Alexia"}
              </span>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-purple-600/25 text-white/90 border border-purple-500/25 rounded-tr-sm"
                    : "bg-white/8 text-white/85 border border-white/10 rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex flex-col max-w-[86%] mr-auto items-start">
              <span className="text-[9px] text-white/25 mb-1 px-1 font-medium uppercase tracking-widest">Alexia</span>
              <div className="px-4 py-3 rounded-2xl bg-white/8 border border-white/10 rounded-tl-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400/70 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/8 bg-black/20">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Whisper something to Alexia..."
              className="flex-1 bg-white/5 border-white/10 focus-visible:ring-purple-500/30 focus-visible:border-purple-500/40 h-11 rounded-full text-sm pl-4 pr-3 placeholder:text-white/20 text-white/80"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!userInput.trim() || sendMessageMutation.isPending}
              className="h-11 w-11 shrink-0 rounded-full bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 border border-purple-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </form>
        </div>
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
