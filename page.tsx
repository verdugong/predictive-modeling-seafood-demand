@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.22), transparent 35%),
    radial-gradient(circle at right top, rgba(16, 185, 129, 0.18), transparent 30%),
    linear-gradient(180deg, #020617 0%, #0f172a 55%, #020617 100%);
}

body {
  min-height: 100vh;
  font-family: var(--font-space-grotesk), sans-serif;
}

* {
  box-sizing: border-box;
}

.glass-panel {
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(148, 163, 184, 0.18);
}
