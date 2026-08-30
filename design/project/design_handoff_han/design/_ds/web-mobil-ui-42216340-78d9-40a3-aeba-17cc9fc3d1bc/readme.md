# Uyanık Design System

A navy-and-orange brand design system built on the structural foundations of **Metronic v9.4.13** (KeenThemes), re-themed for **Uyanık** — a customer loyalty + commerce brand. It keeps Metronic's clean enterprise scaffolding (white cards, soft shadows, dense Inter type, KeenIcons) and re-skins it to the Uyanık palette: **navy `#1F3864`** as the structural/primary color and **orange `#E08A2B`** as the accent reserved for calls-to-action.

## Source
- **Figma:** `Metronic_v9.4.13.fig` (KeenThemes). Pages explored: Layouts, Components, Store (Retail & Inventory), Dashboards, Public Profiles, My Account, Network, Authentication, Overlays, Docs, Visuals. Colors and the semantic ramp were lifted from the file's Figma **Variables** (Light + Dark modes); button/field metrics and the logo geometry from the component frames.
- No codebase was supplied — everything here is reconstructed from the Figma design data, not from Metronic's shipped HTML/CSS.

> ⚠️ **Font substitution.** The UI font **Inter** and code font **JetBrains Mono** are loaded from Google Fonts (exact matches). The brand wordmark in the source uses **Museo Sans 900**, which is not freely licensable — it is substituted with a heavy Inter and the `METRONIC` wordmark is set in `--font-wordmark`. If you have the real Museo Sans files, drop them in and add a `@font-face`. (See *Open questions* at the bottom.)

---

## Content fundamentals
How Metronic writes — mirror this for on-brand copy.

- **Voice:** plain, professional, product-focused. It names features and numbers, not feelings. Reads like a capable B2B SaaS.
- **Person:** addresses the user as **you** ("Join us to share your insights"); UI labels are nouns/short verbs ("Connect", "Get started", "Add team", "View all teams").
- **Casing:** **Title Case for buttons & nav** ("Public Profile", "My Account", "Get Started"); **Sentence case for body copy and helper text**. Section eyebrows in the sidebar are **ALL-CAPS** with wide tracking (USER, PAGES, APPS).
- **Headings:** short and literal — "Dashboard", "Earnings", "Highlights", "Teams", "About", "Sales Overview". Often paired with a muted one-line subtitle ("Central hub for personal customization").
- **Numbers as hero:** compact metrics are a core motif — `9.3k`, `$295.7k`, `+2.7%`, `$34,233`. Growth deltas are colored (green up / red down) and frequently shown as a soft badge.
- **Microcopy:** encouraging but brief ("New here? Create an account", "Don't receive an email? Resend").
- **No emoji.** None in the product UI. Iconography carries all visual shorthand.
- **Tone example:** *"Unlock creative partnerships on our blog — explore exciting collaboration opportunities, guest posts and more. Join us to share your insights and grow your audience."*

---

