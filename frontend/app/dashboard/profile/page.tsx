import { ProfilePanel } from "../../components/profile-panel";
import type { Metadata } from "next";
import "./profile.css";
export const metadata: Metadata = { title: "Your profile | Allied AutoTech" };
export default function Page() {
  return <ProfilePanel />;
}
