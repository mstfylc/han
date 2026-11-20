// HAN 2.0 — RBAC-protected Candidate Shop Queue (OSM / Field / Manual) with fast approve/field/reject.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import {
  listCandidateShops,
  updateCandidateShop,
  upsertCandidateShop,
} from "@/server/db";
import { requireOpsReader, requireOpsWriter } from "@/server/external-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireOpsReader();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  try {
    const candidates = await listCandidateShops(status, 120);
    return NextResponse.json({ ok: true, count: candidates.length, candidates });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireOpsWriter();
  if (gate.error) return gate.error;

  let body: {
    name?: string;
    cat?: string;
    placeId?: string;
    semt?: string;
    floor?: number;
    door?: string;
    tel?: string;
    address?: string;
    source?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  try {
    const row = await upsertCandidateShop({
      id: "cand-" + randomBytes(6).toString("hex"),
      source: String(body.source || "manual"),
      external_id: null,
      name,
      cat: String(body.cat || "bijuteri"),
      place_id: body.placeId ? String(body.placeId) : "santral",
      semt: body.semt ? String(body.semt) : "tahtakale",
      floor: Number.isFinite(Number(body.floor)) ? Number(body.floor) : 0,
      door: body.door ? String(body.door) : null,
      tel: String(body.tel || "").trim(),
      address: String(body.address || "").trim(),
      lat: null,
      lng: null,
      status: "pending",
      invite_token: randomBytes(12).toString("base64url"),
      notes: String(body.notes || "").trim(),
      raw: {},
    });
    return NextResponse.json({ ok: true, candidate: row });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const gate = await requireOpsWriter();
  if (gate.error) return gate.error;

  let body: {
    id?: string;
    action?: "approve" | "field" | "reject" | "pending";
    name?: string;
    cat?: string;
    placeId?: string;
    floor?: number;
    door?: string;
    tel?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const statusMap: Record<string, string> = {
    approve: "approved",
    field: "field_task",
    reject: "rejected",
    pending: "pending",
  };
  const nextStatus = body.action ? statusMap[body.action] : undefined;

  try {
    const updated = await updateCandidateShop(id, {
      status: nextStatus,
      name: body.name,
      cat: body.cat,
      place_id: body.placeId,
      floor: body.floor,
      door: body.door,
      tel: body.tel,
      notes: body.notes,
    });
    if (!updated) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, candidate: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}
