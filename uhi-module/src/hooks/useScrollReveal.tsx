import { useEffect, useRef, useState } from "react";

export const useScrollReveal = () => {

  const elementRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {

    const observer = new IntersectionObserver(
      ([entry]) => {

        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }

      },
      {
        root: null,
        // Reveal earlier, hide later → prevents flicker
        rootMargin: "-10% 0px -10% 0px",
        threshold: 0,
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };

  }, []);

  return { elementRef, isVisible };
};
