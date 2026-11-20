// HAN 2.0 — KVKK-compliant WhatsApp / Field QR / SMS Invite Generator.
// Enforces opt_out_contacts (403) and 30-day invite_logs anti-spam guard (429).

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import {
  hasRecentInvite,
  isContactOptedOut,
  listInviteLogs,
  logInvite,
  updateCandidateShop,
} from "@/server/db";
import { normalizeContact, requireOpsReader, requireOpsWriter } from "@/server/external-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireOpsReader();
  if (gate.error) return gate.error;
  try {
    const logs = await listInviteLogs(60);
    return NextResponse.json({ ok: true, logs });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireOpsWriter();
  if (gate.error) return gate.error;
  const me = gate.me!;

  let body: {
    candidateId?: string;
    shopName?: string;
    contact?: string;
    channel?: "whatsapp" | "sms" | "qr" | "email";
    token?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const channel = body.channel || "whatsapp";
  const shopName = String(body.shopName || "İşletmeniz").trim();
  const contactNorm = normalizeContact(body.contact || "");

  if (channel !== "qr" && contactNorm.length < 7) {
    return NextResponse.json({ ok: false, error: "contact_required" }, { status: 400 });
  }

  try {
    if (contactNorm) {
      if (await isContactOptedOut(contactNorm)) {
        return NextResponse.json(
          {
            ok: false,
            error: "opted_out",
            message: "Bu iletişim numarası KVKK kapsamında davet listesinden çıkarılmıştır.",
          },
          { status: 403 },
        );
      }

      if (await hasRecentInvite(contactNorm, 30)) {
        return NextResponse.json(
          {
            ok: false,
            error: "rate_limited_30d",
            message: "Bu numaraya son 30 gün içinde zaten bir davet oluşturuldu (KVKK anti-spam koruması).",
          },
          { status: 429 },
        );
      }
    }

    const token = String(body.token || "").trim() || randomBytes(12).toString("base64url");
    if (body.candidateId) {
      await updateCandidateShop(body.candidateId, { invite_token: token });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : "https://han.mansis.com.tr");
    const inviteUrl = `${origin.replace(/\/$/, "")}/esnaf/davet/${encodeURIComponent(token)}`;
    const messageText =
      `Merhaba, HAN Tarihi Yarımada Dijital Rehber'de "${shopName}" işletmenizin kapı ve kategori kaydını 10 saniyede ücretsiz doğrulayabilirsiniz: ${inviteUrl} ` +
      `(Listelenmek istemiyorsanız aynı bağlantıdan tek dokunuşla kaydı kaldırabilirsiniz.)`;

    const waPhone = contactNorm.replace(/\D/g, "");
    const whatsappUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    await logInvite({
      candidateId: body.candidateId || null,
      contactNorm: contactNorm || `qr:${token}`,
      channel,
      token,
      officer: me.name || me.tel,
    });

    return NextResponse.json({
      ok: true,
      token,
      channel,
      inviteUrl,
      whatsappUrl,
      messageText,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message || e) }, { status: 500 });
  }
}
