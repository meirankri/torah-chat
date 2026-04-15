import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoScroll } from "../use-auto-scroll";

describe("useAutoScroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne containerRef et scrollToBottom", () => {
    const { result } = renderHook(() => useAutoScroll("dep"));
    expect(result.current.containerRef).toBeDefined();
    expect(typeof result.current.scrollToBottom).toBe("function");
  });

  it("containerRef est null initialement", () => {
    const { result } = renderHook(() => useAutoScroll(null));
    expect(result.current.containerRef.current).toBeNull();
  });

  it("scrollToBottom ne plante pas si containerRef est null", () => {
    const { result } = renderHook(() => useAutoScroll("dep"));
    expect(() => act(() => result.current.scrollToBottom())).not.toThrow();
  });

  it("scrollToBottom met à jour scrollTop si le container existe", () => {
    const { result } = renderHook(() => useAutoScroll("dep"));

    // Simuler un container DOM
    const container = document.createElement("div");
    Object.defineProperty(container, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 400, configurable: true });
    container.scrollTop = 0;

    // Attacher le ref manuellement
    Object.defineProperty(result.current.containerRef, "current", {
      value: container,
      writable: true,
    });

    act(() => result.current.scrollToBottom());
    expect(container.scrollTop).toBe(1000);
  });
});
