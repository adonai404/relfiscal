import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type Company } from "./useCompany";

const STORAGE_KEY = "fiscal.openTabs";

interface OpenTabsCtx {
  openTabs: Company[];
  openInTab: (company: Company) => void;
  closeTab: (companyId: string) => void;
  isTabOpen: (companyId: string) => boolean;
}

const Ctx = createContext<OpenTabsCtx>({
  openTabs: [],
  openInTab: () => {},
  closeTab: () => {},
  isTabOpen: () => false,
});

export function OpenTabsProvider({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = useState<Company[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs]);

  const openInTab = (company: Company) => {
    setOpenTabs((prev) => {
      if (prev.find((c) => c.id === company.id)) return prev;
      return [...prev, company];
    });
  };

  const closeTab = (companyId: string) => {
    setOpenTabs((prev) => prev.filter((c) => c.id !== companyId));
  };

  const isTabOpen = (companyId: string) => openTabs.some((c) => c.id === companyId);

  return (
    <Ctx.Provider value={{ openTabs, openInTab, closeTab, isTabOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export const useOpenTabs = () => useContext(Ctx);
