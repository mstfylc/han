"use client";

// The operations surface's own shell.
//
// It deliberately does NOT reuse the buyer shell: this is not the bazaar seen
// by a shopper, it is the queue seen by the people who keep the directory
// honest. Different navigation, different density, and no language/currency
// controls — operations runs in Turkish, on a desk, all day.
//
// E5 · role comes from the SESSION, not from a picker. It used to be a stored
// selection labelled "demo", because a control the user sets is not access
// control. Now the server decides: /api/auth returns the signed-in user, the
// role travels with them, and someone who is not signed in is sent to /giris.
//
// Worth being precise about what this does and does not buy. Hiding a tab is
// usability, never a control: what decides whether a decision can be forged is
// the endpoint. That is enforced separately in /api/state, which reads the same
// ROLES table this menu does, so the two cannot disagree — and scripts/auth.mjs
// checks it directly rather than through the UI meant to keep you away from it.
//
// The parallel branch kept a stored "Rol (demo)" selector as a fallback for
// visitors without a session. It is gone: a role the visitor picks is not a
// role, and leaving it in a shell that also renders a real session teaches the
// wrong thing about what the panel is. No session, no panel — /giris.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import * as SC from "@/data/han-scale";
import { Icon } from "@/ds";
import { sx } from "@/lib/sx";

export interface PanelTab {
  id: string;
  label: string;
  icon: string;
  /** the permission key in han-scale's ROLES */
  perm: string;
  count?: number;
  /** tabs not yet ported show as pending rather than pretending to work */
  soon?: boolean;
  /** starts a new sidebar section with this label (prototype navAll groups) */
  group?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  tel: string;
  role: string;
}

export interface PanelSession {
  /** null while we are still asking, so the panel does not flash a queue at
   *  someone who turns out not to be signed in. */
  user: SessionUser | null;
  loading: boolean;
}

/** Who is signed in, according to the server. */
export function usePanelSession(): PanelSession {
  const [state, setState] = useState<PanelSession>({ user: null, loading: true });
  useEffect(() => {
    let live = true;
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => { if (live) setState({ user: b.user || null, loading: false }); })
      .catch(() => { if (live) setState({ user: null, loading: false }); });
    return () => { live = false; };
  }, []);
  return state;
}

