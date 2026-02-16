"use client";

import { memo, useState } from "react";
import { X, FileText } from "lucide-react";

interface Pillar {
  id: number;
  name: string;
  color: string;
}

interface PostFormProps {
  pillars: Pillar[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  initial?: Record<string, unknown>;
}

const POST_TYPES = ["text", "carousel", "image", "poll", "video", "article"];
const CTA_TYPES = ["none", "question", "link", "engagement-bait", "advice"];
const HOOK_STYLES = ["", "question", "contrarian", "story", "stat", "cliffhanger", "list", "statement"];

const PostForm = memo(function PostForm({
  pillars,
  onSubmit,
  onCancel,
  initial,
}: PostFormProps) {
  const initialAuthor = (initial?.author as string) || "me";
  const [authorMode, setAuthorMode] = useState<"me" | "other">(
    initialAuthor === "me" ? "me" : "other"
  );
  const [authorName, setAuthorName] = useState(
    initialAuthor === "me" ? "" : initialAuthor
  );
  const [form, setForm] = useState({
    author: initialAuthor,
    content: (initial?.content as string) || "",
    post_url: (initial?.post_url as string) || "",
    post_type: (initial?.post_type as string) || "text",
    cta_type: (initial?.cta_type as string) || "none",
    hook_line: (initial?.hook_line as string) || "",
    hook_style: (initial?.hook_style as string) || "",
    posted_at: (initial?.posted_at as string) || "",
    pillar_id: (initial?.pillar_id as number) || "",
    topic_tags: (initial?.topic_tags as string) || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        pillar_id: form.pillar_id || null,
        topic_tags: form.topic_tags
          ? form.topic_tags.split(",").map((t) => t.trim())
          : [],
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          {initial ? "Edit Post" : "Add Post"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Author
          </label>
          <select
            value={authorMode}
            onChange={(e) => {
              const mode = e.target.value as "me" | "other";
              setAuthorMode(mode);
              if (mode === "me") {
                setAuthorName("");
                setForm({ ...form, author: "me" });
              } else {
                setForm({ ...form, author: authorName || "other" });
              }
            }}
            className={inputClass}
          >
            <option value="me">Me</option>
            <option value="other">Other</option>
          </select>
          {authorMode === "other" && (
            <input
              type="text"
              placeholder="Person's name"
              value={authorName}
              onChange={(e) => {
                setAuthorName(e.target.value);
                setForm({ ...form, author: e.target.value || "other" });
              }}
              className={`${inputClass} mt-2`}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Post Type
          </label>
          <select
            value={form.post_type}
            onChange={(e) => setForm({ ...form, post_type: e.target.value })}
            className={inputClass}
          >
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={6}
          className={inputClass}
          placeholder="Paste the LinkedIn post content here..."
          required
        />
        <p className="text-xs text-gray-400 mt-1">
          {form.content.split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Hook Line
        </label>
        <input
          type="text"
          value={form.hook_line}
          onChange={(e) => setForm({ ...form, hook_line: e.target.value })}
          className={inputClass}
          placeholder="First line of the post"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hook Style
          </label>
          <select
            value={form.hook_style}
            onChange={(e) => setForm({ ...form, hook_style: e.target.value })}
            className={inputClass}
          >
            {HOOK_STYLES.map((s) => (
              <option key={s} value={s}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "No style"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CTA Type
          </label>
          <select
            value={form.cta_type}
            onChange={(e) => setForm({ ...form, cta_type: e.target.value })}
            className={inputClass}
          >
            {CTA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pillar
          </label>
          <select
            value={form.pillar_id}
            onChange={(e) =>
              setForm({
                ...form,
                pillar_id: e.target.value ? Number(e.target.value) : "",
              })
            }
            className={inputClass}
          >
            <option value="">No pillar</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Posted At
          </label>
          <input
            type="datetime-local"
            value={form.posted_at}
            onChange={(e) => setForm({ ...form, posted_at: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Post URL
        </label>
        <input
          type="url"
          value={form.post_url}
          onChange={(e) => setForm({ ...form, post_url: e.target.value })}
          className={inputClass}
          placeholder="https://linkedin.com/posts/..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Topic Tags (comma separated)
        </label>
        <input
          type="text"
          value={form.topic_tags}
          onChange={(e) => setForm({ ...form, topic_tags: e.target.value })}
          className={inputClass}
          placeholder="career, leadership, tech"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !form.content.trim()}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "Saving..." : initial ? "Update Post" : "Add Post"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
});

PostForm.displayName = "PostForm";
export default PostForm;
