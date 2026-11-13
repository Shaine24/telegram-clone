"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Search, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { UserResult } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";

export function NewChatModal({
  open,
  onClose,
  onOpened,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: (chatId: string) => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;

    let alive = true;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_users", {
        p_query: query,
      });
      if (!alive) return;
      if (error) {
        setResults([]);
        notify("Could not load people right now.");
      } else {
        setResults((data ?? []) as UserResult[]);
      }
      setLoading(false);
    }, 220);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, query, notify]);

  async function startChat(userId: string) {
    if (busyId) return;
    setBusyId(userId);
    const { data, error } = await supabase.rpc("get_or_create_direct_chat", {
      p_other_user: userId,
    });
    setBusyId(null);

    if (error) {
      notify("Could not start that conversation. Please try again.");
      return;
    }

    onOpened(data as string);
    onClose();
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      notify("Invite link copied to clipboard.");
    } catch {
      notify("Could not copy the link. Copy it from the address bar instead.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      subtitle="Find someone by name or @username"
      wide
    >
      <div className="px-4 pt-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLoading(true);
            }}
            placeholder="Search people"
            className="h-11 w-full rounded-xl border border-line bg-black/25 pl-10 pr-3 text-[14px] outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/10"
          />
        </div>
        <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-muted">
          {query ? "Results" : "People on Telegram"}
        </p>
      </div>

      <div className="mt-1 pb-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted">
            <Loader2 size={16} className="animate-spin" />
            Looking for people…
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-muted">
              <UserPlus size={23} />
            </div>
            <p className="mt-4 text-[13.5px] font-medium">No people found</p>
            <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-muted">
              Invite a friend — once they create an account they&apos;ll show up
              here.
            </p>
            <button
              type="button"
              onClick={copyInvite}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-4 py-2 text-[12px] font-medium text-ink transition hover:bg-white/10"
            >
              <Copy size={14} />
              Copy invite link
            </button>
          </div>
        ) : (
          results.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={busyId !== null}
              onClick={() => void startChat(person.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04] disabled:opacity-60"
            >
              <Avatar
                name={person.display_name}
                color={person.avatar_color}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">
                  {person.display_name}
                </p>
                <p className="truncate text-[11.5px] text-muted">
                  @{person.username}
                </p>
              </div>
              {busyId === person.id ? (
                <Loader2 size={16} className="animate-spin text-muted" />
              ) : (
                <span className="rounded-full bg-accent/15 px-3 py-1 text-[10.5px] font-semibold text-accent">
                  Chat
                </span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={copyInvite}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] text-muted transition hover:bg-white/5 hover:text-ink"
        >
          <Copy size={14} />
          Copy invite link
        </button>
      </div>
    </Modal>
  );
}
