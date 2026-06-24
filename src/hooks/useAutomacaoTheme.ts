import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const AUTOMACAO_ROUTE = "/automacoes";
const THEME_CLASS     = "automacao-theme";
const TRANSITION_MS   = 650;

export function useAutomacaoTheme() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;

    root.classList.add("theme-transitioning");
    if (pathname === AUTOMACAO_ROUTE) {
      root.classList.add(THEME_CLASS);
    } else {
      root.classList.remove(THEME_CLASS);
    }

    const timer = setTimeout(
      () => root.classList.remove("theme-transitioning"),
      TRANSITION_MS,
    );
    return () => {
      clearTimeout(timer);
      root.classList.remove(THEME_CLASS);
    };
  }, [pathname]);
}
