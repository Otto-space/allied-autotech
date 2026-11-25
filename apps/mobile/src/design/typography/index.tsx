import { createContext, useContext, type PropsWithChildren } from "react";
import {
  useFonts,
  Quicksand_400Regular,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";
const FontContext = createContext(false);
export function TypographyProvider({ children }: PropsWithChildren) {
  const [loaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });
  // Bundled fonts; system fallback remains usable while loading or on failure.
  return <FontContext.Provider value={loaded}>{children}</FontContext.Provider>;
}
export const useBrandFonts = () => useContext(FontContext);