export function PanelShell({
  tabs, active, user, children,
}: {
  tabs: PanelTab[];
  active: string;
  user: SessionUser;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const role = user.role;
  const readOnly = SC.isReadOnly(role);

  const signOut = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    router.push("/giris");
  };

  return (
    <div style={sx("min-height:100vh;background:var(--surface-page);font-family:var(--font-sans);font-size:15px;line-height:1.5;color:var(--text-body)")}>
      <a data-han-skip="1" href="#panel-icerik">İçeriğe geç</a>

      {/* The panel is a desk tool, but a yetkili in the field opens it on a
          phone: below 900px the sidebar folds above the content as a wrapping
          chip row and the header may break to two lines. !important is the
          only lever that outranks the inline styles this shell is written in. */}
      <style>{`
        @media (max-width: 900px) {
          [data-panel-head="1"] { flex-wrap: wrap !important; height: auto !important; min-height: 56px; padding-block: 8px !important; row-gap: 6px !important; }
          [data-panel-grid="1"] { grid-template-columns: minmax(0,1fr) !important; }
          [data-panel-grid="1"] > nav { position: static !important; max-height: none !important; flex-direction: row !important; flex-wrap: wrap !important; }
          [data-panel-grid="1"] > nav button { width: auto !important; }
          [data-panel-grid="1"] [data-nav-label="1"] { flex: 1 0 100%; padding-block: 8px 2px !important; }
        }
      `}</style>

      <header style={sx("position:sticky;top:0;z-index:30;background:var(--color-primary);box-shadow:0 4px 14px rgba(0,0,0,.12)")}>
        <div data-panel-head="1" style={sx("max-width:1600px;margin:0 auto;padding:0 22px;height:56px;display:flex;align-items:center;gap:16px")}>
          <button
            type="button"
            onClick={() => router.push("/panel")}
            style={sx("flex:none;display:flex;align-items:center;gap:9px;background:none;border:none;padding:0;cursor:pointer")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/han-mark.svg" alt="" width={28} height={28} style={sx("display:block;border-radius:7px")} />
            <span style={sx("font-size:19px;font-weight:800;color:#fff;letter-spacing:.02em")}>HAN</span>
            <span style={sx("font-size:13px;font-weight:600;color:rgba(255,255,255,.72);padding-inline-start:2px")}>Yönetim</span>
          </button>

          <span style={sx("flex:1")} />

          {readOnly && (
            <span style={sx("display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:700;background:rgba(255,255,255,.16);color:#fff")}>
              Salt okuma
            </span>
          )}

          <span style={sx("font-size:12.5px;color:rgba(255,255,255,.78)")}>
            {(user.name || user.tel) + " · " + (SC.ROLES[role]?.tr || role)}
          </span>

          <button
            type="button"
            onClick={() => router.push("/")}
            style={sx("height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:none;color:#fff")}
          >
            Alıcı tarafı
          </button>

          <button
            type="button"
            onClick={signOut}
            style={sx("height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:none;color:#fff")}
          >
            Çıkış
          </button>
        </div>
      </header>

      <div style={sx("max-width:1600px;margin:0 auto;padding:20px 22px 48px;display:grid;gap:20px;align-items:start;grid-template-columns:minmax(0,1fr)")}>
        <div style={sx("display:grid;gap:20px;align-items:start;grid-template-columns:238px minmax(0,1fr)")} data-panel-grid="1">
          <nav
            style={sx("position:sticky;top:76px;background:var(--surface-card);border:1px solid var(--border-strong);border-radius:14px;padding:8px;box-shadow:0 3px 4px rgba(0,0,0,.03);display:flex;flex-direction:column;gap:2px;max-height:calc(100vh - 96px);overflow-y:auto")}
            aria-label="Yönetim bölümleri"
          >
            {tabs.map((t, i) => {
              const allowed = SC.can(role, t.perm);
              const on = t.id === active;
              // A section label only earns its place if the role can see at
              // least one tab in the section (the prototype's navFor rule).
              const section = t.group && (() => {
                const end = tabs.findIndex((x, j) => j > i && x.group);
                const members = tabs.slice(i, end === -1 ? undefined : end);
                return members.some((x) => SC.can(role, x.perm));
              })();
              return (
                <span key={t.id} style={sx("display:contents")}>
                {section && (
                  <span data-nav-label="1" style={sx("display:block;padding:" + (i === 0 ? "6px" : "14px") + " 10px 4px;font-size:10.5px;font-weight:700;letter-spacing:.07em;color:var(--text-muted)")}>
                    {t.group}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!allowed}
                  aria-current={on ? "page" : undefined}
                  onClick={() => router.push("/panel/" + t.id)}
                  title={allowed ? undefined : SC.ROLES[role].tr + " bu bölümü görmez"}
                  style={sx(
                    "display:flex;align-items:center;gap:9px;width:100%;padding:9px 10px;border-radius:9px;font-family:inherit;font-size:13.5px;text-align:start;border:none;background:" +
                      (on ? "var(--color-primary-soft)" : "none") +
                      ";color:" + (!allowed ? "var(--text-muted)" : on ? "var(--color-primary-accent)" : "var(--text-body)") +
                      ";font-weight:" + (on ? "700" : "500") +
                      ";cursor:" + (allowed ? "pointer" : "not-allowed") +
                      ";opacity:" + (allowed ? "1" : ".45"),
                  )}
                >
                  <Icon name={t.icon} size={16} />
                  <span style={sx("flex:1;min-width:0")}>{t.label}</span>
                  {t.soon && (
                    <span style={sx("flex:none;font-size:10.5px;font-weight:700;letter-spacing:.04em;color:var(--text-muted)")}>YAKINDA</span>
                  )}
                  {!t.soon && !!t.count && (
                    <span style={sx("flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:19px;padding:0 6px;border-radius:999px;font-size:11.5px;font-weight:700;background:var(--color-primary-soft);color:var(--color-primary-accent)")}>
                      {t.count}
                    </span>
                  )}
                </button>
                </span>
              );
            })}
          </nav>

          <main id="panel-icerik" key={pathname} style={sx("min-width:0")}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
