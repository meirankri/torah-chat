import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "~/domain/entities/conversation";

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  isDeleting: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onEditTitleChange: (v: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onArchive: () => void;
  archiveLabel: string;
  renameLabel: string;
  deleteLabel: string;
  deleteConfirmLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  defaultTitle: string;
  formatDate: (d: string) => string;
}

function ConversationItem({
  conv,
  isActive,
  isEditing,
  editTitle,
  isDeleting,
  onSelect,
  onStartRename,
  onEditTitleChange,
  onSubmitRename,
  onCancelRename,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onArchive,
  archiveLabel,
  renameLabel,
  deleteLabel,
  deleteConfirmLabel,
  confirmLabel,
  cancelLabel,
  defaultTitle,
  formatDate,
}: ConversationItemProps) {
  if (isDeleting) {
    return (
      <li>
        <div className="mx-2 my-1 rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950">
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">
            {deleteConfirmLabel}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onConfirmDelete}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancelDelete}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div
        className={`group mx-2 my-0.5 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors ${
          isActive
            ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
        onClick={onSelect}
      >
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onBlur={onSubmitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmitRename();
                if (e.key === "Escape") onCancelRename();
              }}
              className="w-full rounded border border-blue-300 bg-white px-1 py-0.5 text-sm dark:border-blue-600 dark:bg-gray-800"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <p className="truncate text-sm font-medium">
                {conv.title ?? defaultTitle}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(conv.updatedAt)}
              </p>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="ml-2 flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onStartRename(); }}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title={renameLabel}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              className="rounded p-1 text-gray-400 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400"
              title={archiveLabel}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              title={deleteLabel}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function useFormatRelativeDate() {
  const { t, i18n } = useTranslation();

  return (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMinutes < 1) return t("sidebar.relativeDate.now");
    if (diffMinutes < 60)
      return t("sidebar.relativeDate.minutesAgo", { count: diffMinutes });
    if (diffHours < 24)
      return t("sidebar.relativeDate.hoursAgo", { count: diffHours });
    if (diffDays === 1) return t("sidebar.relativeDate.yesterday");
    if (diffDays < 7)
      return t("sidebar.relativeDate.daysAgo", { count: diffDays });
    return date.toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
    });
  };
}

interface ConversationSidebarProps {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onArchiveConversation: (id: string, archived: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationSidebar({
  conversations,
  archivedConversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onArchiveConversation,
  isOpen,
  onClose,
}: ConversationSidebarProps) {
  const { t } = useTranslation();
  const formatRelativeDate = useFormatRelativeDate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [archivesOpen, setArchivesOpen] = useState(false);

  const startRename = useCallback((conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title ?? "");
  }, []);

  const submitRename = () => {
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const confirmDelete = (id: string) => {
    onDeleteConversation(id);
    setDeletingId(null);
  };

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        (c.title ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-gray-200 bg-gray-50 transition-transform duration-200 dark:border-gray-700 dark:bg-gray-900 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* New conversation button */}
        <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("sidebar.conversations")}
          </h2>
          <button
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {t("sidebar.newConversation")}
          </button>
        </div>

        {/* Search */}
        {conversations.length > 0 && (
          <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("sidebar.searchPlaceholder")}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-400">
              {searchQuery.trim()
                ? t("sidebar.noSearchResults")
                : t("sidebar.noConversations")}
            </p>
          ) : (
            <ul className="py-1">
              {filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={activeConversationId === conv.id}
                  isEditing={editingId === conv.id}
                  editTitle={editTitle}
                  isDeleting={deletingId === conv.id}
                  onSelect={() => { onSelectConversation(conv.id); onClose(); }}
                  onStartRename={() => startRename(conv)}
                  onEditTitleChange={(v) => setEditTitle(v)}
                  onSubmitRename={submitRename}
                  onCancelRename={() => setEditingId(null)}
                  onRequestDelete={() => setDeletingId(conv.id)}
                  onConfirmDelete={() => confirmDelete(conv.id)}
                  onCancelDelete={() => setDeletingId(null)}
                  onArchive={() => onArchiveConversation(conv.id, true)}
                  archiveLabel={t("sidebar.archiveConversation")}
                  renameLabel={t("common.rename")}
                  deleteLabel={t("common.delete")}
                  deleteConfirmLabel={t("sidebar.deleteConfirm")}
                  confirmLabel={t("common.delete")}
                  cancelLabel={t("common.cancel")}
                  defaultTitle={t("sidebar.defaultTitle")}
                  formatDate={formatRelativeDate}
                />
              ))}
            </ul>
          )}

          {/* Archives section */}
          {archivedConversations.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setArchivesOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <span>{t("sidebar.archives")} ({archivedConversations.length})</span>
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${archivesOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {archivesOpen && (
                <ul className="pb-1">
                  {archivedConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={activeConversationId === conv.id}
                      isEditing={editingId === conv.id}
                      editTitle={editTitle}
                      isDeleting={deletingId === conv.id}
                      onSelect={() => { onSelectConversation(conv.id); onClose(); }}
                      onStartRename={() => startRename(conv)}
                      onEditTitleChange={(v) => setEditTitle(v)}
                      onSubmitRename={submitRename}
                      onCancelRename={() => setEditingId(null)}
                      onRequestDelete={() => setDeletingId(conv.id)}
                      onConfirmDelete={() => confirmDelete(conv.id)}
                      onCancelDelete={() => setDeletingId(null)}
                      onArchive={() => onArchiveConversation(conv.id, false)}
                      archiveLabel={t("sidebar.unarchiveConversation")}
                      renameLabel={t("common.rename")}
                      deleteLabel={t("common.delete")}
                      deleteConfirmLabel={t("sidebar.deleteConfirm")}
                      confirmLabel={t("common.delete")}
                      cancelLabel={t("common.cancel")}
                      defaultTitle={t("sidebar.defaultTitle")}
                      formatDate={formatRelativeDate}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
