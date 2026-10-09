import { startTransition } from "react";

type AppRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
};

/**
 * Local-first navigations should keep the current screen on stage until the
 * next one is ready, then crossfade. Root `loading.tsx` skeletons are for
 * server-fetched routes — they make this PWA flash a fake page mid-gesture.
 */
export function navigate(
  router: AppRouter,
  href: string,
  opts?: { replace?: boolean },
) {
  const go = () => {
    startTransition(() => {
      if (opts?.replace) router.replace(href);
      else router.push(href);
    });
  };

  const doc = document as Document & {
    startViewTransition?: (update: () => void) => unknown;
  };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(go);
  } else {
    go();
  }
}

export function back(router: AppRouter) {
  const go = () => startTransition(() => router.back());
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => unknown;
  };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(go);
  } else {
    go();
  }
}
