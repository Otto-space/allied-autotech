"use client";
import { createContext, useContext } from "react";
import type { StaffNotificationAccess } from "./destinations";
export const NotificationAccessContext = createContext<StaffNotificationAccess>({
  managed: true,
  links: [],
});
export const useNotificationAccess = () => useContext(NotificationAccessContext);
