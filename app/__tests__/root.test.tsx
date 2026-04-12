import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-router", () => ({
  isRouteErrorResponse: (error: unknown): error is { status: number; statusText: string } => {
    return (
      error != null &&
      typeof error === "object" &&
      "status" in error &&
      "statusText" in error
    );
  },
  Links: () => null,
  Meta: () => null,
  Outlet: () => <div data-testid="outlet" />,
  Scripts: () => null,
  ScrollRestoration: () => null,
}));

import App, { ErrorBoundary } from "../root";

describe("App", () => {
  it("se monte sans erreur", () => {
    const { container } = render(<App />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe("ErrorBoundary", () => {
  it("se monte avec une erreur route sans crasher", () => {
    const error = { status: 404, statusText: "Not Found", data: null, internal: false };
    const { container } = render(<ErrorBoundary error={error} params={{}} />);
    expect(container.querySelector("main")).not.toBeNull();
  });

  it("se monte avec une erreur JS sans crasher", () => {
    const error = new Error("test error");
    const { container } = render(<ErrorBoundary error={error} params={{}} />);
    expect(container.querySelector("main")).not.toBeNull();
  });
});
