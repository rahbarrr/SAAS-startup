"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
}

export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/stores", label: "Stores" },
  { href: "/trips", label: "Field Trips" },
  { href: "/visits", label: "Store Visits" },
  { href: "/approvals", label: "Approvals" },
  { href: "/notifications", label: "Notifications" },
  { href: "/team", label: "Organization Team" },
];

export function NavLinks(): ReactNode {
  const pathname = usePathname();

  return (
    <ul className="nav-list">
      {PRIMARY_NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="nav-link"
              aria-current={isActive ? "page" : undefined}
            >
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
