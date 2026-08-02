"use client";

import Link from "next/link";
import { useState } from "react";

import { useAuthStore } from "@/store/authStore";

type AuthMode = "sign-in" | "sign-up";

export function AuthControls() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const isConfigured = useAuthStore((state) => state.isConfigured);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const signOut = useAuthStore((state) => state.signOut);
  const [isOpen, setIsOpen] = useState(false);

  if (status === "loading") {
    return <span className="account-loading" aria-label="Checking account" />;
  }

  if (user) {
    return (
      <div className="account-controls">
        <Link className="dashboard-link" href="/dashboard">Dashboard</Link>
        <span className="account-email" title={user.email}>{user.email}</span>
        <button
          className="account-button"
          type="button"
          disabled={isSubmitting}
          onClick={() => void signOut().catch(() => undefined)}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        className="account-button"
        type="button"
        disabled={!isConfigured}
        title={isConfigured ? undefined : "Configure Supabase to enable accounts"}
        onClick={() => setIsOpen(true)}
      >
        {isConfigured ? "Sign in" : "Guest mode"}
      </button>
      {isOpen ? <AuthDialog onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setNotice(null);
    clearError();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    clearError();
    try {
      if (mode === "sign-in") {
        await signIn(email, password);
        onClose();
      } else {
        const result = await signUp(email, password);
        if (result.confirmationRequired) {
          setNotice("Check your email to confirm the account, then sign in.");
        } else {
          onClose();
        }
      }
    } catch {
      // The store exposes the provider's safe error message in the dialog.
    }
  };

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close sign in dialog">×</button>
        <p className="eyebrow">Optional account</p>
        <h2 id="auth-heading">{mode === "sign-in" ? "Welcome back." : "Save your progress."}</h2>
        <p className="auth-copy">Typing and AI generation remain available without an account.</p>

        <div className="auth-tabs">
          <button className={mode === "sign-in" ? "active" : ""} type="button" onClick={() => switchMode("sign-in")}>Sign in</button>
          <button className={mode === "sign-up" ? "active" : ""} type="button" onClick={() => switchMode("sign-up")}>Create account</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
