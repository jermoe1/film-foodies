# Browser & Platform Support

## Supported Browsers

Firefox, Chrome, Safari — on Android, iOS, Windows, and macOS.

## Form Factors

**Primary target:** Phone (portrait).  
Tablet, laptop, and desktop are supported enhanced breakpoints.

## Breakpoints

| Name | Min-width |
|------|-----------|
| `sm` | 0px (default phone) |
| `md` | 768px (tablet) |
| `lg` | 1024px (laptop) |
| `xl` | 1280px (desktop) |

## Desktop Max-Width

On screens ≥ 768px, wrap the app in:
```scss
max-width: 480px;
margin: 0 auto;
```
Prevents the phone-oriented layout from stretching awkwardly on wide screens.

## Focus / Accessibility

All interactive elements must have `:focus-visible` outlines:
```scss
outline: 2px solid #d4a03a; /* ff-gold */
outline-offset: 2px;
```

## CSS Compatibility Note

Check [caniuse.com](https://caniuse.com) before using newer CSS properties — Safari on iOS is typically the laggard.
