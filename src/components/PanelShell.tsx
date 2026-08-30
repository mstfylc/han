"use client";

// The operations surface's own shell.
//
// It deliberately does NOT reuse the buyer shell: this is not the bazaar seen
// by a shopper, it is the queue seen by the people who keep the directory
// honest. Different navigation, different density, and no language/currency
// controls — operations runs in Turkish, on a desk, all day.
//
// Role (E5): when a real session exists (opened at /giris), the role comes
// from the signed-in user and the selector disappears — K10's "kimim ben bir
// seçim değil oturumdur". Without a session the stored demo selector remains,
// clearly labelled, so the panel can still be explored.

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { OpsUser } from "@/data/han-admin";
import * as SC from "@/data/han-scale";
import { Icon } from "@/ds";
import * as AUTH from "@/lib/authClient";
import { readKey, writeKey } from "@/services/storage";
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

const ROLE_KEY = "han-panel-role";

export function usePanelRole(): [string, (r: string) => void, OpsUser | null] {
  const [role, setRole] = useState("yonetici");
  const [me, setMe] = useState<OpsUser | null>(null);
  // Read after mount: the server has no stored role, and reading during render
  // would make the first client render disagree with the server's.
  useEffect(() => {
    const stored = readKey<string | null>(ROLE_KEY, null);
    if (stored && SC.ROLES[stored]) setRole(stored);
    // The real session outranks the demo selector the moment it answers.
    void AUTH.me().then((r) => {
      if (r.user && SC.ROLES[r.user.role]) {
        setMe(r.user);
        setRole(r.user.role);
      }
    });
  }, []);
  return [
    role,
    (r: string) => {
      setRole(r);
      writeKey(ROLE_KEY, r);
    },
    me,
  ];
}

export function PanelShell({
  tabs, active, role, onRole, me = null, children,
}: {
  tabs: PanelTab[];
  active: string;
  role: string;
  onRole: (r: string) => void;
  /** the signed-in user, when a session exists; null keeps the demo selector */
  me?: OpsUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const readOnly = SC.isReadOnly(role);

  return (
    <div style={sx("min-height:100vh;background:var(--surface-page);font-family:var(--font-sans);font-size:15px;line-height:1.5;color:var(--text-body)")}>
      <a data-han-skip="1" href="#panel-icerik">İçeriğe geç</a>

      <header style={sx("position:sticky;top:0;z-index:30;background:var(--color-primary);box-shadow:0 4px 14px rgba(0,0,0,.12)")}>
        <div style={sx("max-width:1600px;margin:0 auto;padding:0 22px;height:56px;display:flex;align-items:center;gap:16px")}>
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

          {me ? (
            <>
              <span style={sx("display:flex;flex-direction:column;align-items:flex-end;line-height:1.25")}>
                <span style={sx("font-size:13px;font-weight:700;color:#fff")}>{me.name}</span>
                <span style={sx("font-size:11.5px;color:rgba(255,255,255,.66)")}>{SC.ROLES[role]?.tr || role}</span>
              </span>
              <button
                type="button"
                onClick={() => { void AUTH.logout().then(() => router.push("/giris")); }}
                style={sx("height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:none;color:#fff")}
              >
                Çıkış
              </button>
            </>
          ) : (
            <>
              {/* Marked as a demo control on purpose: switching roles here changes
                  what the screen offers, not what the server would allow. */}
              <label style={sx("display:flex;align-items:center;gap:7px;font-size:12.5px;color:rgba(255,255,255,.72)")}>
                <span>Rol (demo)</span>
                <select
                  value={role}
                  onChange={(e) => onRole(e.target.value)}
                  style={sx("height:32px;padding:0 8px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff")}
                >
                  {Object.keys(SC.ROLES).map((r) => (
                    <option key={r} value={r}>{SC.ROLES[r].tr}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => router.push("/giris")}
                style={sx("height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff")}
              >
                Giriş yap
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => router.push("/")}
            style={sx("height:32px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:none;color:#fff")}
          >
            Alıcı tarafı
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
                  <span style={sx("display:block;padding:" + (i === 0 ? "6px" : "14px") + " 10px 4px;font-size:10.5px;font-weight:700;letter-spacing:.07em;color:var(--text-muted)")}>
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
