import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reads ?highlight=<id> from the URL and scrolls/flashes the matching element.
 * Pages that want to be linkable from notifications should render an element
 * with `data-notif-id="<id>"` (or `id="notif-<id>"`).
 */
const HIGHLIGHT_CLASS = "notif-highlight-ring";

const NotificationHighlightScroller = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("highlight");
    if (!id) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // ~6s

    const tryScroll = () => {
      if (cancelled) return;
      const el =
        (document.querySelector(`[data-notif-id="${CSS.escape(id)}"]`) as HTMLElement | null) ||
        (document.getElementById(`notif-${id}`) as HTMLElement | null);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(HIGHLIGHT_CLASS);
        setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 2600);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) setTimeout(tryScroll, 200);
    };
    // wait for content to render
    setTimeout(tryScroll, 150);

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return null;
};

export default NotificationHighlightScroller;
