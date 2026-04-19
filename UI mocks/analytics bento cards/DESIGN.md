# Design System Specification: Editorial Depth & Tonal Hierarchy

## 1. Overview & Creative North Star
**The Creative North Star: "The Ethereal Curator"**

This design system rejects the "flatness" of utility-first frameworks in favor of a high-end, editorial experience. It is designed to feel like a curated digital gallery—where information isn't just displayed, but presented on a stage of light and shadow. We move away from rigid, boxed-in layouts by using **intentional asymmetry**, **overlapping layers**, and **tonal depth**. The interface should feel tactile and "expensive," utilizing the interplay between deep violets and glowing ambers to guide the user’s eye through a sophisticated narrative.

---

## 2. Color Philosophy & Surface Architecture

The palette is anchored in deep Purples (`primary`), balanced by warm, energetic Tertiary tones (`tertiary_fixed`) for progress and highlights.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections or containment. Traditional "lines" create visual clutter. Instead, boundaries must be defined through:
- **Background Color Shifts:** Placing a `surface_container_low` element against a `surface` background.
- **Tonal Transitions:** Using the hierarchy of surface tiers to suggest edge and volume.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials.
- **Base Layer:** `surface` (#f9f9fe).
- **Secondary Sectioning:** `surface_container_low` (#f3f3f8).
- **Interactive Layers:** `surface_container_lowest` (#ffffff) for high-impact cards.
- **Nesting:** When placing an element inside a card, use `surface_container` (#ededf2) to create a "recessed" look, or a glassmorphic overlay for a "floating" feel.

### The "Glass & Gradient" Rule
To escape the "default" look, primary CTAs and Hero sections should utilize a **Signature Gradient**:
- **Primary Gradient:** Linear 135° from `primary` (#5625a8) to `primary_container` (#6f42c1).
- **Glassmorphism:** Use `surface_container_lowest` at 60% opacity with a `24px` backdrop-blur for floating navigation or high-priority modals.

---

## 3. Typography: The Editorial Voice

We utilize a dual-font system to create an authoritative yet approachable hierarchy.

- **The Display Scale (Plus Jakarta Sans):** Used for `display` and `headline` tiers. This typeface provides a modern, geometric clarity that feels premium and spacious. Use high-contrast sizing (e.g., `display-lg` at 3.5rem) to create clear entry points for the eye.
- **The Functional Scale (Manrope):** Used for `title`, `body`, and `label` tiers. Manrope offers exceptional legibility at smaller scales while maintaining a sophisticated, high-end tech aesthetic.
- **Hierarchy through Weight:** Use `title-lg` for card headers to establish immediate context, and `body-sm` in `on_surface_variant` for metadata to create a "ghosted" secondary layer of information.

---

## 4. Elevation & Depth: Beyond the Shadow

This system replaces traditional drop shadows with **Tonal Layering** and **Ambient Light simulation.**

### The Layering Principle
True depth is achieved by stacking. A `surface_container_lowest` card sitting on a `surface_container_low` background creates a natural, soft "lift" that requires no shadow. 

### Ambient Shadows (The 8% Rule)
When a card must float (e.g., an active "Learning Path" card), use a multi-layered shadow:
- **Shadow Color:** A tinted version of `on_surface` (deep indigo/grey), never pure black.
- **Values:** `0px 20px 40px rgba(26, 28, 31, 0.06)`. It should feel like a soft glow rather than a harsh cutout.

### The "Ghost Border" Fallback
If contrast is required for accessibility, use a **Ghost Border**: `outline_variant` (#ccc3d5) at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Non-Flat Dynamic Cards
Cards must never be flat blocks of color.
- **Background:** Solid `surface_container_lowest`.
- **Top-Right Accent:** A subtle 10% opacity `tertiary_fixed` radial gradient in the top right corner to suggest ambient light.
- **Corner Radius:** Use `lg` (2rem) for primary cards to soften the aesthetic.

### Progress Indicators (The Tertiary Punch)
To provide warmth against the cool purples:
- **Track:** `secondary_container` (#e1dfdf).
- **Indicator:** A gradient from `tertiary` (#633f00) to `tertiary_fixed_dim` (#ffb957). This creates a "glowing" energy that signals movement and achievement.

### Buttons & Interaction
- **Primary Button:** `primary` background with `on_primary` text. Use `full` (pill) rounding. On hover, transition to the **Primary Gradient**.
- **Secondary/Ghost Button:** No background. Use `primary` text with a `1.5rem` horizontal padding. Interaction is signaled by a subtle `surface_container_high` background shift on hover.

### Dynamic Chips
- **Status Chips:** Use `primary_fixed` (#ebddff) with `on_primary_fixed_variant` (#5726a8) text. 
- **Rounding:** Always `full`.

---

## 6. Do’s and Don’ts

### Do:
- **Use White Space as a Separator:** Prefer `32px` of vertical space over a divider line.
- **Overlap Elements:** Let a chip or an icon "break" the top edge of a card to create a 3D effect.
- **Tonal Nesting:** Place `secondary_container` elements inside `surface_container_lowest` cards to create a "pressed-in" look for secondary info.

### Don't:
- **Don't use 100% Black:** Even for text, use `on_surface` (#1a1c1f) to maintain the soft editorial feel.
- **Don't use Sharp Corners:** Avoid the `none` and `sm` rounding scales for layout-defining elements. Stick to `DEFAULT` (1rem) and above.
- **Don't Over-Shadow:** If three cards are visible, only the "Active" or "Featured" card should have an ambient shadow. The others should rely on color shifts.
- **Don't Use Rigid Grids:** Occasionally offset a title or a progress bar by `8px-12px` to the right to create a more dynamic, asymmetric "magazine" layout.