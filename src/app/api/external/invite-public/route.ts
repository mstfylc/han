// HAN 2.0 — Public Trader Verification & 1-Tap KVKK Opt-Out Route (/esnaf/davet/[token]).

import { NextResponse } from "next/server";

import {
  addContactOptOut,
  findCandidateByToken,
  updateCandidateShop,
} from "@/server/db";
import { normalizeContact } from "@/server/external-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = String(searchParams.get("token") || "").trim();
  if (!token || token.length < 6) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  try {
    const cand = await findCandidateByToken(token);
    if (!cand) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      candidate: {
        id: cand.id,
        name: cand.name,
        cat: cand.cat,
        placeId: cand.place_id,
        semt: cand.semt,
        floor: cand.floor,
        door: cand.door,
        address: cand.address,
        status: cand.status,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: {
    token?: string;
    action?: "confirm" | "optout";
    name?: string;
    door?: string;
    floor?: number;
    tel?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  const action = body.action;
  if (!token || (action !== "confirm" && action !== "optout")) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    const cand = await findCandidateByToken(token);
    if (!cand) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (action === "optout") {
      const contactNorm = normalizeContact(body.tel || cand.tel || "");
      if (contactNorm) {
        await addContactOptOut(contactNorm, "trader-self-optout");
      }
      await updateCandidateShop(cand.id, {
        status: "opted_out",
        notes: "KVKK tek tık ret (esnaf daveti)",
      });
      return NextResponse.json({
        ok: true,
        action: "optout",
        message: "Kaydınız kaldırıldı ve iletişim numaranız kalıcı olarak davet dışı bırakıldı.",
      });
    }

    const updated = await updateCandidateShop(cand.id, {
      status: "approved",
      name: body.name ? String(body.name).trim() : cand.name,
      door: body.door ? String(body.door).trim() : cand.door,
      floor: Number.isFinite(Number(body.floor)) ? Number(body.floor) : cand.floor,
      tel: body.tel ? String(body.tel).trim() : cand.tel,
      notes: body.notes ? String(body.notes).trim() : "Esnaf tarafından davet linkiyle doğrulandı",
    });

    return NextResponse.json({
      ok: true,
      action: "confirm",
      candidate: updated
        ? { id: updated.id, name: updated.name, door: updated.door, floor: updated.floor, status: updated.status }
        : null,
      message: "İşletme kaydınız onaylandı. HAN Dijital Rehber'e hoş geldiniz!",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}
