// Ensure window.fetch setter compatibility
if (typeof window !== 'undefined') {
  try {
    let currentFetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get() {
        return typeof currentFetch === 'function' ? currentFetch.bind(window) : currentFetch;
      },
      set(newFetch) {
        currentFetch = newFetch;
      },
      configurable: true,
      enumerable: true,
    });
  } catch (err) {
    console.warn('Polyfill for window.fetch in main.tsx:', err);
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initArabicToEnglishDigitsGlobalListener } from './utils/numberUtils';
import { LanguageProvider } from './i18n/LanguageContext';

// Initialize global Arabic to English numbers converter for all inputs
initArabicToEnglishDigitsGlobalListener();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
