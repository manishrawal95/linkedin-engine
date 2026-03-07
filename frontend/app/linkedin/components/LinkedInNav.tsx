"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Palette,
  PenTool,
  Calendar,
  Anchor,
  BookOpen,
  BarChart3,
  Hash,
  Users,
  Layers,
  Menu,
  Brain,
  Lightbulb,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/linkedin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/linkedin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/linkedin/posts", label: "Posts", icon: FileText },
      { href: "/linkedin/drafts", label: "Drafts", icon: PenTool },
      { href: "/linkedin/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/linkedin/mood-board", label: "Mood Board", icon: Palette },
      { href: "/linkedin/hooks-library", label: "Hooks", icon: Anchor },
      { href: "/linkedin/hashtags", label: "Hashtags", icon: Hash },
      { href: "/linkedin/series", label: "Series", icon: Layers },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/linkedin/profile", label: "Profile", icon: User },
      { href: "/linkedin/ideas", label: "Ideas", icon: Lightbulb },
      { href: "/linkedin/memory", label: "Memory", icon: Brain },
      { href: "/linkedin/competitors", label: "Competitors", icon: Users },
    ],
  },
];

const NavContent = memo(function NavContent({
  pathname,
  onLinkClick,
}: {
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-3 py-4 mb-4">
        <div className="p-1.5 bg-stone-900 rounded-xl">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-lg text-stone-900 tracking-tight">
          LI Planner
        </span>
      </div>
      <div className="space-y-5 flex-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/linkedin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-150 ${
                      isActive
                        ? "bg-stone-200/70 text-stone-900"
                        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                    }`}
                  >
                    <item.icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-stone-900" : "text-stone-400"
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 px-3 border-t border-stone-200/60">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] text-stone-400">Local · Personal</span>
        </div>
      </div>
    </>
  );
});

NavContent.displayName = "NavContent";

const LinkedInNav = memo(function LinkedInNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger — Sheet trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden fixed top-3 left-3 z-40 bg-white border-stone-200 text-stone-600 hover:bg-stone-50 shadow-sm rounded-xl"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 p-4 bg-[var(--color-bg-sidebar)] border-stone-200 flex flex-col"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <NavContent
            pathname={pathname}
            onLinkClick={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop fixed sidebar */}
      <nav
        className="hidden lg:flex w-56 bg-[var(--color-bg-sidebar)] border-r border-stone-200/60 min-h-screen p-4 flex-col shrink-0"
        aria-label="Desktop navigation"
      >
        <NavContent pathname={pathname} />
      </nav>
    </>
  );
});

LinkedInNav.displayName = "LinkedInNav";
export default LinkedInNav;
