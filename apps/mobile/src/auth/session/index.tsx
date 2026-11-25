import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateCache } from "../../api/queries";
import { secureStorage } from "../secure-storage";

// No auth yet: backend is cookie-only, requires trusted Origin and CSRF for
// writes, and has no Bearer path. Native transport is undecided; the candidate
// in the ADR is unapproved. Native auth needs separate backend work (18.3/G06).
export type SessionState = {
  status: "signed_out";
  sessionGeneration: number;
  signOut(): Promise<void>;
};
const Context = createContext<SessionState | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [sessionGeneration, setGeneration] = useState(0);
  const client = useQueryClient();
  const signOut = async () => {
    try {
      await secureStorage.clearAll();
    } finally {
      await clearPrivateCache(client);
      setGeneration((generation) => generation + 1);
    }
  };
  return (
    <Context.Provider value={{ status: "signed_out", sessionGeneration, signOut }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is required");
  return value;
}
