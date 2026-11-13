"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AuthScreen } from "@/components/auth-screen";
import { Messenger } from "@/components/messenger";
import { Logo } from "@/components/logo";

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) return <ConfigScreen />;
  if (session === undefined) return <Splash />;
  if (!session) return <AuthScreen />;

  return <Messenger key={session.user.id} session={session} />;
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-app">
      <Logo size={72} className="animate-float" />
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Loading your chats…
      </div>
    </div>
  );
}

function ConfigScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app px-4">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-panel p-8">
        <Logo size={56} />
        <h1 className="mt-5 text-2xl font-semibold">Almost there</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Add your Supabase credentials to{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
            .env.local
          </code>{" "}
          and restart the dev server:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-black/40 p-4 text-xs leading-relaxed text-white/80">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="mt-4 text-xs text-muted">
          The schema lives in{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono">
            supabase/migrations/0001_init.sql
          </code>
          .
        </p>
      </div>
    </div>
  );
}
