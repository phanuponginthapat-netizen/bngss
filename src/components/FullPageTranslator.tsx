import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "app.pageTranslateLang";
const CHANGE_EVENT = "app:page-translate-change";
const STATUS_EVENT = "app:page-translate-status";
const PACK_STATUS_EVENT = "app:translate-pack-status";
const PACK_PREFIX = "app.translatePack.";
const OBSERVER_RELEASE_DELAY = 0;
const MAX_CHUNK_ITEMS = 12;
const MAX_CHUNK_CHARS = 1200;

const loadPack = (lang: string): Record<string, string> => {
  try {
    const raw = localStorage.getItem(PACK_PREFIX + lang);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const savePack = (lang: string, pack: Record<string, string>) => {
  try {
    localStorage.setItem(PACK_PREFIX + lang, JSON.stringify(pack));
  } catch {
    /* quota - ignore */
  }
};

const dispatchPackStatus = (
  detail: { loading: boolean; lang?: string; progress?: number; total?: number },
) => {
  window.dispatchEvent(new CustomEvent(PACK_STATUS_EVENT, { detail }));
};

const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "select",
  "option",
  "code",
  "pre",
  "svg",
  "canvas",
  "iframe",
  "[translate='no']",
  ".notranslate",
  "#google_translate_element",
].join(",");

type AttrName = "placeholder" | "title" | "aria-label" | "value";

interface TextItem {
  node: Text;
  source: string;
  leading: string;
  trailing: string;
}

interface AttrItem {
  element: HTMLElement;
  attr: AttrName;
  source: string;
}

const hasLetters = (value: string) => /\p{L}/u.test(value);

const splitWhitespace = (value: string) => {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return {
    leading: match?.[1] ?? "",
    core: match?.[2] ?? value,
    trailing: match?.[3] ?? "",
  };
};

const getStoredLanguage = () => {
  if (typeof window === "undefined") return "th";
  return localStorage.getItem(STORAGE_KEY) || "th";
};

const buildChunks = (texts: string[]) => {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const text of texts) {
    const nextLength = currentLength + text.length;
    if (
      currentChunk.length >= MAX_CHUNK_ITEMS ||
      (currentChunk.length > 0 && nextLength > MAX_CHUNK_CHARS)
    ) {
      chunks.push(currentChunk);
      currentChunk = [text];
      currentLength = text.length;
      continue;
    }

    currentChunk.push(text);
    currentLength = nextLength;
  }

  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
};

