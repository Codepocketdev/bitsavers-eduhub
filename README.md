# Bitsavers EduHub

A modern, multi-page React website for Bitsavers EduHub — a Bitcoin education company.

## Tech Stack

- **React 18** — UI library
- **React Router v6** — Multi-page routing
- **Vite** — Build tool
- **Tailwind CSS** — Utility-first styling
- **Framer Motion** — Animations & transitions
- **Lucide React** — Icons

## Modern JavaScript Features Used

- ES6+ Modules & dynamic imports (`React.lazy`, `Suspense`)
- Functional components with Hooks (`useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`, `useReducer`, custom hooks)
- Context API with `useReducer` for global state
- `IntersectionObserver` API for scroll-triggered animations
- `requestAnimationFrame` for smooth counter animations
- `Clipboard` API for copy-to-clipboard
- `localStorage` API for theme persistence
- `matchMedia` API for responsive hooks
- Form validation with controlled inputs
- Error handling with try/catch & optional chaining
- Template literals, destructuring, spread/rest operators
- Arrow functions & higher-order functions
- Async/await for simulated API calls

## Features

- Multi-page routing (Home, About, Programs, Team, FAQ, Contact)
- Dark / Light mode toggle with persistence
- Responsive design (mobile, tablet, desktop)
- Smooth page transitions with Framer Motion
- Scroll progress indicator
- Animated counters
- FAQ accordion with search
- Contact form with validation
- Toast notifications
- Mobile hamburger menu with keyboard support (Escape to close)
- Lazy-loaded pages for performance
- Reduced motion support for accessibility

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
  components/     # Reusable UI components
  pages/          # Route-level page components
  hooks/          # Custom React hooks
  context/        # React Context providers
  data/           # Static content data
  App.jsx         # Main app with routing
  main.jsx        # Entry point
  index.css       # Global styles + Tailwind
```

## Customization

- Replace placeholder images in `src/data/content.js`
- Update team info in `src/data/content.js`
- Modify colors in `tailwind.config.js`
- Add real API endpoint in `src/pages/Contact.jsx`
