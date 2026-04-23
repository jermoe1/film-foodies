# Style Guide

> **Persona Discussion**
>
> **UX:** The design language is "upscale cinema" — dark backgrounds, gold accents, generous spacing. It should feel like a nice theater, not a social media app. The Cinema (dark) theme is the canonical design; all other themes are derived variants. When building components, design for Cinema first.
>
> **Dev:** The token system is solid. Every color, spacing decision, and border style flows through CSS custom properties prefixed `--ff-`. Never hardcode hex values in component SCSS — always reference a token. This is what makes 6 themes work with zero component changes.
>
> **UX:** Typography is minimal — a single sans-serif stack. No decorative fonts. Hierarchy is communicated through font size and weight, not typeface. Letter spacing is used sparingly for all-caps labels.
>
> **User:** I appreciate that scores are color-coded consistently everywhere — green is a good movie, gold is okay, red is bad. That visual shorthand appears in history cards, stats, profile, and the rating input. It should be a shared utility, not repeated in each component.
>
> **UX:** Focus states need to be explicit and visible. The `focus-visible` gold outline convention is correct — it shows for keyboard navigation but not mouse clicks. Don't remove it in the rebuild; it's an accessibility requirement.
>
> **Dev:** The 480px max-width cap on desktop is intentional — this is a mobile-first app used on phones while watching TV. On desktop, content is centered with a max-width and doesn't stretch to full widescreen. Document this so a rebuild dev doesn't "fix" it.

---

## Design Principles

1. **Cinema-first** — Dark, rich, slightly premium. Not minimal/flat, not playful/colorful.
2. **Mobile-first** — Primary use case is phones. Desktop is secondary. 480px max content width.
3. **Token-driven** — All colors via `--ff-*` CSS custom properties. No hardcoded hex values in component SCSS.
4. **Consistent color semantics** — Score colors (green/gold/red) used identically everywhere.
5. **Accessible focus** — `focus-visible` outlines on all interactive elements, gold color.

---

## Themes

Six themes are supported. The `ThemeService` applies a class to `document.body`. CSS custom properties are re-declared per theme class, so all components update automatically.

### Body class names
| Theme Name | Body Class |
|-----------|-----------|
| Cinema (default) | *(no class, or `theme-cinema`)* |
| Lobby | `theme-lobby` |
| High Contrast | `theme-high-contrast` |
| Anti-Glare | `theme-anti-glare` |
| Colorblind | `theme-colorblind` |
| Forest | `theme-forest` |

---

### Cinema (default — dark)
The reference theme. All others are derived from this.

```scss
// Backgrounds
--ff-bg:          #0d0d0d;   // page background
--ff-bg-card:     #141414;   // card surface
--ff-bg-card-alt: #161616;   // alternate card (striped lists)
--ff-bg-hover:    #1a1a1a;   // hover state on interactive surfaces
--ff-bg-surface:  #1e1e1e;   // elevated surface (modals, drawers)

// Borders
--ff-border-sub:  #1e1e1e;   // very subtle border
--ff-border:      #2a2a2a;   // standard border
--ff-border-mid:  #333;      // medium-emphasis border

// Brand
--ff-gold:        #d4a03a;   // primary accent (buttons, highlights, focus rings)
--ff-gold-dim:    #8a6030;   // dimmed gold (disabled states, secondary accents)

// Semantic
--ff-green:       #4a9a5a;   // success / high score
--ff-red:         #c04040;   // error / low score (used in panels too)
--ff-blue:        #4070d0;   // informational / history panel

// Text (darkest → lightest readable hierarchy)
--ff-text:        #e8e8e8;   // primary text
--ff-text-2:      #ccc;      // secondary text
--ff-text-3:      #aaa;      // tertiary text
--ff-text-4:      #888;      // dim text (timestamps, labels)
--ff-text-5:      #666;      // dimmer
--ff-text-6:      #555;      // dimmest readable
--ff-text-7:      #444;      // near-invisible (dividers that double as text)
```

---

### Lobby (light)
Light beige/cream backgrounds, retains gold accent.