export const FullPageTranslator = () => {
  const textSourcesRef = useRef(new Map<Text, string>());
  const attrSourcesRef = useRef(new Map<HTMLElement, Partial<Record<AttrName, string>>>());
  const cacheRef = useRef(new Map<string, string>());
  const packsRef = useRef(new Map<string, Record<string, string>>());
  const observerRef = useRef<MutationObserver | null>(null);
  const debounceRef = useRef<number | null>(null);
  const activeRunRef = useRef(0);
  const currentLangRef = useRef<string>(getStoredLanguage());
  const suppressObserverRef = useRef(false);

  const dispatchStatus = (busy: boolean) => {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, { detail: { busy } }));
  };

  const hydratePackForLang = (lang: string) => {
    if (lang === "th") return;
    if (!packsRef.current.has(lang)) {
      const pack = loadPack(lang);
      packsRef.current.set(lang, pack);
      for (const [source, translated] of Object.entries(pack)) {
        cacheRef.current.set(`${lang}:${source}`, translated);
      }
    }
  };

  const withSuppressedObserver = (callback: () => void) => {
    suppressObserverRef.current = true;
    callback();
    window.setTimeout(() => {
      suppressObserverRef.current = false;
    }, OBSERVER_RELEASE_DELAY);
  };

  const restoreOriginalContent = () => {
    activeRunRef.current += 1;
    withSuppressedObserver(() => {
      for (const [node, original] of textSourcesRef.current.entries()) {
        if (!node.isConnected) {
          textSourcesRef.current.delete(node);
          continue;
        }

        node.nodeValue = original;
      }

      for (const [element, attrs] of attrSourcesRef.current.entries()) {
        if (!element.isConnected) {
          attrSourcesRef.current.delete(element);
          continue;
        }

        for (const [attr, value] of Object.entries(attrs) as Array<[AttrName, string]>) {
          element.setAttribute(attr, value);
        }
      }
    });

    document.documentElement.lang = "th";
    document.documentElement.removeAttribute("data-page-translated");
    dispatchStatus(false);
  };

  const isIgnoredElement = (element: Element | null) => {
    if (!element) return true;
    return Boolean(element.closest(SKIP_SELECTOR));
  };

  const collectTextItems = () => {
    const textItems: TextItem[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const textNode = node as Text;
        if (!textNode.parentElement || isIgnoredElement(textNode.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        const original = textSourcesRef.current.get(textNode) ?? (textNode.nodeValue || "");
        const { core } = splitWhitespace(original);
        if (!core.trim() || !hasLetters(core)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let currentNode: Node | null = walker.nextNode();
    while (currentNode) {
      const textNode = currentNode as Text;
      const original = textSourcesRef.current.get(textNode) ?? (textNode.nodeValue || "");
      textSourcesRef.current.set(textNode, original);

      const { leading, core, trailing } = splitWhitespace(original);
      if (core.trim() && hasLetters(core)) {
        textItems.push({ node: textNode, source: core, leading, trailing });
      }

      currentNode = walker.nextNode();
    }

    return textItems;
  };

  const collectAttrItems = () => {
    const attrItems: AttrItem[] = [];
    const candidates = document.body.querySelectorAll<HTMLElement>(
      "[placeholder],[title],[aria-label],input[type='button'][value],input[type='submit'][value]",
    );

    candidates.forEach((element) => {
      if (isIgnoredElement(element)) return;

      const savedAttrs = attrSourcesRef.current.get(element) ?? {};
      const attrs: AttrName[] = ["placeholder", "title", "aria-label"];
      if (element instanceof HTMLInputElement) {
        const type = element.type?.toLowerCase();
        if (type === "button" || type === "submit") attrs.push("value");
      }

      attrs.forEach((attr) => {
        const original = savedAttrs[attr] ?? element.getAttribute(attr) ?? "";
        if (!savedAttrs[attr] && original) {
          savedAttrs[attr] = original;
        }

        if (original.trim() && hasLetters(original)) {
          attrItems.push({ element, attr, source: original });
        }
      });

      if (Object.keys(savedAttrs).length > 0) {
        attrSourcesRef.current.set(element, savedAttrs);
      }
    });

    return attrItems;
  };

  const requestTranslations = async (texts: string[], target: string) => {
    const { data, error } = await supabase.functions.invoke("translate-text", {
      body: { texts, target },
    });

    if (error) throw error;

    const payload = (data ?? {}) as {
      translations?: string[];
      fallback?: boolean;
      code?: string;
      error?: string;
    };

    if (payload.fallback) {
      const err = new Error(payload.error || "translation service unavailable");
      (err as any).code = payload.code || "SERVICE_UNAVAILABLE";
      (err as any).fallback = true;
      throw err;
    }

    const translations = Array.isArray(payload.translations) ? payload.translations : [];

    if (translations.length !== texts.length) {
      throw new Error("Incomplete translation batch");
    }

    return translations;
  };

  const translatePage = async () => {
    const target = currentLangRef.current;
    if (target === "th") {
      restoreOriginalContent();
      return;
    }

    hydratePackForLang(target);

    const runId = ++activeRunRef.current;
    dispatchStatus(true);

    try {
      const textItems = collectTextItems();
      const attrItems = collectAttrItems();

      const uncachedTexts = Array.from(
        new Set([...textItems.map((item) => item.source), ...attrItems.map((item) => item.source)]),
      ).filter((source) => !cacheRef.current.has(`${target}:${source}`));

      const chunks = buildChunks(uncachedTexts);
      const totalChunks = chunks.length;
      const isPackLoad = totalChunks > 0;
      if (isPackLoad) {
        dispatchPackStatus({ loading: true, lang: target, progress: 0, total: totalChunks });
      }

      const pack = packsRef.current.get(target) ?? {};
      packsRef.current.set(target, pack);

      let completed = 0;
      let cursor = 0;
      let aborted = false;
      const CONCURRENCY = 5;

      const worker = async () => {
        while (true) {
          if (runId !== activeRunRef.current || target !== currentLangRef.current) {
            aborted = true;
            return;
          }
          const i = cursor++;
          if (i >= chunks.length) return;
          const chunk = chunks[i];
          const translations = await requestTranslations(chunk, target);
          chunk.forEach((source, index) => {
            const translated = translations[index] || source;
            cacheRef.current.set(`${target}:${source}`, translated);
            pack[source] = translated;
          });
          savePack(target, pack);
          completed += 1;
          if (isPackLoad) {
            dispatchPackStatus({ loading: true, lang: target, progress: completed, total: totalChunks });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker()),
      );

      if (isPackLoad) {
        dispatchPackStatus({ loading: false, lang: target });
      }

      if (aborted) return;

      if (runId !== activeRunRef.current || target !== currentLangRef.current) return;

      withSuppressedObserver(() => {
        textItems.forEach((item) => {
          if (!item.node.isConnected) return;
          const translated = cacheRef.current.get(`${target}:${item.source}`) ?? item.source;
          item.node.nodeValue = `${item.leading}${translated}${item.trailing}`;
        });

        attrItems.forEach((item) => {
          if (!item.element.isConnected) return;
          const translated = cacheRef.current.get(`${target}:${item.source}`) ?? item.source;
          item.element.setAttribute(item.attr, translated);
        });
      });

      document.documentElement.lang = target;
      document.documentElement.setAttribute("data-page-translated", target);
    } catch (error: any) {
      console.error("Full-page translation failed", error);
      dispatchPackStatus({ loading: false, lang: target });
      if (error?.fallback) {
        const code = error?.code;
        window.dispatchEvent(new CustomEvent("app:translate-unavailable", {
          detail: {
            code,
            message:
              code === "MISSING_PROVIDER_KEY"
                ? "ยังไม่ได้ตั้งค่า API key สำหรับผู้ให้บริการแปล"
                : code === "INVALID_PROVIDER_KEY"
                  ? "API key ของผู้ให้บริการแปลไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน"
                  : code === "RATE_LIMITED"
                    ? "ผู้ให้บริการแปลใช้งานเกินโควต้าหรือเกินอัตราที่กำหนดชั่วคราว"
                    : code === "PAYMENT_REQUIRED"
                      ? "บัญชีผู้ให้บริการแปลต้องมีเครดิตหรือเปิด billing"
                      : code === "ALL_PROVIDERS_FAILED"
                        ? "ผู้ให้บริการแปลภายนอกที่ตั้งค่าไว้ทั้งหมดใช้งานไม่ได้ในขณะนี้"
                      : "บริการแปลไม่พร้อมใช้งานชั่วคราว",
          },
        }));
        // revert UI to Thai so user isn't stuck on a half-translated state
        currentLangRef.current = "th";
        try { localStorage.setItem(STORAGE_KEY, "th"); } catch { /* ignore */ }
        restoreOriginalContent();
      }
    } finally {
      if (runId === activeRunRef.current && target === currentLangRef.current) {
        dispatchStatus(false);
      }
    }
  };

  const scheduleTranslate = () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      void translatePage();
    }, 250);
  };

  useEffect(() => {
    currentLangRef.current = getStoredLanguage();
    hydratePackForLang(currentLangRef.current);

    const handleTranslateChange = (event: Event) => {
      const nextLang = (event as CustomEvent<{ lang?: string }>).detail?.lang || getStoredLanguage();
      currentLangRef.current = nextLang;
      if (nextLang === "th") {
        restoreOriginalContent();
        return;
      }

      hydratePackForLang(nextLang);
      scheduleTranslate();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      currentLangRef.current = event.newValue || "th";
      if (currentLangRef.current === "th") {
        restoreOriginalContent();
        return;
      }

      hydratePackForLang(currentLangRef.current);
      scheduleTranslate();
    };

    observerRef.current = new MutationObserver(() => {
      if (suppressObserverRef.current || currentLangRef.current === "th") return;
      scheduleTranslate();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "value"],
    });

    window.addEventListener(CHANGE_EVENT, handleTranslateChange as EventListener);
    window.addEventListener("storage", handleStorage);

    if (currentLangRef.current !== "th") {
      scheduleTranslate();
    }

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener(CHANGE_EVENT, handleTranslateChange as EventListener);
      window.removeEventListener("storage", handleStorage);

      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return null;
};

export default FullPageTranslator;