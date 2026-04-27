import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { AlChatModal } from "./AlChatModal";

const STORAGE_KEY = "al_chat_seen";
const WELCOME_KEY = "al_welcome_seen";
const WELCOME_DURATION_MS = 5000;

export function AlFloatingButton() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setPulse(true);

    // First-time welcome bubble. Mark seen immediately so a refresh during
    // the 5s window won't replay it. Only fires when not auto-opening from
    // a cross-subdomain link (the user is busy reading the panel in that case).
    const urlParams = new URLSearchParams(window.location.search);
    const autoOpening = urlParams.get("al") === "open";
    const welcomeSeen = window.localStorage.getItem(WELCOME_KEY);
    if (!welcomeSeen && !autoOpening) {
      window.localStorage.setItem(WELCOME_KEY, "1");
      setShowWelcome(true);
      welcomeTimerRef.current = window.setTimeout(() => {
        setShowWelcome(false);
      }, WELCOME_DURATION_MS);
    }

    if (autoOpening) {
      setOpen(true);
      setPulse(false);
      window.localStorage.setItem(STORAGE_KEY, "1");
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("al");
      window.history.replaceState({}, "", cleaned.toString());
    }

    return () => {
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
      }
    };
  }, []);

  const dismissWelcome = () => {
    setShowWelcome(false);
    if (welcomeTimerRef.current !== null) {
      window.clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setPulse(false);
      dismissWelcome();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "1");
      }
    }
  };

  // Hide the floating button while panel is open (panel has its own X close button).
  return (
    <>
      {!open && (
        <>
          <div
            aria-hidden={!showWelcome}
            className={`fixed bottom-[80px] right-5 z-30 max-w-[260px] transition-all duration-300 ease-out ${
              showWelcome
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 pointer-events-none"
            }`}
          >
            <div className="relative rounded-2xl bg-primary text-primary-foreground px-4 py-3 pr-9 text-sm shadow-xl">
              <p className="leading-snug">
                <span className="font-semibold">Hi, I'm AL.</span>{" "}
                <span className="opacity-90">
                  You can ask me anything, I'm here to help.
                </span>
              </p>
              <button
                onClick={dismissWelcome}
                aria-label="Dismiss welcome message"
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full inline-flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-primary-foreground/10 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* Tail pointing down toward the floating button */}
              <span className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-primary" />
            </div>
          </div>

          <button
            onClick={toggle}
            aria-label="Open AL assistant"
            className={`fixed bottom-5 right-5 z-30 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform ${
              pulse ? "animate-pulse" : ""
            }`}
            data-testid="button-open-al"
          >
            <Sparkles className="h-5 w-5" />
            {pulse && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-background" />
            )}
          </button>
        </>
      )}
      <AlChatModal open={open} onOpenChange={setOpen} />
    </>
  );
}
