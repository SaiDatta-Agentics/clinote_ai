"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, HeartPulse, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClinicalScribeApp } from "./clinical-scribe-app";

type Session = { userId: string; email: string; clinicianName: string };
type StoredAccount = { userId: string; email: string; passwordHash: string };

const SESSION_KEY = "clinote.demo.session.v2";
const ACCOUNTS_KEY = "clinote.demo.accounts.v2";

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

async function hashPassword(value: string) {
  const bytes = new TextEncoder().encode(`clinote-demo-v2:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function ClinotePortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const localSession = readJson<Session | null>(SESSION_KEY, null);
      if (localSession) {
        setSession(localSession);
        setReady(true);
        return;
      }
      fetch("/api/auth/session", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.authenticated) {
            setSession({
              userId: data.user.userId,
              email: data.user.email,
              clinicianName: "Doctor",
            });
          }
        })
        .catch(() => null)
        .finally(() => setReady(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveSession = (next: Session) => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const continueDemo = () => saveSession({ userId: "demo-doctor", email: "doctor@example.test", clinicianName: "Doctor" });
  const signInWithMicrosoft = () => {
    window.location.href = "/api/auth/microsoft";
  };
  const signInWithGoogle = () => {
    window.location.href = "/api/auth/google";
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const passwordHash = await hashPassword(password);
      const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, []);
      const account = accounts.find((item) => item.email === normalizedEmail);
      if (mode === "create") {
        if (account) {
          setError("An account with this email already exists. Sign in instead.");
          return;
        }
        const created = { userId: crypto.randomUUID(), email: normalizedEmail, passwordHash };
        window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, created]));
        saveSession({ userId: created.userId, email: created.email, clinicianName: "Doctor" });
      } else {
        if (!account || account.passwordHash !== passwordHash) {
          setError("Email or password is incorrect. You can also use the demo workspace.");
          return;
        }
        saveSession({ userId: account.userId, email: account.email, clinicianName: "Doctor" });
      }
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    window.localStorage.removeItem(SESSION_KEY);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setSession(null);
    setPassword("");
  };

  if (!ready) return <div className="min-h-screen bg-[#eef3fb]" />;
  if (session) return <ClinicalScribeApp clinicianName={session.clinicianName} userId={session.userId} onSignOut={signOut} />;

  return (
    <main className="min-h-screen bg-[#eef3fb] p-4 text-[#172033] sm:p-7 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(33,54,105,.16)] sm:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden bg-[#17233b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-24 size-80 rounded-full bg-[#5f7ff0]/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#26b89b]/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#6686f4]"><HeartPulse className="size-6" /></div><div><p className="text-xl font-bold tracking-tight">clinote</p><p className="text-[10px] tracking-[.18em] text-slate-400">CLINICAL SCRIBE</p></div></div>
            <div className="mt-20 max-w-lg"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-[#9eb1ff]"><Sparkles className="size-3.5" /> Interactive clinical documentation demo</span><h1 className="mt-6 text-5xl font-bold leading-[1.07] tracking-[-.055em]">More patient time.<br />Less paperwork.</h1><p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Capture consent, record a consultation, review the transcript, refine the draft and export the approved clinical note.</p></div>
          </div>
          <div className="relative grid gap-3 sm:grid-cols-3">{["Consent first", "Clinician approved", "Fictional data"].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/[.055] p-4"><CheckCircle2 className="size-4 text-[#5ed1b7]" /><p className="mt-3 text-xs font-semibold">{item}</p></div>)}</div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-3 lg:hidden"><div className="flex size-10 items-center justify-center rounded-xl bg-[#3159d8] text-white"><HeartPulse className="size-5" /></div><p className="text-xl font-bold">clinote</p></div>
            <div className="mt-10 lg:mt-0"><p className="text-sm font-semibold text-[#3159d8]">Doctor workspace</p><h2 className="mt-2 text-3xl font-bold tracking-[-.04em]">{mode === "signin" ? "Welcome back" : "Create your account"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{mode === "signin" ? "Sign in to access your patient workspace." : "Sign up to start a new doctor workspace."}</p></div>
            <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => { setMode("signin"); setError(null); }} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${mode === "signin" ? "bg-white text-[#3159d8] shadow-sm" : "text-slate-500"}`}>Sign in</button><button type="button" onClick={() => { setMode("create"); setError(null); }} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${mode === "create" ? "bg-white text-[#3159d8] shadow-sm" : "text-slate-500"}`}>Sign up</button></div>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div><label htmlFor="login-email" className="text-xs font-bold">Email address</label><Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="doctor@clinic.com" className="mt-2 h-12 rounded-xl" /></div>
              <div><label htmlFor="login-password" className="text-xs font-bold">Password</label><Input id="login-password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="mt-2 h-12 rounded-xl" /></div>
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</div>}
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-[#3159d8] text-white hover:bg-[#284dc1]">{busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Sign up"}<ArrowRight /></Button>
            </form>
            <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-bold tracking-wider text-slate-400">OR</span><span className="h-px flex-1 bg-slate-200" /></div>
            <div className="space-y-3">
              <Button type="button" variant="outline" onClick={signInWithMicrosoft} className="h-12 w-full rounded-xl"><ShieldCheck /> Continue with Microsoft</Button>
              <Button type="button" variant="outline" onClick={signInWithGoogle} className="h-12 w-full rounded-xl"><ShieldCheck /> Continue with Google</Button>
              <Button type="button" variant="outline" onClick={continueDemo} className="h-12 w-full rounded-xl"><ShieldCheck /> Continue as training doctor</Button>
            </div>
            <div className="mt-6 rounded-xl bg-blue-50 p-3 text-[11px] leading-5 text-blue-800"><LockKeyhole className="mr-1 inline size-3.5" /> Email sign in works in this browser now. Microsoft and Google require their OAuth variables in Azure.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
