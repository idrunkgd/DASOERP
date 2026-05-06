"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next); setInput(""); setBusy(true); setError(null);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error ?? "Erreur réseau");
      } else {
        setMessages([...next, { role: "assistant", content: data.reply ?? "" }]);
      }
    } catch (e: any) {
      setError(e.message ?? "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-midnight-900 text-white grid place-items-center shadow-lg hover:scale-105 transition-transform"
          title="Assistant Dasolabs"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[380px] max-w-[calc(100vw-40px)] h-[540px] max-h-[calc(100vh-40px)] bg-white border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <header className="bg-midnight-900 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigoaccent" />
              <span className="text-sm font-semibold">Assistant Dasolabs</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-midnight-300 hover:text-white"><X className="w-4 h-4" /></button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-midnight-50/30">
            {messages.length === 0 && (
              <div className="text-xs text-midnight-500 space-y-2">
                <p className="font-medium">Posez-moi une question sur vos données :</p>
                <ul className="space-y-1 text-midnight-700">
                  <li className="cursor-pointer hover:text-indigoaccent" onClick={() => setInput("Donne-moi un aperçu chiffré global de l'ERP")}>→ Aperçu chiffré global</li>
                  <li className="cursor-pointer hover:text-indigoaccent" onClick={() => setInput("Liste mes entreprises clientes")}>→ Mes entreprises</li>
                  <li className="cursor-pointer hover:text-indigoaccent" onClick={() => setInput("Trouve les contacts dont la fonction est CTO")}>→ Trouver des contacts</li>
                  <li className="cursor-pointer hover:text-indigoaccent" onClick={() => setInput("Liste mes consultants Dasolabs avec leur statut mission")}>→ Mes consultants</li>
                  <li className="cursor-pointer hover:text-indigoaccent" onClick={() => setInput("Quels candidats externes ont la compétence java ?")}>→ Candidats avec compétence X</li>
                  <li className="cursor-pointer hover:text-indigoaccent" onClick={() => setInput("Quelles missions T&M sont en cours ?")}>→ Missions T&M en cours</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("text-sm rounded-lg px-3 py-2 max-w-[90%] whitespace-pre-wrap break-words",
                m.role === "user" ? "ml-auto bg-midnight-900 text-white" : "bg-white border border-border text-midnight-900"
              )}>
                <ChatContent text={m.content} />
              </div>
            ))}
            {busy && (
              <div className="text-xs text-midnight-500 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> L'assistant réfléchit...
              </div>
            )}
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-border p-2 flex gap-2 bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre question..."
              disabled={busy}
              className="flex-1 h-9 px-3 rounded-md border border-border bg-muted/40 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigoaccent/30"
            />
            <button type="submit" disabled={busy || !input.trim()} className="btn-primary btn-sm w-9 h-9 p-0 grid place-items-center">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/** Rendu basique : transforme les liens markdown [texte](url) en vrais liens. */
function ChatContent({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) return <a key={i} href={m[2]} className="underline hover:text-indigoaccent">{m[1]}</a>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
