import { useState, useRef, useEffect, FormEvent } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSendMessage } from "@workspace/api-client-react";
import { Live2DCanvas } from "@/components/Live2DCanvas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import type { ChatMessage } from "@workspace/api-client-react/src/generated/api.schemas";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Home() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [expression, setExpression] = useState<string | null>(null);
  const [mouthValue, setMouthValue] = useState(0);
  const [isTalking, setIsTalking] = useState(false);
  const talkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = useSendMessage();

  const startTalking = (durationMs: number) => {
    setIsTalking(true);
    let t = 0;
    if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
    talkingTimerRef.current = setInterval(() => {
      setMouthValue(Math.max(0, Math.sin(t * 12) * 0.8));
      t += 0.1;
    }, 50);
    setTimeout(() => {
      if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
      setMouthValue(0);
      setIsTalking(false);
    }, durationMs);
  };

  const handleExpression = (expr: string | null) => {
    setExpression(expr);
    if (expressionTimerRef.current) clearTimeout(expressionTimerRef.current);
    if (expr) {
      expressionTimerRef.current = setTimeout(() => {
        setExpression(null);
      }, 6000);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const newUserMessage: ChatMessage = { role: "user", content: userInput.trim() };
    const currentHistory = [...chatHistory];
    
    setChatHistory([...currentHistory, newUserMessage]);
    setUserInput("");

    sendMessageMutation.mutate(
      { data: { message: newUserMessage.content, history: currentHistory } },
      {
        onSuccess: (response) => {
          handleExpression(response.expression || null);
          startTalking(Math.max(response.reply.length * 60, 2000));
          setChatHistory(prev => [...prev, { role: "assistant", content: response.reply }]);
        }
      }
    );
  };

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [chatHistory, sendMessageMutation.isPending]);

  const expressions = ["bbt", "xxy", "y", "lh", "dyj", "h", "k"];

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-background overflow-hidden relative dark">
      {/* Background glow effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[30%] w-[30%] h-[30%] rounded-full bg-accent/10 blur-[100px]"></div>
      </div>

      <div className="flex-1 relative z-10 h-[60dvh] md:h-full flex flex-col">
        <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30 shadow-[0_0_15px_rgba(200,150,250,0.2)]">
            <img src="/favicon.svg" alt="Alexia" className="w-full h-full object-cover bg-card" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground/90 font-serif drop-shadow-md">Alexia</h1>
            <p className="text-xs text-primary/80 font-medium">Your Personal Companion</p>
          </div>
        </div>
        
        <div className="flex-1 w-full h-full relative">
          <Live2DCanvas 
            modelUrl="/models/Alexia/Alexia.model3.json"
            expression={expression}
            isTalking={isTalking}
            mouthValue={mouthValue}
          />
        </div>

        <div className="absolute bottom-6 left-6 z-20 flex gap-2 flex-wrap max-w-[80%]">
          {expressions.map(expr => (
            <button
              key={expr}
              onClick={() => handleExpression(expr)}
              className="px-3 py-1.5 text-xs font-medium bg-card/60 hover:bg-primary/20 border border-primary/20 rounded-full backdrop-blur-sm transition-all text-primary/80 hover:text-primary cursor-pointer uppercase tracking-wider"
            >
              {expr}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full md:w-[400px] lg:w-[480px] h-[40dvh] md:h-full flex flex-col bg-card/80 backdrop-blur-md border-t md:border-t-0 md:border-l border-border/50 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold text-sm tracking-wide text-foreground/80 uppercase">Whispers</h2>
          {sendMessageMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-primary/80">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Alexia is thinking...</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
          {chatHistory.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-primary/60" />
              </div>
              <div>
                <p className="text-sm font-medium">Say hello to Alexia</p>
                <p className="text-xs mt-1 max-w-[200px]">She's listening and ready to chat with you.</p>
              </div>
            </div>
          )}
          
          {chatHistory.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              <span className="text-[10px] text-muted-foreground/60 mb-1 ml-1 font-medium uppercase tracking-wider">
                {msg.role === 'user' ? 'You' : 'Alexia'}
              </span>
              <div 
                className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary/10 text-primary-foreground border border-primary/20 rounded-tr-sm' 
                    : 'bg-muted/40 text-foreground border border-border/50 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sendMessageMutation.isPending && (
            <div className="flex flex-col max-w-[85%] mr-auto items-start">
               <span className="text-[10px] text-muted-foreground/60 mb-1 ml-1 font-medium uppercase tracking-wider">Alexia</span>
               <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 rounded-tl-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }}></div>
               </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-card/50 border-t border-border/50 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Whisper something..."
              className="w-full pr-12 bg-background/50 border-border/60 focus-visible:ring-primary/40 focus-visible:border-primary/50 h-12 rounded-full shadow-inner text-sm pl-5 placeholder:text-muted-foreground/50"
              disabled={sendMessageMutation.isPending}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!userInput.trim() || sendMessageMutation.isPending}
              className="absolute right-1.5 h-9 w-9 rounded-full bg-primary/20 hover:bg-primary/40 text-primary border border-primary/20 transition-all hover:scale-105 active:scale-95"
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