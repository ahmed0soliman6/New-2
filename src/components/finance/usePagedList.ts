import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentSnapshot } from 'firebase/firestore';

export interface PageData<T> {
  items: T[];
  cursor: DocumentSnapshot | null;
  hasNext: boolean;
}

export function usePagedList<T>(
  fetchPage: (after: DocumentSnapshot | null) => Promise<PageData<T>>,
  refreshKey: number
) {
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: string | null; items: T[]; hasNext: boolean }>({
    loading: true,
    error: null,
    items: [],
    hasNext: false,
  });
  const cache = useRef(new Map<number, PageData<T>>());
  const reqId = useRef(0);

  const load = useCallback(
    async (index: number) => {
      const hit = cache.current.get(index);
      if (hit) {
        // العودة لصفحة سبق جلبها = بلا قراءات شبكة
        setPageIndex(index);
        setState({ loading: false, error: null, items: hit.items, hasNext: hit.hasNext });
        return;
      }
      const my = ++reqId.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const after = index === 0 ? null : cache.current.get(index - 1)?.cursor ?? null;
        const res = await fetchPage(after);
        if (my !== reqId.current) return; // طلب قديم
        cache.current.set(index, res);
        setPageIndex(index);
        setState({ loading: false, error: null, items: res.items, hasNext: res.hasNext });
      } catch (e) {
        if (my !== reqId.current) return;
        setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    cache.current.clear();
    setPageIndex(0);
    void load(0);
  }, [load, refreshKey]);

  return {
    ...state,
    pageIndex,
    next: () => load(pageIndex + 1),
    prev: () => load(Math.max(0, pageIndex - 1)),
    reload: () => {
      cache.current.clear();
      return load(0);
    },
  };
}
