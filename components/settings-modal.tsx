"use client";

import { useState } from "react";
import { Check, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AVATAR_COLORS } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";

export function SettingsModal({
  open,
  onClose,
  profile,
  email,
  onUpdated,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  email: string;
  onUpdated: (profile: Profile) => void;
  onSignOut: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [color, setColor] = useState(profile.avatar_color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Your name needs at least 2 characters.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: name, avatar_color: color })
      .eq("id", profile.id);
    setBusy(false);

    if (updateError) {
      setError("Could not save your profile. Please try again.");
      return;
    }

    onUpdated({ ...profile, display_name: name, avatar_color: color });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings" subtitle="Your profile">
      <div className="flex flex-col items-center px-6 pb-5 pt-6">
        <Avatar name={displayName || profile.display_name} color={color} size={84} />
        <p className="mt-4 text-[16px] font-semibold">
          {displayName || profile.display_name}
        </p>
        <p className="text-[12px] text-muted">@{profile.username}</p>
        {email && <p className="mt-1 text-[11px] text-white/30">{email}</p>}
      </div>

      <div className="border-t border-line px-5 py-4">
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Display name
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={48}
            className="w-full rounded-xl border border-line bg-black/25 px-3.5 py-2.5 text-[14px] outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <div className="mt-4">
          <span className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Avatar color
          </span>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Use color ${swatch}`}
                className={`grid h-9 w-9 place-items-center rounded-full ring-2 transition ${
                  color === swatch
                    ? "ring-white/80"
                    : "ring-transparent hover:ring-white/25"
                }`}
                style={{ background: swatch }}
              >
                {color === swatch && (
                  <Check size={15} className="text-black/70" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[13.5px] font-semibold text-white transition hover:bg-accent-strong disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>

      <div className="border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-[12.5px] font-medium text-red-300 transition hover:bg-red-500/10"
        >
          <LogOut size={16} />
          Sign out
        </button>
        <p className="mt-2 px-2 text-[10.5px] text-white/25">
          Signed in with Supabase Auth · messages sync in real time
        </p>
      </div>
    </Modal>
  );
}
