import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const RootPage =
  window.location.pathname === '/epub-viewer'
    ? lazy(() => import('./components/EpubViewerExperiment.jsx'))
    : lazy(() => import('./App.jsx'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-base-100">
          <span className="loading loading-spinner loading-lg text-primary" />
        </main>
      }
    >
      <RootPage />
    </Suspense>
  </StrictMode>
);
