# Mobile Safe Area & Viewport

Every full-screen component must use `100dvh` + safe-area insets or content will be obscured by the Android browser nav bar.

**Background:** Firefox and Chrome on Android overlay a browser nav bar on top of web content. `100vh` doesn't account for it — the Rate bar was hidden during Android testing before launch.

---

## Required: `src/index.html` viewport meta

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

## Required: Every full-screen `:host` container

```scss
height: 100vh;   /* fallback for older browsers */
height: 100dvh;  /* primary — adjusts for Android nav bar */
padding-bottom: env(safe-area-inset-bottom, 0px);
box-sizing: border-box;
```

## Required: Sticky bottom elements (Rate bar, drawers, submit buttons)

```scss
padding-bottom: calc(BASE_PADDING + env(safe-area-inset-bottom, 0px));
```

---

## Scope

Applies to all full-screen route components, bottom sheets, modals with sticky footers, and form pages with sticky submit buttons.
