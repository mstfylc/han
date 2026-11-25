"use client";

// HAN — Moderation Group Toolbar: switches between flat table and Han & Door-Number grouped moderation.

import type { ModerationGroupSort } from "@/lib/moderationGrouping";
import { sx } from "@/lib/sx";

export interface ModerationGroupToolbarProps {
  grouped: boolean;
  onToggleGrouped: (next: boolean) => void;
  groupSort: ModerationGroupSort;
  onGroupSort: (next: ModerationGroupSort) => void;
  groupCount: number;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
}

export function ModerationGroupToolbar({
  grouped,
  onToggleGrouped,
  groupSort,
  onGroupSort,
  groupCount,
  allExpanded,
  onToggleExpandAll,
}: ModerationGroupToolbarProps) {
  return (
    <div
      style={sx(
        "margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;border:1px solid var(--border-default);background:var(--surface-muted)",
      )}
    >
      <div style={sx("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
        <button
          type="button"
          onClick={() => onToggleGrouped(false)}
          aria-pressed={!grouped}
          style={sx(
            "height:30px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
              (!grouped
                ? "var(--color-primary);background:var(--color-primary);color:#fff"
                : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
          )}
        >
          Düz Liste
        </button>
        <button
          type="button"
          onClick={() => onToggleGrouped(true)}
          aria-pressed={grouped}
          style={sx(
            "height:30px;padding:0 12px;border-radius:8px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid " +
              (grouped
                ? "var(--color-primary);background:var(--color-primary);color:#fff"
                : "var(--border-strong);background:var(--surface-card);color:var(--text-body)"),
          )}
        >
          🏛️ Han &amp; Kapı No Gruplu ({groupCount} han)
        </button>
      </div>

      {grouped && (
        <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
          <span style={sx("font-size:12px;font-weight:700;color:var(--text-muted)")}>Sıra:</span>
          {(
            [
              ["pending", "Önce Beyan"],
              ["noPhoto", "Fotoğrafsız"],
              ["total", "Kayıt Sayısı"],
              ["alpha", "A–Z"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onGroupSort(id)}
              style={sx(
                "height:28px;padding:0 10px;border-radius:999px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;border:1px solid " +
                  (groupSort === id
                    ? "var(--color-accent);background:var(--color-accent-soft);color:var(--text-heading)"
                    : "var(--border-strong);background:var(--surface-card);color:var(--text-muted)"),
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleExpandAll}
            style={sx(
              "height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-card);color:var(--color-primary);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer",
            )}
          >
            {allExpanded ? "Tümünü Daralt" : "Tümünü Aç"}
          </button>
        </div>
      )}
    </div>
  );
}
