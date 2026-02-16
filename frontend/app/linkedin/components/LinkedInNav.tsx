"use client";

import { memo } from "react";
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
} from "lucide-react";

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
      { href: "/linkedin/competitors", label: "Competitors", icon: Users },
    ],
  },
];

const LinkedInNav = memo(function LinkedInNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col shrink-0">
      <div className="flex items-center gap-2.5 px-3 py-4 mb-4">
        <div className="p-1.5 bg-indigo-600 rounded-lg">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-gray-900 tracking-tight">LI Planner</span>
      </div>
      <div className="space-y-5 flex-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-1.5">
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
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : ""}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4 px-3 border-t border-gray-100">
        <div className="text-[10px] text-gray-400 leading-relaxed">
          LinkedIn Post Planner<br />
          Local AI-powered system
        </div>
      </div>
    </nav>
  );
});

LinkedInNav.displayName = "LinkedInNav";
export default LinkedInNav;
