import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const KNOWLEDGE_ROUTE = "/conhecimento";
const THEME_CLASS = "knowledge-theme";
const TRANSITION_CLASS = "theme-transitioning";
const TRANSITION_MS = 650;

function applyWithTransition(fn: () => void) {
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  fn();
  const timer = setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
  return timer;
}

export function useKnowledgeTheme() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const timer = applyWithTransition(() => {
      if (pathname === KNOWLEDGE_ROUTE) {
        root.classList.add(THEME_CLASS);
      } else {
        root.classList.remove(THEME_CLASS);
      }
    });
    return () => clearTimeout(timer);
  }, [pathname]);
}
