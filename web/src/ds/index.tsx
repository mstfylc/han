// HAN — design system components.
//
// Ported from the `web/mobil/UI` bundle shipped with the handoff, which
// exported these on `window.WebMobilUI_422163`. Same markup, same class names,
// same props — only typed, tree-shakeable, and with the stylesheet extracted
// into ./ds.css instead of being injected at runtime.
//
// The handoff's instruction was explicit: take the tokens, map the components
// onto your own library, don't redraw from scratch.

import type {
  ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode,
  SelectHTMLAttributes, TextareaHTMLAttributes,
} from "react";
import { useEffect } from "react";

import { MT_ICONS } from "./icons";

export type Tone = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "dark" | "accent";
export type Size = "sm" | "md" | "lg";

// ── Icon ──────────────────────────────────────────────────────────────────

export interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  style?: CSSProperties;
  className?: string;
  "aria-hidden"?: boolean;
}

/** Inline SVG glyph. Uses `fill="currentColor"`, so it takes the colour of
 *  whatever it sits in and needs no dark-mode variant. */
export function Icon({ name, size = 20, color, style = {}, className = "", ...rest }: IconProps) {
  const markup = MT_ICONS[name] || "";
  const dim = typeof size === "number" ? size + "px" : size;
  return (
    <span
      className={"mt-icon " + className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        color: color || "currentColor",
        flex: "none",
        ...style,
      }}
      // The icon set is a build-time constant in this repo, not user input.
      dangerouslySetInnerHTML={{
        __html: markup.replace("<svg ", '<svg style="width:100%;height:100%;display:block" '),
      }}
      {...rest}
    />
  );
}

// ── Button ────────────────────────────────────────────────────────────────

const ICON_SIZE: Record<Size, number> = { sm: 14, md: 16, lg: 18 };

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: "solid" | "light" | "outline" | "ghost" | "link";
  color?: Tone;
  size?: Size;
  iconStart?: string;
  iconEnd?: string;
  fullWidth?: boolean;
  children?: ReactNode;
}

/**
 * The primary action control.
 *
 * House rule from the handoff (§7): at most ONE filled orange button on a
 * screen, and only for the primary conversion action — send the offer, accept,
 * sign in. Routine saves are filled navy; secondary actions outline or light;
 * tertiary ghost.
 */
