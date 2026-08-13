import { StrictMode } from 'react';
import { PostHogProvider } from '@posthog/react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

const postHogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: '2026-05-30',
  capture_pageview: 'history_change',
} as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_POSTHOG_PROJECT_TOKEN}
      options={postHogOptions}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </StrictMode>
);
