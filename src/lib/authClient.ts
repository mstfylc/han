"use client";

// The browser side of the real session. Every call hits /api/auth/*; the
// session itself is an httpOnly cookie, so nothing here stores or reads a
// secret — the Giriş footnote's promise, kept.

import type { OpsUser } from "@/data/han-admin";

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export interface MeResult {
  user: OpsUser | null;
  noUsers: boolean;
  /** userId → has a password; present only for a signed-in operations user */
  pins?: Record<string, boolean>;
}

export async function me(): Promise<MeResult> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const b = (await res.json()) as { user?: OpsUser | null; noUsers?: boolean; pins?: Record<string, boolean> };
    return { user: b.user || null, noUsers: !!b.noUsers, pins: b.pins };
  } catch {
    return { user: null, noUsers: false };
  }
}

export interface LoginReply {
  ok: boolean;
  err?: "yok" | "kapali" | "kilit" | "pinsiz" | "hatali";
  msg?: string;
  user?: OpsUser;
  userId?: string;
}

export function login(tel: string, pin: string): Promise<LoginReply> {
  return post<LoginReply>("/api/auth/login", { tel, pin });
}

export function logout(): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>("/api/auth/logout");
}

export interface ResetReply {
  ok: boolean;
  msg?: string;
  masked?: string;
  /** returned because there is no SMS gateway; the screen labels it PROTOTİP */
  demoCode?: string | null;
}

export function resetRequest(target: { tel?: string; userId?: string }): Promise<ResetReply> {
  return post<ResetReply>("/api/auth/reset/request", target);
}

export function resetApply(code: string, pin: string): Promise<{ ok: boolean; msg?: string; user?: OpsUser }> {
  return post("/api/auth/reset/apply", { code, pin });
}

export function seedFirstAdmin(tel: string): Promise<ResetReply & { user?: OpsUser }> {
  return post("/api/auth/seed", { tel });
}
