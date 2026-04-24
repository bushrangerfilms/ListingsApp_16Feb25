import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AlChatModal } from "./AlChatModal";

const STORAGE_KEY = "al_chat_seen";

export function AlFloatingButton() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setPulse(true);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setPulse(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "1");
      }
    }
  };

  // Hide the floating button while panel is open (panel has its own X close button).
  return (
    <>
      {!open && (
        <button
          onClick={toggle}
          aria-label="Open Al assistant"
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
      )}
      <AlChatModal open={open} onOpenChange={setOpen} />
    </>
  );
}
