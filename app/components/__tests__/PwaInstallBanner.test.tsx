import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PwaInstallBanner } from "../PwaInstallBanner";

// Mock use-pwa to control canInstall / isInstalled / promptInstall
const mockUsePwa = vi.fn();

vi.mock("~/lib/use-pwa", () => ({
  usePwa: () => mockUsePwa(),
}));

describe("PwaInstallBanner", () => {
  beforeEach(() => {
    mockUsePwa.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      promptInstall: vi.fn(),
    });
  });

  it("ne s'affiche pas si canInstall=false", () => {
    render(<PwaInstallBanner />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ne s'affiche pas si isInstalled=true même avec canInstall=true", () => {
    mockUsePwa.mockReturnValue({
      canInstall: true,
      isInstalled: true,
      promptInstall: vi.fn(),
    });
    render(<PwaInstallBanner />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("s'affiche si canInstall=true et isInstalled=false", () => {
    mockUsePwa.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall: vi.fn(),
    });
    render(<PwaInstallBanner />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("appelle promptInstall au clic sur le bouton", () => {
    const promptInstall = vi.fn();
    mockUsePwa.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      promptInstall,
    });
    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByRole("button"));
    expect(promptInstall).toHaveBeenCalledOnce();
  });
});
