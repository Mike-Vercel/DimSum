"use client";

import type { AssistantReplyDTO } from "@dimsum/types";
import { ArrowUp, ChevronRight, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TIP_MASCOT_SPRITE } from "@/components/checkout/tip-mascot";
import { api, ApiError } from "@/lib/api";
import { useScrollDirection } from "@/lib/scroll-direction";
import { selectItemCount, useCart } from "@/lib/stores/cart";
import { cn } from "@/lib/cn";

/**
 * "Dim", the mascot as a friend on the site: a waving launcher and a chat that answers questions,
 * recommends dishes from the real menu and opens the right page. The conversation lives in this tab
 * (sessionStorage), so it follows the visitor from page to page.
 */

const OPEN_EVENT = "dimsum:assistant";
const STORE_KEY = "dimsum-assistant";

/** Opens Dim from anywhere (e.g. the mascot in the footer), optionally sending a first question. */
export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { prompt } }));
}

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; reply?: AssistantReplyDTO; offline?: boolean };

const WELCOME_SUGGESTIONS = ["Cosa mi consigli?", "Ho un'allergia", "Come funziona l'ordine?", "Piatti vegetariani?"];

/** Pages where the floating launcher would get in the way (the chat still opens from the footer). */
const HIDE_LAUNCHER = ["/cart", "/checkout", "/order/", "/login", "/registrati", "/admin", "/rider"];

function readTurns(): Turn[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Turn[]) : [];
  } catch {
    return [];
  }
}

