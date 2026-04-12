import { useRef, useCallback, useEffect } from "react";

interface UseAutoScrollReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
}

export function useAutoScroll(dependency: unknown): UseAutoScrollReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      userScrolledUpRef.current = false;
    }
  }, []);

  // Detect user scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      userScrolledUpRef.current = distanceFromBottom > 100;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll when dependency changes (new messages / streaming)
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [dependency, scrollToBottom]);

  return { containerRef, scrollToBottom };
}
