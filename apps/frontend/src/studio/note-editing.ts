import { createContext } from "react";

// Only tracks unapplied edits; lesson persistence remains owned by Studio.
export const NoteEditingContext = createContext<
  (id: string, pending: boolean) => void
>(() => {});
