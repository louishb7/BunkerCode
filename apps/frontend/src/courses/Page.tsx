import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router";

const scrollPositions = new Map<string, number>();

// Only a completed route moves focus; editing and preview changes stay untouched.
export function Page({
  title,
  ready = true,
  className,
  children,
}: {
  title: string;
  ready?: boolean;
  className: string;
  children: ReactNode;
}) {
  const main = useRef<HTMLElement>(null);
  const { key } = useLocation();
  const navigation = useNavigationType();
  useLayoutEffect(() => {
    document.title = `${title} · BunkerCode`;
    if (!ready) return;
    const heading = main.current?.querySelector("h1");
    if (heading) heading.tabIndex = -1;
    (heading ?? main.current)?.focus({ preventScroll: true });
    window.scrollTo(
      0,
      navigation === "POP" ? (scrollPositions.get(key) ?? 0) : 0,
    );
    const rememberScroll = () => scrollPositions.set(key, window.scrollY);
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, [key, navigation, ready, title]);
  return (
    <main id="main-content" tabIndex={-1} ref={main} className={className}>
      {children}
    </main>
  );
}

export function ScrollRestoration() {
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  return null;
}
