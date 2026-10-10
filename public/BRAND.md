# PSG Visual System — V1

德系风格：precise, geometric, functional. One color does the talking; everything else is black, white, and a chosen steel gray. No serif, no script, no gold, no texture.

## Palette

| Token | Hex | Use |
|---|---|---|
| Ink | `#000000` | primary text, rules, monogram |
| Red | `#E30613` | the one accent — role labels, seal ring, structural bar. Never decorative-only. |
| Steel | `#6B6D72` | secondary text, hairlines, captions. Chosen cool-gray, not a default mid-grey. |
| Paper | `#FFFFFF` | ground |

## Type

Single family throughout: Arial/Helvetica (matches the supplied logo). Hierarchy comes from weight, size, and letter-spacing — not from mixing in a display serif. Tabular data (dates, IDs) uses a monospace fallback (`Consolas, "SFMono-Regular", monospace`) for tabular-nums alignment.

## Assets

- [`logo/psg-logo.svg`](logo/psg-logo.svg) — primary lockup (mark + wordmark); [`psg-logo-white.svg`](logo/psg-logo-white.svg) for dark grounds
- [`logo/psg-mark.svg`](logo/psg-mark.svg) / [`psg-mark-white.svg`](logo/psg-mark-white.svg) — mark alone (P + red period)
- `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png` — mark in white on an ink tile
- [`logo/psg-institute-logo.svg`](logo/psg-institute-logo.svg) — Research Institute sub-brand mark (stacked), used on Institute certificates only
- [`seal/psg-official-seal.svg`](seal/psg-official-seal.svg) — official seal, gauge-bezel ring, bilingual ring text (`ZERTIFIZIERT · CERTIFIED`)
- [`templates/certificate.svg`](templates/certificate.svg) — V1 certificate master template

## Mark (V2)

A geometric P on a 10-unit grid plus a 2x2 red square set at its foot, read as a period. The red square is the only red in the mark. Clear space: at least one red-square edge on every side. Minimum size: mark 16px, lockup 120px wide; at 24px or below keep the counter solid-readable (do not add detail). On dark grounds the letter turns white, the red stays `#E30613`. In single-colour use (seals, embossing) the square takes the letter colour.

## Why this direction

The seal already committed to an industrial-instrument language (gauge ticks, hairline rings, one red accent). The certificate template carries that forward instead of switching to the generic "cream + gold border + script" certificate look — same palette, same single sans family, same red-as-the-only-color-decision rule, same tick-mark motif reused as corner registration marks.
