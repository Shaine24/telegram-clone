"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  CheckCheck,
  Clock,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Search,
  Send,
  Smile,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  AVATAR_COLORS,
  MessageText,
  dayKey,
  dayLabel,
  formatListTime,
  formatTime,
} from "@/lib/format";
import type { Chat, Message, Profile } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { NewChatModal } from "@/components/new-chat-modal";
import { SettingsModal } from "@/components/settings-modal";

const EMOJIS = [
  "😀", "😂", "😍", "🥰", "😎", "🤔", "👍", "🙏",
  "🔥", "🎉", "❤️", "💜", "😢", "😮", "😴", "🤝",
  "✅", "✨", "🚀", "☕", "🍕", "🎧", "📷", "💬",
];

function chatTitle(chat: Chat) {
  return chat.is_group ? chat.name || "Group chat" : chat.peer_name || "Unknown user";
}

export function Messenger({ session }: { session: Session }) {
  const userId = session.user.id;
  const email = session.user.email ?? "";
  const metaName =
    typeof session.user.user_metadata?.display_name === "string"
      ? session.user.user_metadata.display_name
      : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Load (or repair) the signed-in user's profile.
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_color, created_at")
        .eq("id", userId)
        .maybeSingle();

      if (!alive) return;
      if (data) {
        setProfile(data as Profile);
        return;
      }

      const base =
        email
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 18) || "user";
      const fallback: Profile = {
        id: userId,
        username: `${base}${Math.floor(1000 + Math.random() * 9000)}`,
        display_name: metaName || base,
        avatar_color: AVATAR_COLORS[4],
      };

      const { data: created } = await supabase
        .from("profiles")
        .insert(fallback)
        .select("id, username, display_name, avatar_color, created_at")
        .single();

      if (!alive) return;
      setProfile((created as Profile) ?? fallback);
    })();

    return () => {
      alive = false;
    };
  }, [userId, email, metaName]);

  const loadChats = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_my_chats");
    if (!error) setChats((data ?? []) as Chat[]);
    setChatsLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const initial = window.setTimeout(() => void loadChats(), 0);
    const interval = window.setInterval(() => void loadChats(), 15_000);
    const onFocus = () => void loadChats();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [profile, loadChats]);

  const markRead = useCallback(async (chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, unread_count: 0 } : chat,
      ),
    );
    await supabase.rpc("mark_chat_read", { p_chat_id: chatId });
  }, []);

  const openChat = useCallback((chatId: string | null) => {
    setActiveChatId(chatId);
    setMessages([]);
    setMessagesLoading(!!chatId);
    setDraft("");
    setMessageQuery("");
    setSearchOpen(false);
    setEmojiOpen(false);
    if (chatId) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, unread_count: 0 } : chat,
        ),
      );
    }
  }, []);

  // Load the active conversation.
  useEffect(() => {
    if (!activeChatId) return;

    let alive = true;
    const chatId = activeChatId;

    supabase
      .from("messages")
      .select("id, chat_id, sender_id, body, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error) setMessages((data ?? []) as Message[]);
        setMessagesLoading(false);
        void markRead(chatId);
      });

    return () => {
      alive = false;
    };
  }, [activeChatId, markRead]);

  // Live updates for the inbox and the open conversation.
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("inbox-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const incoming = payload.new as Message;
          if (incoming.chat_id === activeChatId) {
            setMessages((prev) =>
              prev.some((message) => message.id === incoming.id)
                ? prev
                : [...prev, incoming],
            );
            setChats((prev) =>
              prev
                .map((chat) =>
                  chat.id === incoming.chat_id
                    ? {
                        ...chat,
                        unread_count: 0,
                        last_message: incoming.body,
                        last_message_at: incoming.created_at,
                        last_message_sender: incoming.sender_id,
                      }
                    : chat,
                )
                .sort(
                  (a, b) =>
                    new Date(b.last_message_at ?? 0).getTime() -
                    new Date(a.last_message_at ?? 0).getTime(),
                ),
            );
            void markRead(incoming.chat_id);
          } else {
            void loadChats();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile, activeChatId, loadChats, markRead]);

  // Keep the conversation pinned to the newest message.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [activeChatId, messages.length, messagesLoading]);

  // Auto-grow the composer.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [draft]);

  // Dismiss the emoji tray when clicking elsewhere.
  useEffect(() => {
    if (!emojiOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [emojiOpen]);

  const activeChat = activeChatId
    ? chats.find((chat) => chat.id === activeChatId) ?? null
    : null;

  const filteredChats = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return chats;
    return chats.filter((chat) =>
      `${chatTitle(chat)} ${chat.peer_username ?? ""} ${chat.last_message ?? ""}`
        .toLowerCase()
        .includes(value),
    );
  }, [chats, query]);

  const shownMessages = useMemo(() => {
    const value = messageQuery.trim().toLowerCase();
    if (!value) return messages;
    return messages.filter((message) =>
      message.body.toLowerCase().includes(value),
    );
  }, [messages, messageQuery]);

  const messageItems = useMemo(
    () =>
      shownMessages.map((message, index) => {
        const previous = shownMessages[index - 1];
        const grouped =
          !!previous &&
          previous.sender_id === message.sender_id &&
          dayKey(previous.created_at) === dayKey(message.created_at) &&
          new Date(message.created_at).getTime() -
            new Date(previous.created_at).getTime() <
            5 * 60 * 1000;

        return {
          message,
          grouped,
          showDate:
            !previous || dayKey(previous.created_at) !== dayKey(message.created_at),
        };
      }),
    [shownMessages],
  );

  async function send() {
    const body = draft.trim();
    if (!body || !activeChatId || sending) return;

    const chatId = activeChatId;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: userId,
      body,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    setEmojiOpen(false);

    const { data, error } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, sender_id: userId, body })
      .select("id, chat_id, sender_id, body, created_at")
      .single();

    setSending(false);

    if (error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setDraft(body);
      notify("Could not send your message. Check your connection and retry.");
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === tempId ? (data as Message) : message,
      ),
    );

    const now = (data as Message).created_at;
    setChats((prev) =>
      prev
        .map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                last_message: body,
                last_message_at: now,
                last_message_sender: userId,
                unread_count: 0,
              }
            : chat,
        )
        .sort(
          (a, b) =>
            new Date(b.last_message_at ?? 0).getTime() -
            new Date(a.last_message_at ?? 0).getTime(),
        ),
    );

    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-app text-ink">
      {/* ------------------------------------------------------- sidebar */}
      <aside
        className={`${
          activeChat ? "hidden md:flex" : "flex"
        } w-full shrink-0 flex-col border-r border-line bg-panel md:w-[376px] lg:w-[404px]`}
      >
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Profile & settings"
            className="rounded-full ring-offset-2 ring-offset-panel transition hover:ring-2 hover:ring-white/10"
          >
            {profile ? (
              <Avatar
                name={profile.display_name}
                color={profile.avatar_color}
                size={40}
              />
            ) : (
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/5" />
            )}
          </button>

          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-10 w-full rounded-full border border-line bg-panel2 pl-9 pr-8 text-[13.5px] outline-none transition placeholder:text-muted focus:border-accent/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-ink"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            title="New message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_8px_20px_-8px_rgba(135,116,225,0.9)] transition hover:bg-accent-strong"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-muted">
            Chats
          </span>
          <span className="text-[10.5px] text-white/25">{chats.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto pb-2">
          {chatsLoading ? (
            <div className="space-y-1 px-3 pt-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-1 py-2.5">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                    <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/[0.035]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center px-8 pb-10 pt-14 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.04] text-muted">
                <MessageSquarePlus size={26} />
              </div>
              <p className="mt-4 text-[14px] font-medium">
                {query ? "No chats found" : "No chats yet"}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {query
                  ? "Try a different name or keyword."
                  : "Start a conversation with someone new."}
              </p>
              {!query && (
                <button
                  type="button"
                  onClick={() => setNewChatOpen(true)}
                  className="mt-5 rounded-full bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-accent-strong"
                >
                  New message
                </button>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              const title = chatTitle(chat);
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => openChat(chat.id)}
                  className={`group relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" />
                  )}
                  <Avatar
                    name={title}
                    color={chat.peer_color}
                    size={52}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[14px] font-medium">
                        {title}
                      </span>
                      <span className="ml-auto shrink-0 text-[10.5px] text-muted">
                        {formatListTime(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {chat.last_message_sender === userId && (
                        <CheckCheck
                          size={14}
                          className="shrink-0 text-accent"
                        />
                      )}
                      <span className="truncate text-[12.5px] text-muted">
                        {chat.last_message || "No messages yet"}
                      </span>
                      {chat.unread_count > 0 && (
                        <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-white">
                          {chat.unread_count > 99 ? "99+" : chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[10.5px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Realtime via Supabase
        </div>
      </aside>

      {/* ----------------------------------------------------- chat pane */}
      <main
        className={`${
          activeChat ? "flex" : "hidden md:flex"
        } relative min-w-0 flex-1 flex-col`}
      >
        {activeChat ? (
          <>
            <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-panel/90 px-2.5 backdrop-blur sm:px-3.5">
              <button
                type="button"
                onClick={() => openChat(null)}
                aria-label="Back to chats"
                className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-ink md:hidden"
              >
                <ArrowLeft size={19} />
              </button>

              <Avatar
                name={chatTitle(activeChat)}
                color={activeChat.peer_color}
                size={40}
              />

              <div className="min-w-0">
                <h1 className="truncate text-[14px] font-semibold leading-tight">
                  {chatTitle(activeChat)}
                </h1>
                <p className="truncate text-[11.5px] leading-tight text-muted">
                  {activeChat.peer_username
                    ? `@${activeChat.peer_username}`
                    : "Private chat"}
                </p>
              </div>

              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen((open) => !open);
                    setMessageQuery("");
                  }}
                  title="Search in conversation"
                  aria-label="Search in conversation"
                  className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/5 hover:text-ink ${
                    searchOpen ? "bg-white/5 text-ink" : "text-muted"
                  }`}
                >
                  <Search size={17} />
                </button>
              </div>
            </header>

            {searchOpen && (
              <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2">
                <Search size={15} className="shrink-0 text-muted" />
                <input
                  autoFocus
                  value={messageQuery}
                  onChange={(event) => setMessageQuery(event.target.value)}
                  placeholder="Search in conversation"
                  className="min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMessageQuery("");
                    setSearchOpen(false);
                  }}
                  aria-label="Close search"
                  className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div ref={scrollRef} className="chat-pattern relative flex-1 overflow-y-auto">
              {messagesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-muted" />
                </div>
              ) : messageItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  {messageQuery ? (
                    <>
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-white/5 text-muted">
                        <Search size={22} />
                      </div>
                      <p className="mt-4 text-[14px] font-medium">No messages found</p>
                      <p className="mt-1 text-[12.5px] text-muted">
                        Try a different search term.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="grid h-16 w-16 place-items-center rounded-full border border-white/5 bg-white/[0.04] text-2xl">
                        👋
                      </div>
                      <p className="mt-4 text-[15px] font-medium">
                        No messages here yet
                      </p>
                      <p className="mt-1 text-[12.5px] text-muted">
                        Say hi to {chatTitle(activeChat)} and start the conversation.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="mx-auto w-full max-w-3xl px-2.5 py-3 sm:px-5 sm:py-4">
                  {messageItems.map(({ message, grouped, showDate }) => (
                    <Fragment key={message.id}>
                      {showDate && (
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-black/30 px-3 py-1 text-[10.5px] font-medium text-white/65 backdrop-blur">
                            {dayLabel(message.created_at)}
                          </span>
                        </div>
                      )}
                      <Bubble
                        message={message}
                        mine={message.sender_id === userId}
                        grouped={grouped}
                      />
                    </Fragment>
                  ))}
                  <div className="h-1" />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-line bg-panel px-2 py-2.5 sm:px-4">
              <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
                <div className="flex min-w-0 flex-1 items-end gap-0.5 rounded-[24px] border border-line bg-panel2 py-1 pl-1 pr-2 transition focus-within:border-accent/40">
                  <div ref={emojiRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojiOpen((open) => !open)}
                      title="Emoji"
                      aria-label="Insert emoji"
                      className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-ink"
                    >
                      <Smile size={19} />
                    </button>
                    {emojiOpen && (
                      <div className="animate-pop absolute bottom-12 left-0 z-20 grid w-[268px] grid-cols-8 gap-0.5 rounded-2xl border border-line bg-panel p-2 shadow-2xl">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setDraft((value) => value + emoji);
                              setEmojiOpen(false);
                              textareaRef.current?.focus();
                            }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={`Message @${
                      activeChat.peer_username ?? "chat"
                    }`}
                    className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent py-2.5 text-[14.5px] leading-snug outline-none placeholder:text-muted"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      notify("Attachments aren't enabled in this demo yet.")
                    }
                    title="Attach a file"
                    aria-label="Attach a file"
                    className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-ink"
                  >
                    <Paperclip size={17} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                  className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white shadow-[0_8px_20px_-8px_rgba(135,116,225,0.9)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} className="-ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="chat-pattern relative flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Logo size={88} className="animate-float" />
            <h2 className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">
              Select a chat to start messaging
            </h2>
            <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
              Pick a conversation from the sidebar or start a new one. Messages
              sync instantly across your devices.
            </p>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(135,116,225,0.9)] transition hover:bg-accent-strong"
            >
              <MessageSquarePlus size={16} />
              New message
            </button>
            <p className="absolute bottom-5 text-[10px] uppercase tracking-[0.2em] text-white/20">
              Stored securely in Supabase
            </p>
          </div>
        )}
      </main>

      {newChatOpen && (
        <NewChatModal
          open
          onClose={() => setNewChatOpen(false)}
          onOpened={(chatId) => {
            openChat(chatId);
            void loadChats();
          }}
          notify={notify}
        />
      )}

      {profile && settingsOpen && (
        <SettingsModal
          open
          onClose={() => setSettingsOpen(false)}
          profile={profile}
          email={email}
          onUpdated={(next) => {
            setProfile(next);
            void loadChats();
          }}
          onSignOut={() => {
            void supabase.auth.signOut();
          }}
        />
      )}

      {toast && (
        <div className="animate-pop pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 bg-black/85 px-4 py-2 text-[12.5px] text-white shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}

function Bubble({
  message,
  mine,
  grouped,
}: {
  message: Message;
  mine: boolean;
  grouped: boolean;
}) {
  return (
    <div
      className={`animate-msg flex ${mine ? "justify-end" : "justify-start"} ${
        grouped ? "mt-0.5" : "mt-2"
      }`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14.5px] leading-[1.45] shadow-sm sm:max-w-[72%] ${
          mine
            ? "rounded-br-[5px] bg-gradient-to-br from-[#8e7bf0] to-[#715cd0] text-white"
            : "rounded-bl-[5px] border border-white/[0.04] bg-[#202024] text-ink"
        } ${message.pending ? "opacity-70" : ""}`}
      >
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          <MessageText body={message.body} />
        </p>
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] leading-none ${
            mine ? "text-white/65" : "text-muted"
          }`}
        >
          <span>{formatTime(message.created_at)}</span>
          {mine &&
            (message.pending ? (
              <Clock size={11} />
            ) : (
              <CheckCheck size={12} className="text-white/80" />
            ))}
        </div>
      </div>
    </div>
  );
}
