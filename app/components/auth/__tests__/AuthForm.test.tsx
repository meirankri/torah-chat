import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "../AuthForm";

const FIELDS = [
  { name: "email", type: "email", label: "Email", placeholder: "email@test.com" },
  { name: "password", type: "password", label: "Password", placeholder: "***" },
];

describe("AuthForm", () => {
  it("se monte avec les champs", () => {
    render(<AuthForm fields={FIELDS} submitLabel="Submit" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("appelle onSubmit avec les données du formulaire", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<AuthForm fields={FIELDS} submitLabel="Submit" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "Password1");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        password: "Password1",
      })
    );
  });

  it("affiche les erreurs", () => {
    render(
      <AuthForm
        fields={FIELDS}
        submitLabel="Submit"
        onSubmit={vi.fn()}
        error="Invalid credentials"
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("désactive le bouton pendant le chargement", () => {
    render(
      <AuthForm
        fields={FIELDS}
        submitLabel="Submit"
        onSubmit={vi.fn()}
        loading={true}
      />
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
