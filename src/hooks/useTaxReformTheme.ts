import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const REFORM_ROUTE = "/reforma-tributaria";
const THEME_CLASS  = "reform-theme";
const TRANSITION_MS = 650;

function applyWithTransition(fn: () => void) {
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  fn();
  const timer = setTimeout(
    () => root.classList.remove("theme-transitioning"),
    TRANSITION_MS,
  );
  return timer;
}

export function useTaxReformTheme() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const timer = applyWithTransition(() => {
      if (pathname === REFORM_ROUTE) {
        root.classList.add(THEME_CLASS);
      } else {
        root.classList.remove(THEME_CLASS);
      }
    });
    return () => clearTimeout(timer);
  }, [pathname]);
}
