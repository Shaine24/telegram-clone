"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";

const FEATURES = [
  "Real-time messages and chat list updates",
  "Private conversations protected by row-level security",
  "Cloud-synced history on every device",
];

function friendly(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login")) return "Wrong email or password. Try again.";
  if (value.includes("already registered")) return "That email already has an account. Sign in instead.";
  if (value.includes("password should be")) return "Password must be at least 6 characters.";
  if (value.includes("unable to validate email")) return "That email address doesn't look valid.";
  if (value.includes("rate limit")) return "Too many attempts. Wait a moment and try again.";
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setNotice(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    if (mode === "signup") {
      const name = displayName.trim();
      const handle = username.trim().toLowerCase();

      if (name.length < 2) {
        setError("Enter your name (at least 2 characters).");
        return;
      }
      if (!/^[a-z0-9_]{3,24}$/.test(handle)) {
        setError("Username must be 3–24 characters: lowercase letters, numbers or underscores.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      setBusy(true);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { username: handle, display_name: name },
        },
      });
      setBusy(false);

      if (signUpError) {
        setError(friendly(signUpError.message));
        return;
      }
      if (!data.session) {
        setNotice("Check your inbox to confirm your email, then sign in.");
      }
      return;
    }

    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setBusy(false);

    if (signInError) setError(friendly(signInError.message));
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-app px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-44 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#3390ec]/15 blur-[140px]" />
        <div className="absolute -bottom-28 -right-20 h-[440px] w-[440px] rounded-full bg-accent/15 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_55%)]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <section className="hidden md:block">
          <div className="flex items-center gap-3">
            <Logo size={52} />
            <div>
              <p className="text-[17px] font-semibold tracking-tight">Telegram</p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Web messenger
              </p>
            </div>
          </div>

          <h1 className="mt-9 text-[46px] font-semibold leading-[1.03] tracking-[-0.035em] lg:text-[54px]">
            Fast. Secure.
            <br />
            <span className="bg-gradient-to-r from-[#7cc8ff] via-[#9c8cf5] to-[#c4b5fd] bg-clip-text text-transparent">
              Simply messaging.
            </span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
            A clean, real-time messenger built with Next.js and Supabase.
            Create an account, start a conversation and watch messages arrive
            instantly.
          </p>

          <ul className="mt-7 space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-[13.5px] text-white/75">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <Check size={12} strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <ChatPreview />
        </section>

        <section className="w-full">
          <div className="mb-6 flex items-center justify-center gap-3 md:hidden">
            <Logo size={46} />
            <div>
              <p className="text-[17px] font-semibold">Telegram</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                Web messenger
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {mode === "signin"
                ? "Sign in to pick up right where you left off."
                : "Choose a name and username to get started."}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
              {mode === "signup" && (
                <>
                  <Field
                    label="Your name"
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="Alex Morgan"
                    autoComplete="name"
                    maxLength={48}
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">
                      Username
                    </span>
                    <div className="flex items-center rounded-xl border border-line bg-black/25 px-3.5 transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15">
                      <span className="text-[15px] text-muted">@</span>
                      <input
                        value={username}
                        onChange={(event) =>
                          setUsername(
                            event.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, "")
                              .slice(0, 24),
                          )
                        }
                        placeholder="alex"
                        autoComplete="username"
                        className="w-full bg-transparent py-3 pl-1 text-[15px] outline-none placeholder:text-white/25"
                        required
                      />
                    </div>
                  </label>
                </>
              )}

              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className="w-full rounded-xl border border-line bg-black/25 px-3.5 py-3 pr-11 text-[15px] outline-none transition placeholder:text-white/25 focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="animate-fade rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-red-300">
                  {error}
                </p>
              )}
              {notice && (
                <p className="animate-fade rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-emerald-300">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8e7bf0] to-[#6f5acd] text-[15px] font-semibold text-white shadow-[0_12px_32px_-14px_rgba(135,116,225,0.95)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    {mode === "signin" ? "Signing in…" : "Creating account…"}
                  </>
                ) : (
                  <>
                    {mode === "signin" ? "Sign in" : "Create account"}
                    <ArrowRight
                      size={17}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[10px] uppercase tracking-widest text-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <p className="mt-4 text-center text-[13px] text-muted">
              {mode === "signin" ? "New to Telegram?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                className="font-semibold text-accent transition hover:text-[#a595ff]"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="mx-auto mt-4 max-w-md text-center text-[11px] leading-relaxed text-white/30">
            Telegram-style demo · built with Next.js, Supabase and Vercel
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        className="w-full rounded-xl border border-line bg-black/25 px-3.5 py-3 text-[15px] outline-none transition placeholder:text-white/25 focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
      />
    </label>
  );
}

function ChatPreview() {
  return (
    <div className="relative mt-9 w-full max-w-sm">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[38px] bg-accent/10 blur-2xl" />
      <div className="animate-float rounded-[26px] border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
          <Avatar name="Mira Chen" color="#ee7aae" size={36} online />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">Mira Chen</p>
            <p className="text-[10.5px] text-emerald-400">online</p>
          </div>
          <span className="ml-auto rounded-full bg-white/5 px-2 py-1 text-[9.5px] uppercase tracking-wider text-muted">
            Web
          </span>
        </div>

        <div className="space-y-1.5 py-4 text-[12.5px] leading-snug">
          <PreviewBubble>Hey! Welcome to Telegram Web 👋</PreviewBubble>
          <PreviewBubble mine>
            Real-time messages, powered by Supabase.
          </PreviewBubble>
          <PreviewBubble>Create an account and try it →</PreviewBubble>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-black/25 px-3 py-2 text-[11.5px] text-muted">
          <span className="flex-1">Write a message…</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white">
            <Send size={13} />
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewBubble({
  children,
  mine = false,
}: {
  children: React.ReactNode;
  mine?: boolean;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <span
        className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${
          mine
            ? "rounded-br-[5px] bg-gradient-to-br from-[#8e7bf0] to-[#715cd0] text-white"
            : "rounded-bl-[5px] border border-white/5 bg-[#202024] text-white/80"
        }`}
      >
        {children}
      </span>
    </div>
  );
}
