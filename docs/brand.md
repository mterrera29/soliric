# Soliric brand

**Idea.** *Sol* is "sun" in Spanish and also the first syllable of Solana; what Soliric registers is a lyric. The mark is a **seal** holding three lines of a lyric: the first two are the lyric itself (warm, human), the third dissolves into four green pixels, the fingerprint that lands on-chain.

The same rule runs through the whole product: **ember = the lyric and the human side; Solana green and violet appear only where something goes on-chain.**

## Files (`web/public/brand/`)

| Layout | Color, dark background | Color, light background | One ink, dark | One ink, light |
|---|---|---|---|---|
| Seal only | `soliric-mark.svg` | `soliric-mark-light.svg` | `soliric-mark-cream.svg` | `soliric-mark-ink.svg` |
| Horizontal | `soliric-horizontal.svg` | `soliric-horizontal-light.svg` | `soliric-horizontal-cream.svg` | `soliric-horizontal-ink.svg` |
| Vertical | `soliric-vertical.svg` | `soliric-vertical-light.svg` | `soliric-vertical-cream.svg` | `soliric-vertical-ink.svg` |

The name is converted to outlines, so the files render anywhere without installing the font. In the app, use `<Logo />` (`web/src/components/Logo.tsx`).

## Color

| Role | Dark background | Light background |
|---|---|---|
| Ring and lyric lines | Ember `#F58A45` | Deep ember `#C2501A` |
| Fingerprint pixels | Solana green `#14F195` | Deep green `#0E9F6E` |
| Name | Cream `#F7EFE5` | Ink `#1B120C` |
| Ground | `#15100D` | `#F7F3EE` |

Violet `#9945FF` is not part of the mark: it only appears in the gradient border that marks "this goes on-chain".

## Type

- **Young Serif**: the name and headlines (one weight only: never ask for bold).
- **Figtree**: text and interface.
- **JetBrains Mono**: fingerprints, hashes and code.

## Use

- **Clearspace:** at least ¼ of the seal's height on every side.
- **Minimum size:** seal 16 px; horizontal lockup 96 px wide; vertical lockup 64 px wide. Below 24 px use the seal alone.
- **One ink** (`ink`/`cream`) for single-color print, stamps, PDFs and photos.
- **Don't:** recolor the pixels in the colored versions, stretch or rotate the mark, put the colored version on a busy photo, or set the name in another typeface.
- **"Powered by Soliric"** for partner apps: the horizontal lockup next to the words "Powered by", at the same height as the text beside it, in the version that matches the background.
