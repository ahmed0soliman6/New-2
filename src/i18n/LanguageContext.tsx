import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { safeStorage, StorageKeys } from '../services/storage';
import { Language, translations, ARABIC_PHRASE_DICTIONARY, translateArabicToEnglish } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (keyOrText: string, fallback?: string) => string;
  translateText: (text: string) => string;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Cache for node original text values
let originalTextMap = new WeakMap<Node, string>();
let originalPlaceholderMap = new WeakMap<Element, string>();
let originalTitleMap = new WeakMap<Element, string>();
let originalAriaLabelMap = new WeakMap<Element, string>();

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = safeStorage.getItem(StorageKeys.LANGUAGE, 'ar');
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });

  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  useEffect(() => {
    safeStorage.setItem(StorageKeys.LANGUAGE, language);
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', language);
  }, [language, dir]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  const translateText = useCallback(
    (text: string): string => {
      if (language === 'ar' || !text) return text;
      return translateArabicToEnglish(text);
    },
    [language]
  );

  const t = useCallback(
    (keyOrText: string, fallback?: string): string => {
      if (!keyOrText) return '';

      // 1. Direct key match in translations
      const entry = translations[keyOrText];
      if (entry && entry[language]) {
        return entry[language];
      }

      // 2. If English is selected and keyOrText is in Arabic
      if (language === 'en') {
        if (fallback) return fallback;
        return translateArabicToEnglish(keyOrText);
      }

      // 3. Arabic mode: if a key wasn't found, check if it was already Arabic or fallback
      if (fallback !== undefined && language === 'en') {
        return fallback;
      }

      return keyOrText;
    },
    [language]
  );

  // Auto-translate DOM text nodes, input placeholders, titles, and aria-labels
  // in real time when English is active, strictly excluding the prescription pad
  // container (#printable-prescription-pad) and user custom input / patient names.
  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;

    let observer: MutationObserver | null = null;

    const safeModify = (action: () => void) => {
      if (observer) {
        observer.disconnect();
      }
      action();
      if (observer && rootEl) {
        observer.observe(rootEl, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
    };

    if (language === 'ar') {
      originalTextMap = new WeakMap<Node, string>();
      originalPlaceholderMap = new WeakMap<Element, string>();
      originalTitleMap = new WeakMap<Element, string>();
      originalAriaLabelMap = new WeakMap<Element, string>();
    }

    const translateElementAttributes = (el: Element) => {
      if (
        el.closest('#printable-prescription-pad') ||
        el.closest('[data-no-translate="true"]') ||
        el.closest('.no-translate') ||
        el.closest('.patient-name') ||
        el.closest('.clinical-data') ||
        el.closest('.patient-data') ||
        el.closest('.rx-item') ||
        el.closest('.rx-instructions') ||
        el.closest('.diagnosis-text') ||
        el.closest('.patient-phone') ||
        el.closest('.patient-address') ||
        el.closest('.patient-notes')
      ) {
        return;
      }

      // 1. Placeholder on input / textarea
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const ph = el.placeholder;
        if (ph && ph.trim()) {
          if (language === 'en') {
            const translated = translateArabicToEnglish(ph.trim());
            if (translated !== ph.trim()) {
              if (!originalPlaceholderMap.has(el)) {
                originalPlaceholderMap.set(el, ph);
              }
              safeModify(() => {
                el.placeholder = translated;
              });
            }
          } else {
            if (originalPlaceholderMap.has(el)) {
              const orig = originalPlaceholderMap.get(el);
              if (orig !== undefined && el.placeholder !== orig) {
                safeModify(() => {
                  el.placeholder = orig;
                });
              }
            }
          }
        }
      }

      // 2. Title attribute
      if (el instanceof HTMLElement) {
        if (el.title && el.title.trim()) {
          if (language === 'en') {
            const translated = translateArabicToEnglish(el.title.trim());
            if (translated !== el.title.trim()) {
              if (!originalTitleMap.has(el)) {
                originalTitleMap.set(el, el.title);
              }
              safeModify(() => {
                el.title = translated;
              });
            }
          } else {
            if (originalTitleMap.has(el)) {
              const orig = originalTitleMap.get(el);
              if (orig !== undefined && el.title !== orig) {
                safeModify(() => {
                  el.title = orig;
                });
              }
            }
          }
        }

        // 3. Aria-label attribute
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
          if (language === 'en') {
            const translated = translateArabicToEnglish(ariaLabel.trim());
            if (translated !== ariaLabel.trim()) {
              if (!originalAriaLabelMap.has(el)) {
                originalAriaLabelMap.set(el, ariaLabel);
              }
              safeModify(() => {
                el.setAttribute('aria-label', translated);
              });
            }
          } else {
            if (originalAriaLabelMap.has(el)) {
              const orig = originalAriaLabelMap.get(el);
              if (orig !== undefined && el.getAttribute('aria-label') !== orig) {
                safeModify(() => {
                  el.setAttribute('aria-label', orig);
                });
              }
            }
          }
        }
      }
    };

    const translateNode = (node: Node) => {
      // If element, translate its interactive attributes
      if (node.nodeType === Node.ELEMENT_NODE) {
        translateElementAttributes(node as Element);
      }

      // Skip script, style, code, pre
      const parent = node.parentElement;
      if (!parent) return;

      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'input', 'textarea', 'code', 'pre'].includes(tag)) {
        return;
      }

      // Skip elements marked explicitly as no-translate or inside clinical/prescription data
      if (
        parent.closest('#printable-prescription-pad') ||
        parent.closest('[data-no-translate="true"]') ||
        parent.closest('.no-translate') ||
        parent.closest('.patient-name') ||
        parent.closest('.clinical-data') ||
        parent.closest('.patient-data') ||
        parent.closest('.rx-item') ||
        parent.closest('.rx-instructions') ||
        parent.closest('.diagnosis-text') ||
        parent.closest('.patient-phone') ||
        parent.closest('.patient-address') ||
        parent.closest('.patient-notes')
      ) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
        const raw = node.nodeValue;
        const trimmed = raw.trim();
        if (!trimmed) return;

        if (language === 'en') {
          // Check if there's an Arabic translation from the original source
          const translated = translateArabicToEnglish(trimmed);
          if (translated !== trimmed) {
            // Store original Arabic source if not yet stored
            if (!originalTextMap.has(node)) {
              originalTextMap.set(node, raw);
            }
            const leadingWs = raw.match(/^\s*/)?.[0] || '';
            const trailingWs = raw.match(/\s*$/)?.[0] || '';
            const finalValue = leadingWs + translated + trailingWs;
            if (node.nodeValue !== finalValue) {
              safeModify(() => {
                node.nodeValue = finalValue;
              });
            }
          }
        } else {
          // Restore original Arabic
          if (originalTextMap.has(node)) {
            const orig = originalTextMap.get(node);
            if (orig !== undefined && node.nodeValue !== orig) {
              safeModify(() => {
                node.nodeValue = orig;
              });
            }
          }
        }
      }
    };

    const walk = (node: Node) => {
      translateNode(node);
      let child = node.firstChild;
      while (child) {
        walk(child);
        child = child.nextSibling;
      }
    };

    // Run initial walk
    walk(rootEl);

    // Run mutation observer for dynamically rendered elements
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateNode(mutation.target);
        } else if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((added) => {
            walk(added);
          });
        }
      }
    });

    observer.observe(rootEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        translateText,
        dir,
        isRTL,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside LanguageProvider
    return {
      language: 'ar',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (keyOrText: string, fallback?: string) => translations[keyOrText]?.ar || fallback || keyOrText,
      translateText: (text: string) => text,
      dir: 'rtl',
      isRTL: true,
    };
  }
  return context;
};

