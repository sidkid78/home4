# Task: Establish UX/UI Accessibility Guidelines

**Goal:** Formulate a comprehensive set of UX/UI accessibility standards based on WCAG 2.1 AA (or higher) principles. Cover aspects such as color contrast, keyboard navigation, screen reader compatibility, and responsive text sizing specific to this product's interface. Save your findings to a file named 'accessibility_guidelines.md' in the 'workers/' subdirectory.

**Result:**
# UX/UI Accessibility Guidelines (WCAG 2.1 AA Compliance)

This document provides a comprehensive framework for ensuring all digital products meet WCAG 2.1 AA accessibility standards. Below are the design checklist, specific UI component guidelines, and the markdown guidelines to be saved under `workers/accessibility_guidelines.md`.

---

## 1. Accessibility Checklist for the Design Team

- [ ] **Contrast:** Ensure all standard text has a contrast ratio of at least 4.5:1. Large text (18pt / 24px or 14pt / 18.6px bold) must be at least 3:1.
- [ ] **Color Independence:** Do not rely on color alone to convey meaning (e.g., use warning icons alongside red text for errors).
- [ ] **Typography:** Support text resizing up to 200% without horizontal scrolling or UI overlap.
- [ ] **Keyboard Accessibility:** Verify all interactive elements can be focused and triggered using only the keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`).
- [ ] **Focus Indicators:** Ensure focus outlines are highly visible and never suppressed (`outline: none` without replacement).
- [ ] **Touch Targets:** Maintain minimum interactive target sizes of 44x44 CSS pixels.
- [ ] **Screen Readers:** Use semantic HTML and ensure appropriate alternative text exists for all images.

---

## 2. Specific UI Component Guidelines

### A. Buttons & Links
- **Contrast & States:** Hover, active, focus, and disabled states must have clear visual differences. Focus states must have a contrast ratio of at least 3:1 against the background.
- **Labels:** If a button contains only an icon (e.g., a "close" "X" icon), it must have an explicit `aria-label="Close"` or visually hidden text.
- **Roles:** Use `<button>` for actions that change on-screen state, and `<a>` for navigation to a new URL or page section.

### B. Forms & Input Fields
- **Labels:** Every input field must have a visible, programmatically linked `<label>` using the `for` (or `htmlFor`) attribute. Placeholders are *not* acceptable substitutes for labels.
- **Error States:** Display error messages in text directly associated with the input using `aria-describedby` pointing to the error message container. Do not rely solely on red borders.
- **Helper Text:** Any instructions or validation rules must be announced to screen readers (via `aria-describedby`).

### C. Navigation & Menus
- **Skip Links:** Provide a "Skip to main content" link at the very top of the page, visible on focus.
- **Consistency:** Navigation links and menus must appear in the same order across all pages.
- **Keyboard Behavior:** Users must be able to navigate dropdown menus using arrow keys or tab, and close menus using the `Escape` key.

### D. Modals & Dialogs
- **Focus Trapping:** When a modal is open, keyboard focus must be trapped within the modal. Tabbing must cycle only through elements inside the modal.
- **Dismissal:** Pressing `Escape` or clicking outside the modal must close it.
- **Initial Focus:** Focus must automatically move to the first interactive element inside the modal (or the modal container itself) upon opening, and return to the triggering element when closed.

---

## 3. Markdown File Saved in `workers/accessibility_guidelines.md`

```markdown
# UX/UI Accessibility Standards (WCAG 2.1 AA)

This document outlines the core accessibility standards required to ensure our product interface is perceivable, operable, understandable, and robust for all users.

## 1. Color Contrast
*   **Minimum Ratio:** All text and images of text must maintain a contrast ratio of at least **4.5:1** against the background.
*   **Large Text Exception:** Large-scale text (18pt+ or 14pt bold+) must maintain a ratio of at least **3:1**.
*   **Non-Text Contrast:** UI components (buttons, form borders) and graphical objects must have a contrast ratio of at least **3:1** against adjacent colors.
*   **No Reliance on Color:** Color must never be the only visual means of conveying information, indicating an action, or prompting a response. Always pair color with text labels or icons.

## 2. Keyboard Navigation
*   **Full Operability:** All interactive elements (links, buttons, form controls) must be fully functional using only a keyboard.
*   **Logical Focus Order:** The tab order must follow a logical, sequential path that matches the visual layout.
*   **Visible Focus Indicators:** Never remove the default browser focus ring. Ensure a highly visible focus indicator is present on all interactive elements when they receive focus.
*   **No Keyboard Traps:** Users must always be able to navigate into and out of any component (e.g., modals, menus) using only keyboard commands.

## 3. Screen Reader Compatibility
*   **Semantic HTML:** Use proper HTML5 elements (`<button>`, `<nav>`, `<main>`, `<header>`) to provide native accessibility features.
*   **Alternative Text:** Provide descriptive `alt` text for all informative images. Decorative images should have empty `alt` attributes (`alt=""`).
*   **Descriptive Links:** Link text must be meaningful (e.g., "Learn more about our pricing" instead of "Click here").
*   **Heading Structure:** Use a hierarchical heading structure (`<h1>` through `<h6>`) to allow screen reader users to navigate content efficiently.

## 4. Responsive Text & Layout
*   **Text Resizing:** The interface must support text scaling up to **200%** without loss of functionality or content overlap.
*   **Reflow (Responsive Design):** Content must not require two-dimensional scrolling (scrolling both vertically and horizontally) at a width of 320 CSS pixels.
*   **Text Spacing:** Ensure the design remains functional when users override line height (1.5x), spacing between paragraphs (2x), letter spacing (0.12x), and word spacing (0.16x).
```

**Key Findings:**
- Established a clear, actionable UX/UI design checklist ensuring compliance with WCAG 2.1 AA standards.
- Formulated detailed accessibility rules for specific UI elements, including Buttons, Forms, Navigation, and Modals.
- Created the official markdown standards file to be located at `workers/accessibility_guidelines.md`.
- Detailed key contrast ratios, text resizing standards, focus-trapping behaviors, and assistive technology guidelines.

**Metadata:**
- Worker: worker-Prod-4
- Tokens: 4696
- Duration: 16.4s
- Confidence: very_high
