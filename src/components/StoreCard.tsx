"use client";

// StoreCard — the shop card, as designed.
//
// The bespoke card the home screen grew was thinner than the handoff's: it lost
// the trade badges, the minimum order, the product tags and the ranking reason.
// Those are not decoration. A buyer scanning a row of shops decides on exactly
// those four things — can I buy one or must I buy fifty, does this shop sell to
// me at all, does it carry the thing I asked for, and why is it in front of me.
//
// The "why" line matters most and is the easiest to drop: an order nobody can
// account for reads as arbitrary, which is the fastest way to lose a directory's
// credibility.

import { ImageSlot } from "@/components/ImageSlot";
import { Icon } from "@/ds";
import { sx } from "@/lib/sx";

export interface StoreCardProps {
  name: string;
  /** where it is — "Yıldız Han · Kat 2" */
  location: string;
  photo?: string | null;
  verified?: boolean;
  verifiedLabel?: string;
  rating?: string | number | null;
  distance?: string;
  /** the price this shop starts at, already formatted */
  price?: string;
  /** the "≈ $12" beside it, or "" when there is nothing to convert to */
  alt?: string;
  fromLabel?: string;
  /** at most two product groups: a wall of tags says nothing */
  tags?: string[];
  wholesale?: boolean;
  retail?: boolean;
  producer?: boolean;
  taxFree?: boolean;
  /** "min. 50 adet" — the single fact that decides whether this shop is for you */
  minLabel?: string;
  /** why this shop is where it is in the list */
  why?: string;
  labels?: { wholesale: string; retail: string; producer: string; taxFree: string };
  onOpen: () => void;
}

const BADGE =
  "display:inline-flex;align-items:center;height:23px;padding:0 9px;border-radius:6px;font-size:11.5px;font-weight:700;letter-spacing:.02em;";

export function StoreCard({
  name, location, photo, verified, verifiedLabel = "Doğrulanmış",
  rating, distance, price, alt, fromLabel, tags = [],
  wholesale, retail, producer, taxFree, minLabel, why,
  labels = { wholesale: "Toptan", retail: "Perakende", producer: "Üretici", taxFree: "Tax-free" },
  onOpen,
}: StoreCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={sx("display:flex;flex-direction:column;align-items:stretch;width:100%;border-radius:14px;border:1px solid var(--border-strong);background:var(--surface-card);box-shadow:0 3px 4px rgba(0,0,0,.03);overflow:hidden;font-family:inherit;text-align:start;cursor:pointer;padding:0")}
    >
      <span style={sx("position:relative;display:block;height:150px;background:var(--surface-muted)")}>
        <ImageSlot src={photo || null} placeholder={name} decorative />

        {verified && (
          <span style={sx("position:absolute;top:10px;inset-inline-start:10px;display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px;border-radius:999px;background:rgba(255,255,255,.94);color:var(--color-success);font-size:12px;font-weight:700;pointer-events:none")}>
            <Icon name="verify" size={14} />
            {verifiedLabel}
          </span>
        )}

        {rating != null && rating !== "" && (
          <span style={sx("position:absolute;top:10px;inset-inline-end:10px;display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 9px;border-radius:999px;background:rgba(255,255,255,.94);color:var(--text-heading);font-size:12px;font-weight:700;pointer-events:none")}>
            <span style={sx("color:var(--color-warning);display:flex")}><Icon name="star" size={14} /></span>
            {rating}
          </span>
        )}

        {!!distance && (
          <span style={sx("position:absolute;bottom:10px;inset-inline-start:10px;display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;background:rgba(11,26,43,.82);color:#fff;font-size:12px;font-weight:600;pointer-events:none")}>
            <Icon name="rocket" size={13} />
            {distance}
          </span>
        )}
      </span>

      <span style={sx("display:block;padding:14px 16px 16px")}>
        <span style={sx("display:block;font-size:18px;font-weight:600;line-height:1.3;color:var(--text-heading);letter-spacing:-.01em;text-wrap:pretty")}>
          {name}
        </span>

        <span style={sx("display:flex;align-items:center;gap:6px;margin-top:4px;font-size:14px;color:var(--text-muted)")}>
          <span style={sx("color:var(--color-primary);display:flex;flex:none")}><Icon name="category" size={15} /></span>
          <span style={sx("min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{location}</span>
        </span>

        {/* Say why it ranks here. An unexplained order looks like a paid one. */}
        {!!why && (
          <span style={sx("display:block;margin-top:8px;font-size:12.5px;color:var(--color-primary);font-weight:600;text-wrap:pretty")}>
            {why}
          </span>
        )}

        {(wholesale || retail || producer || taxFree || minLabel) && (
          <span style={sx("display:flex;flex-wrap:wrap;gap:6px;margin-top:10px")}>
            {wholesale && <span style={sx(BADGE + "background:var(--color-primary-soft);color:var(--color-primary)")}>{labels.wholesale}</span>}
            {retail && <span style={sx(BADGE + "background:var(--color-info-soft);color:var(--color-info)")}>{labels.retail}</span>}
            {producer && <span style={sx(BADGE + "background:var(--color-success-soft);color:var(--color-success-accent)")}>{labels.producer}</span>}
            {taxFree && <span style={sx(BADGE + "background:var(--color-accent-soft);color:var(--color-accent-active)")}>{labels.taxFree}</span>}
            {!!minLabel && (
              <span style={sx("display:inline-flex;align-items:center;height:23px;padding:0 9px;border-radius:6px;font-size:11.5px;font-weight:600;background:var(--surface-muted);color:var(--text-muted);border:1px solid var(--border-default)")}>
                {minLabel}
              </span>
            )}
          </span>
        )}

        <span style={sx("display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:12px")}>
          <span style={sx("display:flex;flex-wrap:wrap;gap:6px;min-width:0")}>
            {/* Two, deliberately. A card that lists everything sorts nothing. */}
            {tags.slice(0, 2).map((t) => (
              <span key={t} style={sx("display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:600;background:var(--surface-muted);color:var(--text-body);border:1px solid var(--border-default)")}>
                {t}
              </span>
            ))}
          </span>

          {!!price && (
            <span style={sx("flex:none;text-align:end")}>
              {!!fromLabel && <span style={sx("display:block;font-size:11px;color:var(--text-muted);line-height:1.2")}>{fromLabel}</span>}
              <span style={sx("display:block;font-size:18px;font-weight:700;color:var(--color-primary);letter-spacing:-.01em")}>{price}</span>
              {!!alt && <span style={sx("display:block;font-size:11.5px;color:var(--text-muted);line-height:1.2;margin-top:1px")}>{alt}</span>}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