## Visual foundations
- **Color.** **Brand split — navy is structural, orange is the CTA.** Primary navy `#1379F0`→`#1F3864` (active `#162A4C`, soft `#EAEEF4`, accent `#14233F`) drives nav-active, links, headers, footers and section chrome. Accent orange `#E08A2B` (active `#C6751C`, soft `#FBF1E4`) is reserved for primary actions — `<Button color="accent">`, cart badges, points/loyalty. Full semantic set keeps its rungs (success `#0BC33F`, danger `#ED143B`, warning `#FEC524`, info `#4921EA`). Neutrals are a true-grey ramp (`grey-50 #F9F9F9` → `grey-950 #151516`) **plus** a separate bluish **"coal"** text ramp — heading `#1B1C22`, body `#4B5675`, muted `#78829D`, placeholder `#99A1B7`. A complete **dark theme** is defined under `[data-theme="dark"]` (navy lightens to `#3F5D92`, orange to `#EB9C45` for contrast).
- **Type.** Inter everywhere; **Medium (500) is the default UI weight**, Semibold (600) for headings/labels, Bold (700) for hero numbers. Dense scale — body is **13px**, labels 14px, captions 11–12px; headings step 16 → 20 → 26 → 38 → 50. Medium-and-up weights carry **−0.01em** tracking. JetBrains Mono for code/numerics.
- **Spacing.** 0.25rem base (4-px grid): 4·8·12·16·20·24·32·40·48·64. Cards pad 20px; headers 16–20px.
- **Radii.** Buttons / inputs / badges **6px**; cards **12px**; feature panels 16–20px; pills/avatars full.
- **Shadows.** Deliberately **soft and low-opacity** — the signature card shadow is `0 3px 4px rgba(0,0,0,.03)`. Raised buttons `0 3px 8px /.07`, dropdowns `0 7px 18px /.09`, modals `0 10px 35px /.10`. Depth comes from **1px borders** (`#F1F1F4` subtle, `#DBDFE9` strong) far more than from shadow.
- **Surfaces & layout.** App canvas is near-white `#FCFCFC`; content sits in white cards. Fixed 248px sidebar + sticky 64px topbar; 28px content padding. Generous card grids (2–4 columns).
- **Backgrounds.** Mostly flat white/grey. Marketing/auth panels use **subtle dotted/grid patterns** (`assets/patterns/`) and gentle radial tints — never loud full-bleed gradients. Decorative blue glow blobs appear behind hero art at low opacity.
- **Borders define cards**, not heavy shadow: 1px `--border-default` + 12px radius + `--shadow-sm`.
- **Imagery.** Clean studio product shots and line-art spot **illustrations** (cool, friendly, light palette). Avatars are round; when no photo, **auto-colored initials** (see `Avatar`).
- **Motion.** Quick and functional: 150–200ms ease `cubic-bezier(.4,0,.2,1)`. Hover = background/҂color shift (e.g. light buttons *fill in* on hover; ghost items pick up a grey-100 wash). Focus = 3px primary ring. No bounce, no decorative looping animation. Charts ease-in their lines.
- **Press/hover states.** Solid buttons darken to their `-active` rung; light buttons swap to the solid fill; nav items get `primary-soft` bg + primary text when active.

---

## Iconography
- **KeenIcons** — Metronic's in-house set. This system ships the **outline ("Filled" stroke) variant**: 49 curated SVGs in `assets/icons/`, all authored with `fill="currentColor"` so they take the CSS `color` of any ancestor.
- **Delivery.** Because external SVGs can't inherit `currentColor` reliably via `<img>`/`mask`, icons are **inlined**. Two front-ends to the same data:
  - `assets/icons.js` — drop-in `<script>` for plain HTML. Exposes `window.mtIconSVG(name)` and auto-hydrates any `<i data-icon="home"></i>`.
  - `<Icon name="…" />` — the React component (`components/Icon/`), with the full map embedded so it's self-contained.
- **Coverage:** navigation (element-11, profile-circle, setting-2, rocket, category…), actions (plus-squared, trash, filter, magnifier, share…), content (folder, files, notepad, calendar, chart-line-up…), social/marks (verify, star, heart, like) and chevrons (down/up/left/right, derived from the real KeenIcons chevron path).
- A couple of duotone glyphs (folder, notepad) render as solid silhouettes — that matches Metronic's filled style. **No emoji, no unicode glyphs** are used as icons. When you need an icon not in the set, pull the matching KeenIcon SVG from the Figma `Visuals/Icons` page rather than hand-drawing one.
- **Logo.** The Uyanık mark is an **owl** — navy `#142A3D` head/body, light-blue `#8BB4DE` wings + book, an orange `#FDA331` beak and a yellow `#FFCB43` idea-spark. Two forms: **`logo-mark.svg`** is the clean **frameless owl** (use inline next to the wordmark — sidebar, header, login); **`logo-badge.svg`** / `logo-mark-dark.svg` is the **rounded-square badge** (app-icon / dark backgrounds). Three thematic owls also ship: **book** (primary), **laptop** (`logo-owl-laptop.svg`), **coffee** (`logo-owl-coffee.svg`). All extracted as vector from the brand PDF. Pair the mark with the `Uyanık` wordmark in `--font-wordmark` (navy, Inter heavy).

