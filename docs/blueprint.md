# **App Name**: SlideSage

## Core Features:

- Interactive Index: Displays an interactive table of contents for the 'Signals and Systems' textbook, rendered from nested JSON.
- HTML Slide Viewer: Renders user-provided HTML slides within an IFrame, with responsive meta tags and basic CSS resets for consistent viewing.
- Offline Storage: Saves HTML content to IndexedDB, using keys that align to sections within the textbook.
- Clear Slide Feature: Presents a modal interface for clearing slide data with a confirmation step.
- AI-assisted Improvement: Offers an AI-powered 'Improve with AI' button to suggest better HTML based on Google's Gemini. It acts as a tool which decides when and if to add elements such as the KaTex CDN, or improve styling via CSS.
- Presentation Mode: Supports full-screen presentation mode for distraction-free viewing of slides.

## Style Guidelines:

- Primary color: A calm, desaturated blue (#60A5FA) is used for key interactive elements and highlights to maintain focus.
- Background color: A very dark gray (#111827) provides contrast and minimizes distraction in presentation mode.
- Accent color: A violet tone (#A78BFA), analogous to the primary blue, is used as an accent for visited links or to indicate secondary interactive elements.
- Body and headline font: 'Inter' (sans-serif) provides a modern, neutral, and readable typeface for both headlines and body text.
- Code font: 'Source Code Pro' for displaying code snippets, preserving legibility and alignment.
- Lucide-react icons provide a consistent, minimalist style throughout the interface.
- A split-panel layout (index + viewer) adapts to different screen sizes, ensuring usability on both desktop and mobile devices.