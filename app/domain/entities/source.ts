export type SourceType = "sefaria" | "custom" | "hebrewbooks" | "unverified";

export interface MessageSource {
  id: string;
  messageId: string;
  sourceType: SourceType;
  ref: string;
  title: string | null;
  textHebrew: string | null;
  textTranslation: string | null;
  translationLanguage: string | null;
  category: string | null;
  sefariaUrl: string | null;
  createdAt: string;
}
