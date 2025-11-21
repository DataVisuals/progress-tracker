# Color System Documentation

## Overview

The Progress Tracker uses a centralized color system to ensure consistency and avoid confusion between different types of visual indicators.

## RAG Status Colors

RAG (Red-Amber-Green) colors are used exclusively for metric status indicators:

### Light Mode
- **Red**: `#dc2626` - Behind schedule / Critical
- **Amber**: `#f59e0b` - At risk / Warning
- **Green**: `#16a34a` - On track / Good
- **Grey**: `#9ca3af` - No data / Unknown

### Dark Mode
- **Red**: `#f87171` - Lighter red for better visibility
- **Amber**: `#fbbf24` - Lighter amber for better visibility
- **Green**: `#4ade80` - Lighter green for better visibility
- **Grey**: `#9ca3af` - Same grey works in both modes

### Usage

```css
/* Using CSS variables */
.my-element {
  color: var(--rag-red);
  background-color: var(--rag-green-light);
}

/* Using utility classes */
<div class="rag-red-bg">Red background</div>
<span class="rag-amber">Amber text</span>
```

## Portfolio Colors

Portfolio colors are used for grouping and organizing projects. These colors are **intentionally distinct** from RAG status colors to avoid confusion:

- **Blue**: `#3b82f6`
- **Purple**: `#8b5cf6`
- **Pink**: `#ec4899`
- **Cyan**: `#06b6d4`
- **Indigo**: `#6366f1`
- **Teal**: `#14b8a6`
- **Violet**: `#a855f7`
- **Slate**: `#64748b`

### Important Notes

- **Never use red, amber/orange, or green for portfolios**
- **Never use blue, purple, pink, cyan, indigo, teal, violet, or slate for RAG indicators**

## Implementation

### Files

- `src/constants/colors.js` - JavaScript color constants
- `src/styles/rag-colors.css` - CSS variables and utility classes
- `src/components/PortfolioManager.jsx` - Portfolio color picker

### Importing

The RAG color system is automatically available throughout the app via `src/App.css`:

```css
@import './styles/rag-colors.css';
```

## Migration Guide

If you need to update existing code to use the new color system:

1. Replace hardcoded RAG colors with CSS variables:
   ```css
   /* Old */
   color: #dc2626;

   /* New */
   color: var(--rag-red);
   ```

2. Update portfolio colors in PortfolioManager if needed

3. Ensure dark mode uses the appropriate color variables

## Color Accessibility

All colors have been chosen to meet WCAG AA contrast requirements when used with appropriate backgrounds.
