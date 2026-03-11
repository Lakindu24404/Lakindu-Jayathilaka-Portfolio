import type { Metadata } from "next";
import { ToastProvider } from "@/components/dashboard/Toast";
import "./dashboard.css";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · Dashboard",
  },
  // The dashboard is private; keep it out of search results entirely.
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dash">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
