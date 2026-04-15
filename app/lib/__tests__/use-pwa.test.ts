import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePwa } from "../use-pwa";

// Default service worker mock (no-op register)
const swRegisterMock = vi.fn().mockResolvedValue({});

beforeEach(() => {
  swRegisterMock.mockClear();
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register: swRegisterMock },
    configurable: true,
    writable: true,
  });
  // Default: not installed (no standalone mode)
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockReturnValue({ matches: false }),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePwa", () => {
  it("retourne canInstall=false au montage (pas de beforeinstallprompt)", () => {
    const { result } = renderHook(() => usePwa());
    expect(result.current.canInstall).toBe(false);
  });

  it("retourne isInstalled=false en mode normal (pas standalone)", () => {
    const { result } = renderHook(() => usePwa());
    expect(result.current.isInstalled).toBe(false);
  });

  it("expose promptInstall comme fonction", () => {
    const { result } = renderHook(() => usePwa());
    expect(typeof result.current.promptInstall).toBe("function");
  });

  it("promptInstall ne plante pas si installPrompt est null", async () => {
    const { result } = renderHook(() => usePwa());
    await expect(result.current.promptInstall()).resolves.toBeUndefined();
  });

  it("isInstalled=true si display-mode standalone", () => {
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => usePwa());
    expect(result.current.isInstalled).toBe(true);
  });

  it("isInstalled=true après événement appinstalled", () => {
    const { result } = renderHook(() => usePwa());

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it("enregistre le service worker au montage", () => {
    renderHook(() => usePwa());
    expect(swRegisterMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });
});
