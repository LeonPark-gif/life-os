import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'

console.log("Main script executing...");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <StrictMode>
      <GlobalErrorBoundary componentName="Die DaSilva OS App">
        <App />
      </GlobalErrorBoundary>
    </StrictMode>,
  );
} catch (e: any) {
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-size: 24px;">
    <h1>CRITICAL MOUNT ERROR</h1>
    <pre>${e.toString()}</pre>
    <pre>${e.stack}</pre>
  </div>`;
  console.error("Mount Error:", e);
}
