import { useEffect, useRef, useState } from "react";

// IntersectionObserver, not a scroll listener -- fires once when the element
// enters the viewport and then disconnects, so it costs nothing on scroll.
export function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const threshold = options?.threshold ?? 0.2;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