```scss
--ff-bg:          #f5f0e8;
--ff-bg-card:     #fff;
--ff-bg-card-alt: #faf7f2;
--ff-bg-hover:    #ede8de;
--ff-bg-surface:  #f0ebe0;

--ff-border-sub:  #e0dbd0;
--ff-border:      #d0c8b8;
--ff-border-mid:  #bfb8a8;

--ff-gold:        #b8820a;   // slightly deeper for light bg contrast
--ff-gold-dim:    #c8a04a;

--ff-green:       #2d7a3c;
--ff-red:         #b03030;
--ff-blue:        #2d5ab0;

--ff-text:        #1a1a1a;
--ff-text-2:      #333;
--ff-text-3:      #555;
--ff-text-4:      #777;
--ff-text-5:      #999;
--ff-text-6:      #bbb;
--ff-text-7:      #ddd;
```

---

### High Contrast
Pure black backgrounds, bright accessible accent. For users needing maximum contrast.

```scss
--ff-bg:          #000;
--ff-bg-card:     #0a0a0a;
--ff-bg-card-alt: #0f0f0f;
--ff-bg-hover:    #111;
--ff-bg-surface:  #111;

--ff-border-sub:  #222;
--ff-border:      #333;
--ff-border-mid:  #444;

--ff-gold:        #ffd700;   // bright yellow-gold
--ff-gold-dim:    #aa9000;

--ff-green:       #00cc55;
--ff-red:         #ff3333;
--ff-blue:        #4499ff;

--ff-text:        #ffffff;
--ff-text-2:      #f0f0f0;
--ff-text-3:      #ddd;
--ff-text-4:      #bbb;
--ff-text-5:      #999;
--ff-text-6:      #777;
--ff-text-7:      #555;
```

---

### Anti-Glare
Soft warm dark gray — easier on eyes in dark rooms.

```scss
--ff-bg:          #1a1814;
--ff-bg-card:     #201e18;
--ff-bg-card-alt: #242018;
--ff-bg-hover:    #28241c;
--ff-bg-surface:  #2c2820;

--ff-border-sub:  #2c2820;
--ff-border:      #38342a;
--ff-border-mid:  #444038;

--ff-gold:        #c89030;   // warm amber
--ff-gold-dim:    #806020;

--ff-green:       #4a8a50;
--ff-red:         #b03838;
--ff-blue:        #3860b8;

--ff-text:        #d8d4c0;
--ff-text-2:      #bfbaa8;
--ff-text-3:      #a09890;
--ff-text-4:      #808070;
--ff-text-5:      #606055;
--ff-text-6:      #505048;
--ff-text-7:      #404038;
```

---

### Colorblind
Deuteranopia-friendly — replaces red/green semantic pair with blue/orange.

```scss
--ff-bg:          #0d0d12;
--ff-bg-card:     #14141a;
--ff-bg-card-alt: #16161e;
--ff-bg-hover:    #1a1a22;
--ff-bg-surface:  #1e1e28;

--ff-border-sub:  #1e1e28;
--ff-border:      #2a2a38;
--ff-border-mid:  #333344;

--ff-gold:        #5588ff;   // replaced with blue accent
--ff-gold-dim:    #334499;

--ff-green:       #5588ff;   // same as gold — no red/green reliance
--ff-red:         #ff8833;   // orange instead of red
--ff-blue:        #5588ff;

--ff-text:        #e8e8f0;
--ff-text-2:      #ccccd8;
--ff-text-3:      #aaaabc;
--ff-text-4:      #8888a0;
--ff-text-5:      #666680;
--ff-text-6:      #555566;
--ff-text-7:      #444455;
```

---

### Forest
Dark green — nature-inspired alternative to the charcoal Cinema theme.

```scss
--ff-bg:          #0a0f0a;
--ff-bg-card:     #101810;
--ff-bg-card-alt: #121c12;
--ff-bg-hover:    #162016;
--ff-bg-surface:  #1a241a;

--ff-border-sub:  #1a241a;
--ff-border:      #243824;
--ff-border-mid:  #2e422e;

--ff-gold:        #5ab85a;   // green accent replaces gold
--ff-gold-dim:    #347034;

--ff-green:       #5ab85a;
--ff-red:         #c04040;
--ff-blue:        #4070d0;

--ff-text:        #d0e8d0;
--ff-text-2:      #b0c8b0;
--ff-text-3:      #90a890;
--ff-text-4:      #708870;
--ff-text-5:      #506850;
--ff-text-6:      #405840;
--ff-text-7:      #304830;
```

