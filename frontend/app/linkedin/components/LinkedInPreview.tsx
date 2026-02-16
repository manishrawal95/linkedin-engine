"use client";

import { useState } from "react";
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  Globe,
} from "lucide-react";

interface LinkedInPreviewProps {
  authorName: string;
  authorHeadline?: string;
  authorInitials?: string;
  content: string;
  timestamp?: string;
}

const TRUNCATE_LIMIT = 140;

function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const lastSpace = text.lastIndexOf(" ", limit);
  return lastSpace > 0 ? text.slice(0, lastSpace) : text.slice(0, limit);
}

export default function LinkedInPreview({
  authorName,
  authorHeadline,
  authorInitials,
  content,
  timestamp = "Just now",
}: LinkedInPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = content.length > TRUNCATE_LIMIT;
  const displayContent =
    expanded || !needsTruncation ? content : truncateAtWord(content, TRUNCATE_LIMIT);

  return (
    <div className="max-w-[555px] bg-white border border-[#e0e0e0] rounded-lg">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {authorInitials || authorName.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#191919] leading-tight">
            {authorName}
          </p>
          {authorHeadline && (
            <p className="text-[12px] text-gray-500 leading-tight mt-0.5 truncate">
              {authorHeadline}
            </p>
          )}
          <p className="text-[12px] text-gray-500 leading-tight mt-0.5 flex items-center gap-1">
            {timestamp} <Globe className="w-3 h-3" />
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-sm leading-[1.35] text-[#191919] whitespace-pre-wrap">
          {displayContent}
          {needsTruncation && !expanded && (
            <>
              <span className="text-gray-500">...</span>
              <button
                onClick={() => setExpanded(true)}
                className="text-gray-500 text-sm ml-0.5 hover:underline"
              >
                more
              </button>
            </>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-[#e0e0e0] mx-4" />

      {/* Action bar */}
      <div className="flex justify-between px-4">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageSquare, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#666] hover:bg-[#f0f0f0] rounded-sm py-3 px-3 transition-colors"
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
