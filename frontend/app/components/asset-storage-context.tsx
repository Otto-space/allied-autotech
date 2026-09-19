"use client";
import { createContext, useContext } from "react";
const AssetStorageContext = createContext<readonly string[]>([]);
export const useAssetStorageHosts = () => useContext(AssetStorageContext);
export function AssetStorageProvider({
  hosts,
  children,
}: {
  hosts: string[];
  children: React.ReactNode;
}) {
  return (
    <AssetStorageContext.Provider value={hosts}>{children}</AssetStorageContext.Provider>
  );
}
