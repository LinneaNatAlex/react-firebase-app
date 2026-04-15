import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { mergeSiteContent, fetchSiteContent } from "../services/siteContent";

const SiteContentContext = createContext(null);

function defaultSiteContentValue() {
  return {
    content: mergeSiteContent({}),
    loading: false,
    refresh: async () => mergeSiteContent({}),
  };
}

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(() => mergeSiteContent({}));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await fetchSiteContent();
    setContent(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchSiteContent();
        if (!cancelled) setContent(next);
      } catch (e) {
        console.error("SiteContent fetch:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ content, loading, refresh }),
    [content, loading, refresh],
  );

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  const ctx = useContext(SiteContentContext);
  if (!ctx) return defaultSiteContentValue();
  return ctx;
}
