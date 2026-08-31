import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { COL, watchUserCollection, type CollectionName } from "@/lib/db";
import type {
  Placement,
  Section,
  TableCell,
  TableColumn,
  TableRow,
  WorkItem,
  WorkSession,
  WorkTable,
} from "@/lib/types";

type Data = {
  sections: Section[];
  tables: WorkTable[];
  rows: TableRow[];
  columns: TableColumn[];
  cells: TableCell[];
  items: WorkItem[];
  placements: Placement[];
  sessions: WorkSession[];
};

type Store = Data & {
  userId: string | null;
  loading: boolean;
  error: string | null;
};

const EMPTY: Data = {
  sections: [],
  tables: [],
  rows: [],
  columns: [],
  cells: [],
  items: [],
  placements: [],
  sessions: [],
};

const StoreContext = createContext<Store | null>(null);

const SUBSCRIPTIONS: Array<[keyof Data, CollectionName]> = [
  ["sections", COL.sections],
  ["tables", COL.tables],
  ["rows", COL.rows],
  ["columns", COL.columns],
  ["cells", COL.cells],
  ["items", COL.items],
  ["placements", COL.placements],
  ["sessions", COL.workSessions],
];

/**
 * Realtime store: one user-scoped listener per collection. Everything the app
 * renders derives from this snapshot, so drag & drop writes reflect instantly
 * and survive refresh without extra reads.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(EMPTY);
    setReady(0);
    setError(null);
    if (!userId) return;

    let active = true;
    const unsubs: Array<() => void> = [];
    const seen = new Set<string>();

    for (const [key, name] of SUBSCRIPTIONS) {
      watchUserCollection<never>(
        name,
        userId,
        (rows) => {
          if (!active) return;
          setData((prev) => ({ ...prev, [key]: rows }));
          if (!seen.has(name)) {
            seen.add(name);
            setReady((n) => n + 1);
          }
        },
        (e) => {
          if (!active) return;
          setError(e instanceof Error ? e.message : "Could not load your data.");
        },
      )
        .then((u) => (active ? unsubs.push(u) : u()))
        .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    }

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [userId]);

  const value = useMemo<Store>(
    () => ({
      ...data,
      userId,
      loading: !!userId && ready < SUBSCRIPTIONS.length,
      error,
    }),
    [data, userId, ready, error],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useWorkspace(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
