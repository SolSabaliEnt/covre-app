function safeResetScrollTarget(target: Element | Window) {
  try {
    if (target === window) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }
    if (target instanceof HTMLElement) {
      target.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      target.scrollTop = 0;
      target.scrollLeft = 0;
    }
  } catch {
    // Ignore scroll reset failures on individual targets.
  }
}

function collectScrollTargets(): (Element | Window)[] {
  const seen = new Set<Element | Window>();
  const targets: (Element | Window)[] = [];

  const add = (el: Element | Window | null | undefined) => {
    if (el == null || seen.has(el)) return;
    seen.add(el);
    targets.push(el);
  };

  add(window);
  add(document.scrollingElement);
  add(document.documentElement);
  add(document.body);

  const selectors = [
    '[data-route-scroll-root="true"]',
    '[data-route-scroll-container="true"]',
    'main',
    '[role="main"]',
    '.overflow-y-auto',
    '.overflow-auto',
  ] as const;

  for (const selector of selectors) {
    document.querySelectorAll<HTMLElement>(selector).forEach(node => add(node));
  }

  return targets;
}

/** Immediate reset of every known route scroll surface (nav click fallback). */
export function resetRouteScrollNow(): void {
  for (const target of collectScrollTargets()) {
    safeResetScrollTarget(target);
  }
}

/** Repeated reset passes for post-navigation layout/paint timing. Returns cleanup. */
export function runRouteScrollResetPasses(): () => void {
  resetRouteScrollNow();

  queueMicrotask(() => resetRouteScrollNow());

  let rafId2: number | null = null;
  const rafId1 = requestAnimationFrame(() => {
    resetRouteScrollNow();
    rafId2 = requestAnimationFrame(() => resetRouteScrollNow());
  });

  const timeout50 = window.setTimeout(() => resetRouteScrollNow(), 50);
  const timeout150 = window.setTimeout(() => resetRouteScrollNow(), 150);

  return () => {
    cancelAnimationFrame(rafId1);
    if (rafId2 != null) {
      cancelAnimationFrame(rafId2);
    }
    clearTimeout(timeout50);
    clearTimeout(timeout150);
  };
}