export function Button({
  children,
  variant = "solid",
  color = "primary",
  size = "md",
  iconStart,
  iconEnd,
  fullWidth = false,
  disabled = false,
  className = "",
  ...rest
}: ButtonProps) {
  const cls = ["mtbtn", `mtbtn--${variant}`, `mtbtn--${size}`, `c-${color}`, fullWidth ? "mtbtn--full" : "", className]
    .filter(Boolean)
    .join(" ");
  const isz = ICON_SIZE[size];
  return (
    <button className={cls} disabled={disabled} aria-disabled={disabled || undefined} {...rest}>
      {iconStart && <Icon name={iconStart} size={isz} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={isz} />}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  icon: string;
  variant?: ButtonProps["variant"];
  color?: Tone;
  size?: Size;
  rounded?: boolean;
  "aria-label": string;
}

/** A square button holding a single icon. `aria-label` is required — an icon
 *  alone tells a screen reader nothing. */
export function IconButton({
  icon,
  variant = "ghost",
  color = "secondary",
  size = "md",
  rounded = false,
  className = "",
  ...rest
}: IconButtonProps) {
  const cls = ["mtbtn", `mtbtn--${variant}`, `mtbtn--${size}`, "mtbtn--icon", `c-${color}`, className]
    .filter(Boolean)
    .join(" ");
  const isz = { sm: 16, md: 18, lg: 20 }[size];
  return (
    <button className={cls} style={rounded ? { borderRadius: "var(--radius-full)" } : undefined} {...rest}>
      <Icon name={icon} size={isz} />
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────

export interface BadgeProps {
  children?: ReactNode;
  variant?: "solid" | "light" | "outline";
  color?: Tone;
  size?: Size;
  dot?: boolean;
  pill?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Status or category label. */
export function Badge({
  children,
  variant = "light",
  color = "primary",
  size = "md",
  dot = false,
  pill = false,
  className = "",
  style,
}: BadgeProps) {
  const cls = ["mtbadge", `mtbadge--${variant}`, `mtbadge--${size}`, `b-${color}`, pill ? "mtbadge--pill" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} style={style}>
      {dot && <span className="mtbadge__dot" />}
      {children}
    </span>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────

const DEFAULT_ALERT_ICON: Record<string, string> = {
  primary: "shield-search",
  success: "check-circle",
  danger: "cross-circle",
  warning: "shield-search",
  info: "shield-search",
};

export interface AlertProps {
  children?: ReactNode;
  title?: ReactNode;
  color?: Tone;
  variant?: "light" | "solid" | "outline";
  /** Pass `null` to suppress the icon entirely. */
  icon?: string | null;
  onClose?: () => void;
  className?: string;
  style?: CSSProperties;
}

/** Inline contextual message banner. */
export function Alert({
  children,
  title,
  color = "primary",
  variant = "light",
  icon,
  onClose,
  className = "",
  style,
}: AlertProps) {
  const ic = icon === undefined ? DEFAULT_ALERT_ICON[color] : icon;
  return (
    <div
      className={["mtalert", `mtalert--${variant}`, `a-${color}`, className].filter(Boolean).join(" ")}
      role="alert"
      style={style}
    >
      {ic && <Icon className="mtalert__icon" name={ic} size={18} />}
      <div className="mtalert__content">
        {title && <div className="mtalert__title">{title}</div>}
        {children && <div className="mtalert__text">{children}</div>}
      </div>
      {onClose && (
        <button className="mtalert__close" aria-label="Kapat" onClick={onClose} type="button">
          <span
            className="mt-icon"
            style={{ width: 14, height: 14 }}
            dangerouslySetInnerHTML={{
              __html:
                '<svg viewBox="0 0 12 12" fill="none" style="width:100%;height:100%;display:block"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
            }}
          />
        </button>
      )}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: string | null;
  tone?: "primary" | "neutral" | "danger";
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * The zero-data placeholder — the "empty" branch of loading / empty / error /
 * full. Write the copy honestly: if there is no number, say 0 or "no records
 * yet", never demo data (trap 12).
 */
export function EmptyState({
  icon = "files",
  tone = "primary",
  title,
  description,
  actions,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={"mtempty" + (compact ? " mtempty--compact" : "") + (className ? " " + className : "")}>
      {icon && (
        <div className={"mtempty__art" + (tone !== "primary" ? " mtempty__art--" + tone : "")}>
          <Icon name={icon} size={compact ? 24 : 28} />
        </div>
      )}
      {title && <p className="mtempty__title">{title}</p>}
      {description && <p className="mtempty__desc">{description}</p>}
      {actions && <div className="mtempty__actions">{actions}</div>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

export interface SkeletonProps {
  variant?: "text" | "circle" | "rect";
  width?: number | string;
  height?: number | string;
  lines?: number;
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Loading placeholder. For multi-line text pass `lines`; the last line is
 *  shortened so it reads as prose rather than a block. */
export function Skeleton({
  variant = "rect",
  width,
  height,
  lines = 1,
  animated = true,
  className = "",
  style = {},
}: SkeletonProps) {
  const base = "mtskel mtskel--" + variant + (animated ? "" : " mtskel--still") + (className ? " " + className : "");
  if (variant === "text" && lines > 1) {
    return (
      <span style={{ display: "block" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className={base} style={{ width: i === lines - 1 ? "62%" : width || "100%", height, ...style }} />
        ))}
      </span>
    );
  }
  return (
    <span
      className={base}
      style={{
        width: width ?? (variant === "circle" ? 40 : "100%"),
        height: height ?? (variant === "circle" ? 40 : variant === "text" ? undefined : 16),
        ...style,
      }}
    />
  );
}

// ── Form controls ─────────────────────────────────────────────────────────

function fieldId(id: string | undefined, label: ReactNode): string | undefined {
  if (id) return id;
  if (typeof label === "string") return "mt-" + label.replace(/\s+/g, "-").toLowerCase();
  return undefined;
}

export interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** Label + required marker + hint/error around any control, so a Select or a
 *  custom widget gets exactly the treatment an Input gets. */
export function FormField({ label, hint, error, required = false, htmlFor, children, className = "" }: FieldShellProps) {
  return (
    <div className={"mtfield " + className}>
      {label && (
        <label className="mtfield__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {(error || hint) && <span className={"mtfield__hint" + (error ? " err" : "")}>{error || hint}</span>}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  size?: Size;
  iconLead?: string;
  iconTrail?: string;
}

export function Input({
  label, hint, error, required = false, size = "md", iconLead, iconTrail, id, className = "", ...rest
}: InputProps) {
  const fid = fieldId(id, label);
  const cls = [
    "mtinput", `mtinput--${size}`,
    iconLead ? "mtinput--has-lead" : "",
    iconTrail ? "mtinput--has-trail" : "",
    error ? "mtinput--err" : "",
    className,
  ].filter(Boolean).join(" ");

  const field = (
    <div className="mtinput-wrap">
      {iconLead && <Icon className="lead" name={iconLead} size={16} />}
      <input id={fid} className={cls} aria-invalid={!!error} {...rest} />
      {iconTrail && <Icon className="trail" name={iconTrail} size={16} />}
    </div>
  );

  if (!label && !hint && !error) return field;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={fid}>
      {field}
    </FormField>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

export function Textarea({ label, hint, error, required = false, id, rows = 4, className = "", ...rest }: TextareaProps) {
  const fid = fieldId(id, label);
  const ta = (
    <textarea
      id={fid}
      rows={rows}
      className={"mtinput" + (error ? " mtinput--err" : "") + (className ? " " + className : "")}
      aria-invalid={!!error}
      {...rest}
    />
  );
  if (!label && !hint && !error) return ta;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={fid}>
      {ta}
    </FormField>
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  size?: Size;
}

/** Native select styled as a field, with a chevron affordance. Native is
 *  deliberate: it is the control a phone browser already knows how to open. */
export function Select({
  label, hint, error, required = false, size = "md", id, children, className = "", ...rest
}: SelectProps) {
  const fid = fieldId(id, label);
  const field = (
    <div className="mtinput-wrap mtselect-wrap">
      <select
        id={fid}
        className={["mtinput", `mtinput--${size}`, error ? "mtinput--err" : "", className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
      </select>
      <Icon className="trail" name="chevron-down" size={16} />
    </div>
  );
  if (!label && !hint && !error) return field;
  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={fid}>
      {field}
    </FormField>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────

export interface DrawerProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  children?: ReactNode;
  footer?: ReactNode;
  closeOnScrim?: boolean;
}

/** Escape closes; the page behind stops scrolling while it is open. */
function useEscClose(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

export function Drawer({
  open, onClose, title, subtitle, size = "md", children, footer, closeOnScrim = true,
}: DrawerProps) {
  useEscClose(open, onClose);
  if (!open) return null;
  return (
    <div className="mtov mtov--drawer" role="dialog" aria-modal="true">
      <div className="mtov__scrim" onClick={closeOnScrim ? onClose : undefined} />
      <div className={"mtdrawer mtdrawer--" + size}>
        <div className="mtdrawer__hd">
          <div className="mtdrawer__hd-tx">
            {title && <div className="mtdrawer__title">{title}</div>}
            {subtitle && <div className="mtdrawer__sub">{subtitle}</div>}
          </div>
          {onClose && (
            <button className="mtdrawer__x" onClick={onClose} aria-label="Kapat" type="button">
              <Icon name="cross-circle" size={18} />
            </button>
          )}
        </div>
        <div className="mtdrawer__body">{children}</div>
        {footer && <div className="mtdrawer__foot">{footer}</div>}
      </div>
    </div>
  );
}
