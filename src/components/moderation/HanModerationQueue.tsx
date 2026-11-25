"use client";

// HAN — Han & Door-Number Grouped Moderation Queue.
// Renders records grouped by Han/Bazaar and sorted deterministically by floor -> door number.

import type { HanModerationGroup } from "@/lib/moderationGrouping";
import { sx } from "@/lib/sx";

const STATUS_TONE: Record<string, string> = {
  aktif: "success",
  onayli: "primary",
  beyan: "warning",
  askida: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  onayli: "Onaylı",
  beyan: "Beyan",
  askida: "Askıda",
};

export interface HanModerationQueueProps {
  groups: HanModerationGroup[];
  expandedIds: Record<string, boolean>;
  onToggleGroup: (placeId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

export function HanModerationQueue({
  groups,
  expandedIds,
  onToggleGroup,
  onSelectRecord,
}: HanModerationQueueProps) {
  return (
    <div style={sx("margin-top:14px;display:flex;flex-direction:column;gap:12px")}>
      {groups.map((g) => {
        const open = expandedIds[g.placeId] ?? (g.placeId === "santral" || groups.length <= 2);
        return (
          <section
            key={g.placeId}
            style={sx(
              "border-radius:var(--radius-card, 16px);border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:var(--shadow-card);overflow:hidden",
            )}
          >
            <button
              type="button"
              onClick={() => onToggleGroup(g.placeId)}
              aria-expanded={open}
              style={sx(
                "width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;border:none;background:var(--surface-muted);font-family:inherit;text-align:start;cursor:pointer",
              )}
            >
              <div>
                <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                  <span style={sx("font-size:15.5px;font-weight:800;color:var(--text-heading)")}>
                    {g.placeId === "santral" ? "★ " : ""}
                    {g.placeName}
                  </span>
                  <span style={sx("font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--color-primary-soft);color:var(--color-primary)")}>
                    {g.records.length} kayıt
                  </span>
                  {g.counts.beyan > 0 && (
                    <span style={sx("font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--color-warning-soft);color:var(--color-warning)")}>
                      {g.counts.beyan} beyan
                    </span>
                  )}
                  {g.counts.noPhoto > 0 && (
                    <span style={sx("font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--surface-card);border:1px solid var(--border-strong);color:var(--text-muted)")}>
                      📷 {g.counts.noPhoto} foto yok
                    </span>
                  )}
                </div>
                <div style={sx("font-size:12px;color:var(--text-muted);margin-top:3px")}>
                  Aktif: {g.counts.aktif} · Onaylı: {g.counts.onayli} · Askıda: {g.counts.askida} · Toplam birim: {g.totalUnits}
                </div>
              </div>
              <span style={sx("font-size:13px;font-weight:800;color:var(--color-primary)")}>
                {open ? "Daralt ▴" : "Kapıları Göster ▾"}
              </span>
            </button>

            {open && (
              <div style={sx("display:flex;flex-direction:column")}>
                {g.records.slice(0, 60).map((r) => {
                  const fl = g.place?.floorLabels?.[r.floor] || (r.floor === 0 ? "Zemin" : `Kat ${r.floor}`);
                  const tone = STATUS_TONE[r.status] || "warning";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelectRecord(r.id)}
                      style={sx(
                        "width:100%;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 18px;border:none;border-top:1px solid var(--border-default);background:var(--surface-card);font-family:inherit;text-align:start;cursor:pointer",
                      )}
                    >
                      <span
                        style={sx(
                          "flex:none;min-width:96px;padding:4px 8px;border-radius:7px;background:var(--surface-muted);font-family:var(--font-mono);font-size:12px;font-weight:800;color:var(--color-primary)",
                        )}
                      >
                        {fl} · No:{r.door}
                      </span>
                      <span style={sx("flex:1;min-width:180px")}>
                        <span style={sx("font-size:13.5px;font-weight:700;color:var(--text-heading)")}>
                          {r.name || "İsimsiz kayıt"}
                        </span>
                        <span style={sx("display:block;font-size:12px;color:var(--text-muted)")}>
                          {r.cat || "genel"} {!r.photos ? "· Fotoğraf yok" : `· ${r.photos} foto`}
                        </span>
                      </span>
                      <span
                        style={sx(
                          `flex:none;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:800;background:var(--color-${tone}-soft);color:var(--color-${tone})`,
                        )}
                      >
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </button>
                  );
                })}
                {g.records.length > 60 && (
                  <div style={sx("padding:10px 18px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border-default)")}>
                    İlk 60 kapı gösteriliyor (toplam {g.records.length} kayıt — aramayla daraltabilirsiniz).
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
