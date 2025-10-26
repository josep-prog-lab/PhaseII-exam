import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress browser extension connection errors
window.addEventListener('error', (event) => {
  // Filter out browser extension errors
  if (event.message.includes('Could not establish connection') ||
      event.message.includes('Receiving end does not exist') ||
      event.message.includes('Extension context invalidated')) {
    event.preventDefault();
    console.warn('Browser extension error suppressed:', event.message);
    return false;
  }
});

// Suppress unhandled promise rejections from browser extensions
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason);
  if (message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist') ||
      message.includes('Extension context invalidated')) {
    event.preventDefault();
    console.warn('Browser extension promise rejection suppressed:', message);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
