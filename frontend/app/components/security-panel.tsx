"use client";

import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest, setCsrfToken } from "@/lib/api/client";
import { Feedback } from "./feedback";

type Session = {
  id: string;
  current: boolean;
  client: string;
  network: string;
  lastUsedAt: string;
  expiresAt: string;
  mfaVerified: boolean;
};
type Factor = {
  id: string;
  type: string;
  status: string;
  name: string | null;
  createdAt: string;
};

export function SecurityPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [sessionResult, factorResult] = await Promise.all([
      apiRequest<{ sessions: Session[] }>("/auth/sessions"),
      apiRequest<{ factors: Factor[] }>("/auth/mfa/factors"),
    ]);
    setSessions(sessionResult.data?.sessions ?? []);
    setFactors(factorResult.data?.factors ?? []);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<{ sessions: Session[] }>("/auth/sessions"),
      apiRequest<{ factors: Factor[] }>("/auth/mfa/factors"),
    ])
      .then(([sessionResult, factorResult]) => {
        if (!active) return;
        setSessions(sessionResult.data?.sessions ?? []);
        setFactors(factorResult.data?.factors ?? []);
      })
      .catch((error_: unknown) => {
        if (active)
          setError(
            error_ instanceof Error
              ? error_.message
              : "Security settings could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function revoke(id: string) {
    try {
      await apiRequest<never>(`/auth/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        csrf: true,
        body: {},
      });
      await load();
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Session could not be revoked.",
      );
    }
  }

  async function change(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = form.get("currentPassword");
    try {
      const result = await apiRequest<{ csrfToken: string }>("/auth/password/change", {
        method: "POST",
        csrf: true,
        body: {
          currentPassword: typeof currentPassword === "string" ? currentPassword : "",
          newPassword:
            typeof form.get("newPassword") === "string" ? form.get("newPassword") : "",
        },
      });
      setCsrfToken(result.data?.csrfToken);
      setMessage(result.message);
      event.currentTarget.reset();
      await load();
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Password could not be changed.",
      );
    }
  }

  return (
    <>
      <span className="eyebrow">Account protection</span>
      <h1>Security.</h1>
      <Feedback message={message} tone="success" />
      <Feedback message={error} />
      <section className="card">
        <h3>
          <KeyRound size={18} /> Change password
        </h3>
        <form onSubmit={change}>
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New passphrase</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </div>
          <button type="submit" className="button">
            Change and rotate session
          </button>
        </form>
      </section>
      <div className="section-head" style={{ marginTop: 40 }}>
        <div>
          <span className="eyebrow">Second factors</span>
          <h2>MFA factors</h2>
        </div>
      </div>
      <div className="list">
        {factors.map((f) => (
          <div className="list-item" key={f.id}>
            <div>
              <h3>
                <ShieldCheck size={16} /> {f.name ?? f.type}
              </h3>
              <span className="muted">
                {f.type} · {f.status}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="section-head" style={{ marginTop: 40 }}>
        <div>
          <span className="eyebrow">Active access</span>
          <h2>Sessions</h2>
        </div>
      </div>
      <div className="list">
        {sessions.map((s) => (
          <div className="list-item" key={s.id}>
            <div>
              <h3>
                {s.client}
                {s.current ? " · This device" : ""}
              </h3>
              <span className="muted">
                {s.network} · Last used {new Date(s.lastUsedAt).toLocaleString("en-NG")}
              </span>
            </div>
            {!s.current && (
              <button
                className="icon-button"
                aria-label={`Revoke ${s.client} session`}
                title="Revoke session"
                onClick={() => void revoke(s.id)}
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
