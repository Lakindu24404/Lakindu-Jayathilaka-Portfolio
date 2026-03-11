"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/dashboard/actions";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/stack", label: "Stack Orbit", icon: "orbit" },
  { href: "/dashboard/projects", label: "Projects", icon: "layers" },
] as const;

function Icon({ name }: { name: (typeof LINKS)[number]["icon"] | "external" }) {
  const common = {
    className: "dashNavIcon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "orbit":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <ellipse cx="12" cy="12" rx="9" ry="4.5" />
          <ellipse cx="12" cy="12" rx="4.5" ry="9" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 14 9 5 9-5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M14 4h6v6" />
          <path d="M20 4 10 14" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      );
  }
}

function NavLinks() {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const isCurrent = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <div className="dashNav">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="dashNavLink"
            aria-current={isCurrent(link.href) ? "page" : undefined}
          >
            <Icon name={link.icon} />
            {link.label}
          </Link>
        ))}
      </div>

      <div className="dashNavGroup">
        <a
          href="/"
          className="dashNavLink"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="external" />
          View Portfolio
        </a>
        <button
          type="button"
          className="dashNavLink"
          disabled={pending}
          onClick={() => startTransition(() => void signOut())}
        >
          <svg
            className="dashNavIcon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 17l5-5-5-5" />
            <path d="M20 12H9" />
            <path d="M12 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
          </svg>
          {pending ? "Signing out…" : "Log out"}
        </button>
      </div>
    </>
  );
}

export function DashboardSidebar({ email }: { email: string }) {
  return (
    <aside className="dashSidebar">
      <div className="dashBrand">
        <span className="dashBrandMark">Lakindu</span>
        <span className="dashBrandNote">Portfolio admin</span>
      </div>
      <NavLinks />
      <p className="dashHint" style={{ paddingInline: 10 }}>
        Signed in as {email}
      </p>
    </aside>
  );
}

export function DashboardTopbar() {
  return (
    <nav className="dashTopbar" aria-label="Dashboard">
      <NavLinks />
    </nav>
  );
}