---

## Typography

### Font Stack
```scss
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```
System font stack. No external font loading — improves performance and works offline.

### Type Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Page title | 1.25rem (20px) | 600 | Section headings |
| Card title | 1rem (16px) | 600 | Movie titles, card headers |
| Body | 0.9375rem (15px) | 400 | Default content text |
| Secondary | 0.875rem (14px) | 400 | Metadata, dates, labels |
| Small | 0.8125rem (13px) | 400 | Timestamps, fine print |
| Micro | 0.75rem (12px) | 400 | Badges, chips |
| Label | 0.75rem (12px) | 600 | All-caps section labels (+ `letter-spacing: 0.08em`) |

### Headings
No semantic heading fonts. Hierarchy via weight + size only.

```scss
// Section labels (all-caps, spaced)
.section-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ff-text-4);
}
```

---

## Color Semantics

### Score Colors
Consistent across all components (rating input, history, stats, profile, suggestions):

| Condition | Color | Hex (Cinema) |
|-----------|-------|-------------|
| Score ≥ 7.5 | Green | `#4a9a5a` (`--ff-green`) |
| Score ≥ 5.0 | Gold | `#d4a03a` (`--ff-gold`) |
| Score < 5.0 | Red | `#c04040` (`--ff-red`) |
| No score / null | Muted | `--ff-text-5` |

Utility function (TypeScript):
```typescript
export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--ff-text-5)';
  if (score >= 7.5) return 'var(--ff-green)';
  if (score >= 5.0) return 'var(--ff-gold)';
  return 'var(--ff-red)';
}
```

### Content Warning Severity Colors
| Severity | Color |
|----------|-------|
| Severe | `#c04040` (red) |
| Moderate | `#d4a03a` (gold) |
| Mild | `#888` (muted) |

### Home Panel Colors
The three home panels use distinct accent colors (not themed — fixed):
| Panel | Color | Hex |
|-------|-------|-----|
| Suggest a Movie | Gold | `#d4a03a` |
| Log a Movie Night | Crimson | `#c04040` |
| View History | Midnight Blue | `#4070d0` |

### IMDB Delta Colors (Stats)
| Delta | Color |
|-------|-------|
| Positive (surprise) | `--ff-green` |
| Negative (overhyped) | `--ff-red` |

---

## Spacing Scale

Base unit: 4px. All spacing should be multiples of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| 4px | 0.25rem | Micro gaps (icon + label, badge padding) |
| 8px | 0.5rem | Tight element spacing |
| 12px | 0.75rem | Inner card padding, form field gaps |
| 16px | 1rem | Standard padding, list item gaps |
| 20px | 1.25rem | Section spacing within cards |
| 24px | 1.5rem | Card-to-card spacing |
| 32px | 2rem | Section-to-section spacing |
| 48px | 3rem | Large vertical rhythm (page sections) |

---

## Borders & Radius

```scss
// Border widths
border: 1px solid var(--ff-border);        // standard
border: 1px solid var(--ff-border-sub);    // subtle (card inner sections)
border: 1px solid var(--ff-border-mid);    // emphasized (active states)

// Border radius
--ff-radius-sm: 4px;     // chips, badges, small inputs
--ff-radius:    8px;     // cards, buttons, panels
--ff-radius-lg: 12px;    // bottom sheets, modals
--ff-radius-xl: 16px;    // full-bleed panels (home)
--ff-radius-pill: 999px; // pill-shaped buttons, vote buttons
```

---

## Interactive States

### Buttons

**Primary (gold fill):**
```scss
background: var(--ff-gold);
color: #000;
border-radius: var(--ff-radius);
padding: 0.75rem 1.5rem;
font-weight: 600;

&:hover { filter: brightness(1.1); }
&:active { filter: brightness(0.9); }
&:disabled { opacity: 0.4; cursor: not-allowed; }
```

