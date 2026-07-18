import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll to top whenever the route pathname changes.
 * Prevents new pages from appearing "blank" when the previous page was scrolled down.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    try { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }); }
    catch { window.scrollTo(0, 0); }
  }, [pathname]);
  return null;
}