---

## Index / manifest
**Root**
- `styles.css` — the single entry point consumers link (import list only).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`, `base.css`.
- `readme.md` — this guide. `SKILL.md` — Agent-Skill front-matter wrapper.

**Assets** (`assets/`)
- `logo-placeholder.svg` — **brand-neutral placeholder mark** that all templates use; consuming projects swap in their own logo + wordmark. The `logo-mark.svg` / owl marks below are an **example brand** (Uyanık), not a required part of the system.
- `logo-mark.svg` (frameless owl), `logo-badge.svg` / `logo-mark-dark.svg` (badge), `logo-owl-laptop.svg`, `logo-owl-coffee.svg`, `logo-owl-book.svg` · `icons/` (49 KeenIcons) · `icons.js` (inline icon runtime) · `patterns/` (dotted + grid brand patterns) · `brand/` (brand-guide reference images).

**Foundation cards** (`guidelines/`) — specimen cards rendered in the Design System tab: colors (primary, semantic, neutral, text/surfaces), type (scale, weights, mono), spacing (radii, shadows, scale), brand (logo, iconography).

**Components** (`components/`) — React primitives, bundled to `window.WebMobilUI_422163`. Button & Badge carry an extra **`accent`** color (Uyanık orange) for CTAs:
- `Icon/` — `Icon`
- `layout/` — `AppShell` (navy sidebar + sticky topbar; collapses to a rail, off-canvas on mobile)
- `buttons/` — `Button`, `IconButton`, `Toggle`, `ToggleGroup`
- `forms/` — `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Slider`, `FormField`
- `data-display/` — `Card` (+`CardHeader/Body/Footer`), `Badge`, `StatusBadge`, `Avatar` (+`AvatarGroup`), `Tabs`, `Accordion`, `Breadcrumb`, `Stepper`, `Pagination`, `Progress`, `Tag`, `Separator`, `DataGrid`
- `overlays/` — `Modal`, `Drawer`, `Tooltip`, `Popover`, `DropdownMenu`, `ToastProvider` (+`useToast`)
- `feedback/` — `Alert`, `Skeleton`, `Spinner`, `EmptyState`

> **Application components.** `StatusBadge` (general-purpose status dictionary — aktif/taslak/onaylandı/tamamlandı/…, or pass your own `label`/`tone`), `DataGrid` (sort + pagination + the four required states: loading/empty/error/full), `Modal`, `Drawer`, `ToastProvider`/`useToast` ship in the bundle alongside the primitives — read them from `window.WebMobilUI_422163` like any other component.

**Templates** (`templates/`) — ready-to-copy starting scaffolds (DC `.dc.html`), shown in the picker's **Templates** group. They are **domain-neutral patterns**, not finished product screens — the example content (records, tasks, KPIs, sign-in) is placeholder, meant to be swapped for whatever application you're building (CRM, content tool, internal panel, POS, anything). They load the DS via `ds-base.js` and mount components with `<x-import component-from-global-scope="WebMobilUI_422163.…">`:
- `kayit-yonetimi/` — **Kayıt Yönetimi**: the generic **list pattern** — a DataGrid with the four states, search + type filter, a create **Drawer** form with inline validation, and a delete-confirm **Modal**. Swap the “kayıt” entity for users, projects, tickets, …
- `dashboard/` — **Dashboard**: the generic **overview pattern** — `AppShell` layout + stat cards, an activity bar chart, range toggle and a highlights list.
- `giris/` — **Giriş / Auth**: two-panel sign-in (brand panel + validated form), responsive to a single column on mobile. One orange CTA.
- `cok-adimli-form/` — **Çok Adımlı Form**: the generic **wizard pattern** — a `Stepper`-driven flow with per-step validation and a review step.

### Prop conventions
Keep new components consistent with these:
- **`color`** = the element's own fill/semantic color, where color *is* the component (`Button`, `IconButton`, `Badge`, `Alert`, `Progress`, `Spinner`). Values: `primary | accent | secondary | success | danger | warning | info | dark`.
- **`tone`** = the semantic color of a *container/medallion* around neutral content (`Modal` icon, `StatusBadge`, `EmptyState`). Same value vocabulary, narrower set per component.
- **`variant`** = visual treatment, never color (`solid | light | outline | ghost | link` for buttons; `plain | card` for Accordion; etc.). **`size`** = `sm | md | lg`.
- Controlled/uncontrolled: accept `value`+`onChange` (or `pressed`/`open`+`on…Change`) **and** a `defaultValue` for uncontrolled use.

### Themes (çok temalı yapı)
İki eksenli model: **`data-theme` (marka) × `.dark` (şema)** — ikisi bağımsız.
- `tokens/themes.css` adlandırılmış marka temalarını tutar. Her tema **yalnızca marka katmanını** ezer (primary + accent rampaları, ring, link); yapısal token'lar (grey/surface/text/border) ve light↔dark tüm temalarca paylaşılır.
- Hazır temalar: **`uyanik`** (lacivert + turuncu, kanonik), **`mansis`** (navy + blue + cyan, premium SaaS — Mansis OS Default) , **`han`** (lacivert #14304F + altın #C9A227 — Tahtakale han keşif ürünü; alıcı arayüzünde dark kullanılmaz) ve **`okyanus`** (teal + mercan, örnek). Sıfır-konfig `:root` zaten Uyanık'tır.
- Kullanım: `<html data-theme="uyanik">` · koyu için `class="dark"` ekleyin · marka değiştirmek için `data-theme`'i değiştirin.
- Yeni tema: `themes.css` altındaki şablonu kopyalayıp `<ad>` + renkleri değiştirin. **Önemli:** accent zinciri (`--color-accent*`) her temada doğrudan set edilir — `--color-orange`'a alias bırakılmaz (alias `:root`'ta donar).

### Identity
The palette, type and components are the system's aesthetic; the **brand is not baked in**. Templates ship a neutral `assets/logo-placeholder.svg` + a “Marka” wordmark in a swappable slot — a consuming project drops in its own logo and name. `AppShell` takes the brand as a `brand`/`brandMark` prop for exactly this reason. The compiled runtime namespace is **`window.WebMobilUI_422163`** (the technical accessor consumers import) and the internal CSS class prefix is **`mt`** (a Metronic-lineage convention). These are intentional and stable; don't rename them per-component.

---

## Brand notes (Uyanık)
- **Navy `#1F3864` = structure** (nav, headers, footers, links, the tier card). **Orange `#E08A2B` = action.**
- **Button hierarchy (strict).** Orange `accent` solid is reserved for the **single primary conversion CTA per screen** (e.g. *Sepete ekle*, *Siparişi tamamla*, hero shop, *Giriş yap*, *Bağlan*) — **at most one filled orange button on screen**. Routine form saves (*Kaydet*, *Güncelle*) use **navy solid** (`color="primary"`), never orange. Secondary actions use **navy/dark outline** or **neutral light**; tertiary actions use **ghost** (text only). Cancel/dismiss = ghost.
- The default token theme is light; add `data-theme="dark"` (or class `dark`) on `<html>` to switch. The dark specimen card demonstrates it.
- Keep Title Case for actions, sentence case for body.

---

## Open questions for the user
1. **Museo Sans** — confirmed unavailable; the `Uyanık` wordmark stays in heavy **Inter**. Swap later if a brand font is licensed.
2. Send real product photography to replace any placeholder imagery for production.