**Secondary (border):**
```scss
background: transparent;
border: 1px solid var(--ff-border-mid);
color: var(--ff-text-2);

&:hover { background: var(--ff-bg-hover); }
```

**Destructive (red):**
```scss
background: var(--ff-red);
color: #fff;
```

### Focus Rings
All interactive elements must show a visible gold outline on keyboard focus:
```scss
&:focus-visible {
  outline: 2px solid var(--ff-gold);
  outline-offset: 2px;
}
```
Use `:focus-visible` (not `:focus`) so the ring only appears for keyboard navigation.

### Hover States
Cards and list items use `--ff-bg-hover` as background on hover:
```scss
&:hover {
  background: var(--ff-bg-hover);
}
```

---

## Layout

### Max Width
All content is capped at **480px** and centered on larger screens. This is intentional — the app is designed for mobile and should not stretch to fill a wide desktop viewport.

```scss
// In styles.scss or a layout wrapper:
.page-container {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
}
```

### Viewport (Mobile)
Every full-screen component:
```scss
height: 100dvh;
padding-bottom: env(safe-area-inset-bottom);
```

`index.html` must include:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### Breakpoints
The app is designed for a single breakpoint — mobile. No complex responsive grid. Media queries are used sparingly to adjust padding/font-size on larger screens.

| Breakpoint | Width | Notes |
|-----------|-------|-------|
| Mobile (primary) | < 480px | Full-width layout |
| Tablet/Desktop | ≥ 480px | Centered at 480px, side margins appear |

---

## Iconography

No icon library is used. Icons are SVG inline or Unicode characters. Prefer SVG for clarity.

Common icons used:
| Use | Approach |
|-----|---------|
| Close / X | `✕` Unicode or SVG |
| Hamburger menu | Three-line SVG |
| Back arrow | `←` or SVG |
| Up/down vote | `▲` / `▼` or SVG thumbs |
| Star / score | SVG circle fill |
| Warning | `⚠` Unicode or SVG |
| Check | `✓` Unicode |

---

## Poster Images

Movie posters from OMDB are displayed in multiple sizes. Always use `loading="lazy"`. Always show a styled placeholder if `poster_url` is null.

```html
<!-- With poster -->
<img [src]="posterUrl" [alt]="title" loading="lazy" class="poster poster--md" />

<!-- Fallback -->
<div class="poster poster--md poster--fallback">
  <span>{{ title[0] }}</span>
</div>
```

Sizes:
| Class | Width | Usage |
|-------|-------|-------|
| `poster--sm` | 40px | History collapsed card |
| `poster--md` | 80px | Suggestion cards, profile grid |
| `poster--lg` | 120px | Expanded history card, movie night form |

---

## Animation & Motion

Keep subtle. This is a low-motion app — no page transitions, no complex animations.

| Interaction | Animation |
|------------|-----------|
| Accordion expand/collapse | `max-height` transition, 200ms ease |
| Bottom sheet open | Slide up, 250ms ease-out |
| Toast / undo banner | Fade in, 150ms; auto-dismiss with progress bar |
| Vote button tap | Scale to 0.92 on active, 100ms |
| Loading states | Simple spinner (CSS rotate animation) |

Respect `prefers-reduced-motion`:
```scss
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

---

## SCSS Architecture

### Global (`styles.scss`)
- CSS custom properties (all `--ff-*` tokens)
- Theme overrides (`.theme-lobby { --ff-bg: ...; }`)
- Reset / base (`*, body` defaults)
- Shared typography base
- Layout wrapper

### Component SCSS
- Component-scoped styles only (Angular view encapsulation)
- Use `var(--ff-*)` for all colors
- BEM-inspired naming: `.component__element--modifier`
- No global classes referenced inside component SCSS

### Example component SCSS pattern:
```scss
// history.component.scss
.history {
  padding: 1rem;

  &__card {
    background: var(--ff-bg-card);
    border: 1px solid var(--ff-border);
    border-radius: var(--ff-radius);
    margin-bottom: 1rem;

    &--expanded {
      border-color: var(--ff-border-mid);
    }
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ff-text);
  }

  &__date {
    font-size: 0.875rem;
    color: var(--ff-text-4);
  }
}
```
