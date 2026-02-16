"use client";

import { memo, useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Trash2,
  FileEdit,
  Eye,
  EyeOff,
  CalendarPlus,
  Send,
  ArrowRight,
} from "lucide-react";
import LinkedInPreview from "./LinkedInPreview";

interface Draft {
  id: number;
  topic: string;
  content: string;
  hook_variant: string | null;
  pillar_id: number | null;
  status: string;
  ai_model: string | null;
  created_at: string;
}

interface DraftEditorProps {
  draft: Draft;
  onUpdate: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => void;
  onSchedule?: (draft: Draft) => void;
  onPublish?: (draft: Draft) => void;
}

const LINKEDIN_CHAR_LIMIT = 3000;

const DraftEditor = memo(function DraftEditor({
  draft,
  onUpdate,
  onDelete,
  onSchedule,
  onPublish,
}: DraftEditorProps) {
  const [content, setContent] = useState(draft.content);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const hasChanges = content !== draft.content;
  const charCount = content.length;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charPct = Math.min(100, (charCount / LINKEDIN_CHAR_LIMIT) * 100);
  const isOverLimit = charCount > LINKEDIN_CHAR_LIMIT;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(draft.id, { content });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColors: Record<string, string> = {
    draft: "bg-amber-100 text-amber-700 border-amber-200",
    revised: "bg-blue-100 text-blue-700 border-blue-200",
    posted: "bg-green-100 text-green-700 border-green-200",
    discarded: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-gray-400" />
              {draft.topic}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-md font-medium border ${statusColors[draft.status] || "bg-gray-100 text-gray-600"}`}
              >
                {draft.status}
              </span>
              {draft.hook_variant && (
                <span className="text-xs text-gray-400">
                  Hook: {draft.hook_variant}
                </span>
              )}
              {draft.ai_model && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  {draft.ai_model}
                </span>
              )}
              <span className="text-xs text-gray-300">
                {new Date(draft.created_at).toLocaleDateString()}
              </span>
              {draft.status === "draft" && (
                <button
                  onClick={() => onUpdate(draft.id, { status: "revised" })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 ml-2"
                >
                  <ArrowRight className="w-3 h-3" />
                  Mark Revised
                </button>
              )}
              {(draft.status === "draft" || draft.status === "revised") && onPublish && (
                <button
                  onClick={() => onPublish(draft)}
                  className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-0.5 ml-2"
                >
                  <Send className="w-3 h-3" />
                  Mark Posted
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              title={showPreview ? "Hide preview" : "LinkedIn preview"}
            >
              {showPreview ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            {onSchedule && draft.status !== "posted" && draft.status !== "discarded" && (
              <button
                onClick={() => onSchedule(draft)}
                className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                title="Schedule to calendar"
              >
                <CalendarPlus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(draft.id)}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showPreview ? (
          <LinkedInPreview
            authorName="You"
            authorHeadline="Your headline"
            authorInitials="Y"
            content={content}
            timestamp="Just now"
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors leading-relaxed"
          />
        )}

        {/* Character counter & stats */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              {wordCount} words
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isOverLimit
                      ? "bg-red-500"
                      : charPct > 80
                        ? "bg-amber-500"
                        : "bg-indigo-500"
                  }`}
                  style={{ width: `${Math.min(100, charPct)}%` }}
                />
              </div>
              <span
                className={`text-xs font-medium ${
                  isOverLimit
                    ? "text-red-600"
                    : charPct > 80
                      ? "text-amber-600"
                      : "text-gray-400"
                }`}
              >
                {charCount}/{LINKEDIN_CHAR_LIMIT}
              </span>
            </div>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

DraftEditor.displayName = "DraftEditor";
export default DraftEditor;
