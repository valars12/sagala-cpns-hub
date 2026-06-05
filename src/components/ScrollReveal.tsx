import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const revealSelector = "[data-reveal]";
const defaultDelayStepMs = 70;
const maxDelayMs = 350;

const normalizeDelay = (value: string) => {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}ms` : trimmed;
};

const ensureDelay = (element: HTMLElement, index: number) => {
  if (element.style.getPropertyValue("--reveal-delay")) return;

  if (element.dataset.revealDelay) {
    element.style.setProperty("--reveal-delay", normalizeDelay(element.dataset.revealDelay));
    return;
  }

  const delay = Math.min((index % 6) * defaultDelayStepMs, maxDelayMs);
  element.style.setProperty("--reveal-delay", `${delay}ms`);
};

const ScrollReveal = () => {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("js-ready");

    const observedElements = new Set<HTMLElement>();
    const supportsIntersectionObserver = "IntersectionObserver" in window;

    const observer = supportsIntersectionObserver
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-revealed");
              observer.unobserve(entry.target);
            });
          },
          {
            threshold: 0.16,
            rootMargin: "0px 0px -8% 0px",
          }
        )
      : null;

    const registerAllTargets = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(revealSelector));
      elements.forEach((element, index) => {
        ensureDelay(element, index);
        if (observedElements.has(element)) return;

        if (!supportsIntersectionObserver) {
          element.classList.add("is-revealed");
          observedElements.add(element);
          return;
        }

        observer?.observe(element);
        observedElements.add(element);
      });
    };

    registerAllTargets();

    let frameId = 0;
    const mutationObserver = new MutationObserver(() => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(registerAllTargets);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [location.pathname]);

  return null;
};

export default ScrollReveal;
