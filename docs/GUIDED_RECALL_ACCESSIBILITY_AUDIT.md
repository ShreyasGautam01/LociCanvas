# Guided Recall accessibility audit

**Implementation slice:** PR #11 — `feat/guided-recall-accessibility`

## Automated coverage added

- Dialog naming is connected to the active manager or runner heading.
- Opening Guided Recall focuses the manager heading; opening route creation/editing focuses the route-name field.
- Starting a recall stop focuses its cue. After an attempt, focus moves to confidence choices; after reveal, it moves to the saved-answer heading; after grading or skipping, it moves to Continue.
- Gateway entry focuses the gateway cue. Completion or abandonment focuses the result heading. Exiting the runner restores focus to the manager heading.
- The confidence choices are a labelled fieldset/radio group, and session progress has a semantic progressbar label and current step value.
- Focus-visible outlines are provided for keyboard-operated runner controls.
- The hidden answer is checked against visible text and accessible-label attributes before reveal.
- The browser suite runs at 390 × 844, checks the dialog for horizontal overflow, and emulates `prefers-reduced-motion: reduce`.
- Framer Motion is configured to respect the operating system preference; the runner's progress transition is disabled under reduced motion.

## Manual release checklist

Playwright verifies browser semantics and keyboard event behavior; it is not a substitute for testing with actual assistive technologies. Before calling the screen-reader audit complete, manually verify:

1. Keyboard-only use with Tab, Shift+Tab, Enter, Space, and arrow keys through route authoring, recall, reveal, grading, resume, and exit.
2. NVDA with Firefox or Chrome on Windows; verify dialog title, current step, confidence legend, hidden-answer boundary, progress, errors, and result announcements.
3. VoiceOver with Safari on macOS/iOS and TalkBack with Chrome on Android where those platforms are supported.
4. At minimum 360 px, 390 px, tablet, and desktop widths; verify browser zoom and long prompt/answer wrapping.
5. Operating-system reduced-motion preference; ensure no essential information or action depends on animation.

## Explicitly not claimed

- No formal WCAG conformance assessment has been performed.
- No human screen-reader session or physical-device test is represented by the automated CI checks.
- Broken-reference repair and storage-quota UI still need dedicated browser acceptance coverage.
- This slice does not evaluate learning efficacy or change review scheduling.
