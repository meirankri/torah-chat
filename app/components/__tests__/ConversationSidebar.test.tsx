import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConversationSidebar } from "../ConversationSidebar";

const mockConversations = [
  {
    id: "conv-1",
    userId: "user-1",
    title: "Torah question",
    archived: false,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "conv-2",
    userId: "user-1",
    title: "Talmud discussion",
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const defaultProps = {
  conversations: mockConversations,
  archivedConversations: [],
  activeConversationId: null,
  onSelectConversation: vi.fn(),
  onNewConversation: vi.fn(),
  onDeleteConversation: vi.fn(),
  onRenameConversation: vi.fn(),
  onArchiveConversation: vi.fn(),
  isOpen: true,
  onClose: vi.fn(),
};

describe("ConversationSidebar", () => {
  it("se monte correctement", () => {
    render(<ConversationSidebar {...defaultProps} />);
    expect(screen.getByRole("complementary")).toBeDefined();
  });

  it("affiche les conversations", () => {
    render(<ConversationSidebar {...defaultProps} />);
    expect(screen.getByText("Torah question")).toBeDefined();
    expect(screen.getByText("Talmud discussion")).toBeDefined();
  });

  it("affiche un message quand il n'y a pas de conversations", () => {
    render(<ConversationSidebar {...defaultProps} conversations={[]} />);
    expect(screen.getByText("Aucune conversation")).toBeDefined();
  });

  it("appelle onNewConversation au clic sur le bouton Nouvelle", () => {
    const onNew = vi.fn();
    render(<ConversationSidebar {...defaultProps} onNewConversation={onNew} />);
    fireEvent.click(screen.getByText("+ Nouvelle"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("appelle onSelectConversation au clic sur une conversation", () => {
    const onSelect = vi.fn();
    render(
      <ConversationSidebar {...defaultProps} onSelectConversation={onSelect} />
    );
    fireEvent.click(screen.getByText("Torah question"));
    expect(onSelect).toHaveBeenCalledWith("conv-1");
  });

  it("affiche la confirmation de suppression", () => {
    render(<ConversationSidebar {...defaultProps} />);
    // Hover to show delete button, then click
    const deleteButtons = screen.getAllByTitle("Supprimer");
    fireEvent.click(deleteButtons[0]!);
    expect(screen.getByText("Supprimer cette conversation ?")).toBeDefined();
  });

  it("active le mode édition inline", () => {
    render(<ConversationSidebar {...defaultProps} />);
    const renameButtons = screen.getAllByTitle("Renommer");
    fireEvent.click(renameButtons[0]!);
    const input = screen.getByDisplayValue("Torah question");
    expect(input).toBeDefined();
  });

  it("filtre les conversations par titre", () => {
    render(<ConversationSidebar {...defaultProps} />);
    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "Torah" } });
    expect(screen.getByText("Torah question")).toBeDefined();
    expect(screen.queryByText("Talmud discussion")).toBeNull();
  });

  it("filtre sans distinction de casse", () => {
    render(<ConversationSidebar {...defaultProps} />);
    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "talmud" } });
    expect(screen.getByText("Talmud discussion")).toBeDefined();
    expect(screen.queryByText("Torah question")).toBeNull();
  });

  it("n'affiche pas la recherche quand il n'y a pas de conversations", () => {
    render(<ConversationSidebar {...defaultProps} conversations={[]} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("appelle onArchiveConversation au clic sur le bouton archiver", () => {
    const onArchive = vi.fn();
    render(<ConversationSidebar {...defaultProps} onArchiveConversation={onArchive} />);
    const archiveButtons = screen.getAllByTitle("Archiver");
    fireEvent.click(archiveButtons[0]!);
    expect(onArchive).toHaveBeenCalledWith("conv-1", true);
  });

  it("affiche la section archives quand il y a des conversations archivées", () => {
    const archivedConvs = [
      {
        id: "conv-3",
        userId: "user-1",
        title: "Archived conversation",
        archived: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];
    render(<ConversationSidebar {...defaultProps} archivedConversations={archivedConvs} />);
    expect(screen.getByText(/Archives/)).toBeDefined();
  });
});