export function AssistantWidget({ launcher = true, low = false }: { launcher?: boolean; low?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<string | null>(null);
  // Like the tab bar: out of the way while reading (scrolling down), back on the way up.
  const reading = useScrollDirection() === "down";
  // The "Vai al carrello" bar (phones) sits above the tab bar: Dim moves up over it.
  const cartBar = useCart(selectItemCount) > 0 && !pathname.startsWith("/account");

  // Conversation of this tab, restored once on the client.
  useEffect(() => {
    const restored = readTurns();
    queueMicrotask(() => {
      setTurns(restored);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(turns.slice(-30)));
    } catch {
      /* private mode */
    }
  }, [turns, loaded]);

  const send = async (raw: string) => {
    const content = raw.trim().slice(0, 1200);
    if (!content || busy) return;
    setText("");
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setBusy(true);
    try {
      const history = next
        .filter((t) => !(t.role === "assistant" && t.offline))
        .slice(-20)
        .map((t) => ({ role: t.role, content: t.content }));
      // The conversation must start with the visitor.
      while (history[0]?.role === "assistant") history.shift();
      const reply = await api.assistant.ask(history);
      setTurns((t) => [...t, { role: "assistant", content: reply.reply, reply }]);
    } catch (e) {
      const off = e instanceof ApiError && (e.details as { code?: string } | undefined)?.code === "ASSISTANT_OFF";
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          offline: true,
          content: off
            ? "Sono ancora in allenamento 🥟 Intanto posso portarti dove ti serve:"
            : e instanceof ApiError
              ? e.message
              : "Non riesco a collegarmi: controlla la connessione e riprova.",
          reply: {
            reply: "",
            dishes: [],
            link: off ? { href: "/menu", label: "Apri il menu" } : null,
            suggestions: [],
          },
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Opened from elsewhere (footer mascot), possibly with a question.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) pending.current = prompt;
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!open || !loaded || !pending.current) return;
    const prompt = pending.current;
    pending.current = null;
    void send(prompt);
    // send is recreated every render; the pending prompt is consumed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loaded]);

  // Keep the newest message in view; Esc closes; the page behind does not scroll on phones.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const previous = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const go = (href: string) => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
    router.push(href);
  };

  const showLauncher = launcher && !HIDE_LAUNCHER.some((p) => pathname.startsWith(p));
  const last = turns[turns.length - 1];
  const suggestions =
    turns.length === 0
      ? WELCOME_SUGGESTIONS
      : last?.role === "assistant" && !busy
        ? (last.reply?.suggestions ?? [])
        : [];

  return (
    <>
      <style>{CSS}</style>
      {showLauncher && !open ? (
        // Only the mascot opens the chat: the hint bubble and the space around it are not tappable.
        <div
          className={cn(
            "dim-launcher",
            low ? "dim-launcher-low" : cartBar && "dim-launcher-cart",
            reading && "dim-launcher-away",
          )}
        >
          <span className="dim-launcher-bubble" aria-hidden>
            Ciao! Serve una mano?
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="dim-launcher-face"
            aria-label="Chiedi a Dim, l'assistente di DIMSUM"
          >
            <span className="dim-sprite dim-sprite-wave" style={{ backgroundImage: `url(${TIP_MASCOT_SPRITE})` }} />
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="dim-root" role="dialog" aria-modal="false" aria-label="Dim, l'assistente di DIMSUM">
          <div className="dim-panel">
            <header className="dim-head">
              <span className="dim-avatar" aria-hidden>
                <span className="dim-sprite dim-sprite-blink" style={{ backgroundImage: `url(${TIP_MASCOT_SPRITE})` }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body font-extrabold leading-tight">Dim</p>
                <p className="flex items-center gap-1.5 text-caption text-fg-muted">
                  <span className="dim-dot" /> Il tuo amico DIMSUM · risponde subito
                </p>
              </div>
              {turns.length ? (
                <button
                  type="button"
                  onClick={() => setTurns([])}
                  className="dim-icon"
                  aria-label="Nuova conversazione"
                  title="Nuova conversazione"
                >
                  <RotateCcw className="size-4" />
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="dim-icon" aria-label="Chiudi">
                <X className="size-5" />
              </button>
            </header>

            <div ref={listRef} className="dim-list" aria-live="polite">
              <Bubble side="dim">
                Ciao! Sono <strong>Dim</strong> 🥟 Ti consiglio cosa mangiare, ti aiuto con ingredienti e
                allergie e ti spiego come funziona l&apos;ordine. Chiedimi pure!
              </Bubble>
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <Bubble key={i} side="you">
                    {t.content}
                  </Bubble>
                ) : (
                  <div key={i} className="space-y-2">
                    <Bubble side="dim">{t.content}</Bubble>
                    {t.reply?.dishes.length ? (
                      <div className="dim-dishes">
                        {t.reply.dishes.map((d) => (
                          <Link
                            key={d.slug}
                            href={`/product/${d.slug}`}
                            onClick={() => window.matchMedia("(max-width: 639px)").matches && setOpen(false)}
                            className="dim-dish"
                          >
                            <span className={cn("dim-dish-img", d.image?.backdrop === "LIGHT" ? "bg-white" : "bg-ink-900")}>
                              {d.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={d.image.url}
                                  alt=""
                                  loading="lazy"
                                  className={d.image.backdrop === "LIGHT" ? "object-contain" : "object-cover"}
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 block text-body-sm font-semibold leading-snug">{d.name}</span>
                              <span className="text-caption text-fg-muted tabular-nums">
                                {d.fromPrice ? "da " : ""}
                                {d.price}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {t.reply?.link ? (
                      <button type="button" onClick={() => go(t.reply!.link!.href)} className="dim-link">
                        {t.reply.link.label} <ChevronRight className="size-4" />
                      </button>
                    ) : null}
                    {t.offline && t.reply?.link ? (
                      <div className="flex flex-wrap gap-2 pl-1">
                        <button type="button" onClick={() => go("/info#zone")} className="dim-chip">
                          Zone di consegna
                        </button>
                        <button type="button" onClick={() => go("/supporto")} className="dim-chip">
                          Assistenza
                        </button>
                      </div>
                    ) : null}
                  </div>
                ),
              )}
              {busy ? (
                <div className="dim-typing" aria-label="Dim sta scrivendo">
                  <i />
                  <i />
                  <i />
                </div>
              ) : null}
            </div>

            {suggestions.length ? (
              <div className="dim-suggestions">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="dim-chip">
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              className="dim-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                rows={1}
                maxLength={1200}
                placeholder="Scrivi a Dim…"
                aria-label="Scrivi a Dim"
                className="dim-input"
                enterKeyHint="send"
              />
              <button type="submit" disabled={!text.trim() || busy} className="dim-send" aria-label="Invia">
                <ArrowUp className="size-5" />
              </button>
            </form>
            <p className="dim-note">Dim può sbagliare: per allergie serie contatta il locale.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Bubble({ side, children }: { side: "dim" | "you"; children: React.ReactNode }) {
  return <div className={cn("dim-bubble", side === "you" ? "dim-you" : "dim-dim")}>{children}</div>;
}

// Sprite: 8 frames (174 × 194) of the 3D mascot: 0 idle, 1 blink, 2 hop, 3–6 wave, 7 squash.
const CSS = `
.dim-sprite{position:absolute;inset:0;background-repeat:no-repeat;background-size:800% 100%;background-position:0 0}
.dim-sprite-blink{animation:dim-blink 4s step-end infinite}
.dim-sprite-wave{animation:dim-wave-loop 6s steps(1) infinite}
@keyframes dim-blink{0%{background-position:0 0}92%{background-position:14.2857% 0}96%{background-position:0 0}}
@keyframes dim-wave-loop{0%,62%{background-position:0 0}64%{background-position:42.857% 0}67%{background-position:57.143% 0}70%{background-position:71.429% 0}73%{background-position:85.714% 0}76%{background-position:42.857% 0}79%{background-position:57.143% 0}82%{background-position:71.429% 0}85%{background-position:85.714% 0}88%,100%{background-position:0 0}}
.dim-launcher{position:fixed;z-index:45;right:max(12px,env(safe-area-inset-right));bottom:calc(env(safe-area-inset-bottom) + 84px);display:flex;align-items:flex-end;gap:6px;pointer-events:none;transition:transform .35s cubic-bezier(.3,.7,.2,1),opacity .25s}
.dim-launcher-away{transform:translateX(calc(100% + 24px));opacity:0}
.dim-launcher-away .dim-launcher-face{pointer-events:none}
.dim-launcher-low{bottom:calc(env(safe-area-inset-bottom) + 16px)}
.dim-launcher-cart{bottom:calc(env(safe-area-inset-bottom) + 140px)}
@media (min-width:1024px){.dim-launcher-cart{bottom:24px}}
@media (min-width:1024px){.dim-launcher{right:24px;bottom:24px}.dim-launcher-away{transform:none;opacity:1}.dim-launcher-away .dim-launcher-face{pointer-events:auto}}
@media (max-width:1023px){.dim-launcher-face{width:58px;height:64px;border-radius:20px}}
.dim-launcher-face{pointer-events:auto;position:relative;display:block;flex:none;width:66px;height:72px;padding:0;border:0;border-radius:24px;background:var(--color-surface,#fff);box-shadow:0 12px 30px -12px rgba(60,30,10,.45),0 0 0 1px rgba(0,0,0,.05);overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .3s cubic-bezier(.3,1.4,.5,1)}
.dim-launcher-face .dim-sprite{inset:4px 3px 0}
.dim-launcher-face:hover{transform:translateY(-3px) rotate(-3deg)}
.dim-launcher-bubble{pointer-events:none;margin-bottom:38px;padding:7px 11px;border-radius:14px 14px 4px 14px;background:var(--color-ink-950,#111);color:#fff;font-size:13px;font-weight:700;white-space:nowrap;box-shadow:0 10px 24px -14px rgba(0,0,0,.5);animation:dim-hint 9s ease-in-out infinite both}
@keyframes dim-hint{0%,8%{opacity:0;transform:translateY(6px) scale(.9)}14%,40%{opacity:1;transform:none}48%,100%{opacity:0;transform:translateY(4px) scale(.95)}}
.dim-root{position:fixed;inset:0;z-index:70;pointer-events:none}
.dim-panel{pointer-events:auto;position:absolute;inset:0;display:flex;flex-direction:column;background:var(--color-canvas,#f6f1ea);
  padding-top:env(safe-area-inset-top);animation:dim-in .32s cubic-bezier(.2,.8,.2,1) both}
@media (min-width:640px){.dim-panel{inset:auto 24px 24px auto;width:400px;height:min(660px,calc(100dvh - 48px));border-radius:28px;overflow:hidden;padding-top:0;
  box-shadow:0 30px 80px -24px rgba(40,20,10,.45),0 0 0 1px rgba(0,0,0,.06);transform-origin:100% 100%}}
@keyframes dim-in{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
.dim-head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--color-line,rgba(0,0,0,.08));background:var(--color-surface,#fff)}
.dim-avatar{position:relative;flex:none;width:46px;height:50px;border-radius:16px;background:var(--color-surface-2,#f3efe8);overflow:hidden}
.dim-avatar .dim-sprite{inset:3px 2px 0}
.dim-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2fa36b;box-shadow:0 0 0 3px rgba(47,163,107,.18)}
.dim-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;border:0;background:transparent;color:inherit;cursor:pointer}
.dim-icon:hover{background:var(--color-surface-2,#f3efe8)}
.dim-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px 14px;display:flex;flex-direction:column;gap:10px}
.dim-bubble{max-width:86%;padding:10px 14px;border-radius:20px;font-size:15px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;animation:dim-pop .28s cubic-bezier(.3,1.3,.5,1) both}
.dim-dim{align-self:flex-start;background:var(--color-surface,#fff);border-bottom-left-radius:6px;box-shadow:0 0 0 1px var(--color-line,rgba(0,0,0,.07))}
.dim-you{align-self:flex-end;background:var(--color-brand,#d4282e);color:#fff;border-bottom-right-radius:6px}
@keyframes dim-pop{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
.dim-dishes{display:grid;gap:8px;max-width:92%}
.dim-dish{display:flex;align-items:center;gap:10px;padding:8px;border-radius:16px;background:var(--color-surface,#fff);box-shadow:0 0 0 1px var(--color-line,rgba(0,0,0,.07));text-decoration:none;color:inherit;animation:dim-pop .3s .08s cubic-bezier(.3,1.3,.5,1) both;transition:transform .2s}
.dim-dish:hover{transform:translateX(2px)}
.dim-dish-img{position:relative;flex:none;width:52px;height:52px;border-radius:12px;overflow:hidden}
.dim-dish-img img{width:100%;height:100%}
.dim-link{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;padding:9px 14px;border-radius:999px;border:0;background:var(--color-ink-950,#111);color:#fff;font-size:14px;font-weight:700;cursor:pointer;animation:dim-pop .3s .12s both}
.dim-typing{align-self:flex-start;display:flex;gap:4px;padding:13px 16px;border-radius:20px;border-bottom-left-radius:6px;background:var(--color-surface,#fff);box-shadow:0 0 0 1px var(--color-line,rgba(0,0,0,.07))}
.dim-typing i{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.35;animation:dim-typing 1.1s infinite}
.dim-typing i:nth-child(2){animation-delay:.15s}.dim-typing i:nth-child(3){animation-delay:.3s}
@keyframes dim-typing{0%,60%,100%{transform:none;opacity:.35}30%{transform:translateY(-4px);opacity:.9}}
.dim-suggestions{display:flex;gap:8px;overflow-x:auto;padding:0 14px 10px;scrollbar-width:none}
.dim-suggestions::-webkit-scrollbar{display:none}
.dim-chip{flex:none;padding:8px 13px;border-radius:999px;border:1px solid var(--color-line,rgba(0,0,0,.1));background:var(--color-surface,#fff);color:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .2s,border-color .2s}
.dim-chip:hover{border-color:var(--color-brand,#d4282e);color:var(--color-brand,#d4282e)}
.dim-form{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 6px;border-top:1px solid var(--color-line,rgba(0,0,0,.08));background:var(--color-surface,#fff)}
/* 16px: phones do not zoom the page when the field gets focus. */
.dim-input{flex:1;min-height:44px;max-height:120px;resize:none;padding:11px 14px;border-radius:22px;border:1px solid var(--color-line,rgba(0,0,0,.12));background:var(--color-canvas,#f6f1ea);font:inherit;font-size:16px;line-height:1.35;outline:none;field-sizing:content}
.dim-input:focus{border-color:var(--color-brand,#d4282e)}
.dim-send{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--color-brand,#d4282e);color:#fff;cursor:pointer;transition:transform .15s,opacity .2s}
.dim-send:disabled{opacity:.35;cursor:default}
.dim-send:not(:disabled):active{transform:scale(.92)}
.dim-note{margin:0;padding:0 14px calc(8px + env(safe-area-inset-bottom));background:var(--color-surface,#fff);font-size:11px;color:var(--color-fg-subtle,#999);text-align:center}
@media (prefers-reduced-motion:reduce){.dim-sprite,.dim-launcher-bubble,.dim-panel,.dim-bubble,.dim-dish,.dim-link,.dim-typing i{animation:none!important}}
`;
