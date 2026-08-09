---
name: Bushido Enterprise
colors:
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#410003'
  on-tertiary-container: '#ea4b44'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb4ac'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#92030f'
  background: '#fbf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 57px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.1px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  section-gap: 48px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

This design system establishes a high-performance, premium atmosphere tailored for elite martial arts academies. It blends the disciplined heritage of martial arts with modern enterprise SaaS sophistication. The aesthetic leverages **Corporate Modernism** with **Minimalist** efficiency, utilizing high-contrast accents to guide the user's focus.

The target audience includes academy owners, instructors, and high-level administrators who require a tool that feels as precise and intentional as the disciplines they teach. The UI should evoke a sense of authority, reliability, and "quiet luxury." 

Key stylistic pillars include:
- **High Contrast:** Sharp transitions between deep blacks and brilliant accents.
- **Precision:** Perfect alignment and generous whitespace to reduce cognitive load in complex management tasks.
- **Intentionality:** Every element exists for a functional purpose, mirroring the "no wasted movement" philosophy of martial arts.

## Colors

The color palette is rooted in a traditional martial arts hierarchy, repurposed for professional software.

- **Primary (Ink Black):** Used for primary navigation, headings, and high-impact actions. It represents the "Black Belt" standard of excellence.
- **Secondary (Dojo Gold):** Reserved for "Premium" status indicators, achievements, and highlight states. It should be used sparingly to maintain its prestige.
- **Tertiary (Crimson Red):** The primary call-to-action color and critical alert indicator. It provides a sharp, energetic contrast against the neutral background.
- **Neutral (Slate & Smoke):** Grays are used for secondary text, borders, and inactive states to ensure the interface remains uncluttered.
- **Backgrounds:** Off-white is the default for a clean "paper" feel in light mode, while Charcoal provides a sophisticated, low-strain environment for dark mode.

## Typography

The typography system uses **Inter** for its exceptional legibility and neutral, systematic tone. 

- **Weight Strategy:** Utilize **Bold (700)** and **Extra Bold (800)** for headlines to create a strong visual hierarchy. Body text should remain at **Regular (400)** for maximum readability.
- **Caps Usage:** Labels and small metadata (e.g., membership tiers) should use `Uppercase` with slightly increased letter spacing (+0.5px) to denote professional categorization.
- **Scaling:** On mobile devices, headline sizes should reduce by approximately 15% to ensure they do not dominate the viewport, maintaining a compact but powerful appearance.

## Layout & Spacing

This design system follows a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **The 8px Rule:** All spacing increments are multiples of 8px. This creates a predictable visual rhythm and simplifies developer handoff.
- **Density:** As an enterprise system, the design supports "High Density" views for data-heavy management (like student rosters) and "Standard Density" for consumer-facing portals (like booking classes).
- **Safe Areas:** Maintain a minimum 24px margin on the outer edges of the viewport to prevent the UI from feeling cramped against hardware bezels.

## Elevation & Depth

Borrowing from Material Design 3, this system uses **Tonal Elevation** rather than heavy drop shadows.

- **Surface Levels:** The background is the base. Cards and containers sit on "Level 1" (surface +1), slightly lighter in dark mode or with a very subtle 1px border (#E0E0E0) in light mode.
- **Shadows:** Use shadows sparingly. Only "floating" elements like Modals, Menus, or primary Action Buttons should use a soft, diffused shadow (Blur: 12px, Y: 4px, Opacity: 8% of Primary Color).
- **Transitions:** All depth changes (e.g., hovering over a card) must use a 200ms ease-out transition to simulate a premium, tactile feel.

## Shapes

The shape language is **Soft (0.25rem)**. 

- **The Logic:** Completely sharp corners feel too aggressive, while fully rounded corners feel too "consumer/social." A small 4px radius maintains a serious, structured look while softening the overall interface.
- **Buttons:** Use `rounded-sm` (4px) for primary actions.
- **Cards:** Use `rounded-lg` (8px) for major layout containers to create a distinct nesting visual.
- **Status Chips:** Status indicators (e.g., "Active", "Overdue") may use a higher roundedness (Pill) to differentiate them from functional buttons.

## Components

### Buttons
- **Primary:** Solid Black (#000000) with White text. High-contrast.
- **Accent:** Crimson Red (#B22222) for high-urgency CTAs (e.g., "Cancel Membership").
- **Secondary:** Transparent with a 1.5px black border (Ghost style).

### Cards
Cards are the primary organizational unit. They should feature a 1px border (#E0E0E0) and no shadow when resting. On hover, they should gain a subtle elevation and the border should darken to the Neutral-Gray.

### Inputs & Form Fields
Fields use a "Filled" style with a bottom-only border in their resting state, turning into a full 2px Black border on focus. Labels should float above the input.

### Chips & Badges
- **Belt Rank Badges:** Use a specific subset of colors corresponding to martial arts ranks (White, Yellow, Green, Brown, Black) with appropriate contrast-safe text colors.
- **Status Badges:** Use the Accent Red for "Overdue" and a soft Sage Green for "Paid/Active."

### Lists
Rosters and schedules use a "Striped" list approach or thin separators (#E0E0E0) to ensure high legibility of dense student data.

### Progress Indicators
Linear bars should use the Dojo Gold (#D4AF37) to track student progress toward their next belt rank, emphasizing the "Premium" nature of advancement.