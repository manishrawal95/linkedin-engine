"use client";

import { memo, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Filter, FileText, Search, ArrowUpDown, BarChart3, Upload } from "lucide-react";
import PostForm from "../components/PostForm";
import PostCard from "../components/PostCard";
import MetricsForm from "../components/MetricsForm";
import { useToast } from "../components/Toast";
import { useBackgroundTask } from "@/hooks/use-background-task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Post, Pillar, Metrics } from "@/types/linkedin";

const selectClass =
  "flex-1 sm:flex-none w-full sm:w-auto border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-colors";

const PostsPage = memo(function PostsPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [metricsMap, setMetricsMap] = useState<Record<number, Metrics>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [metricsPostId, setMetricsPostId] = useState<number | null>(null);
  const [metricsPostAuthor, setMetricsPostAuthor] = useState<string>("me");
  const [filterAuthor, setFilterAuthor] = useState<string>("");
  const [filterPillar, setFilterPillar] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterClassification, setFilterClassification] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterAuthor && filterAuthor !== "__others__") params.set("author", filterAuthor);
    if (filterPillar) params.set("pillar_id", filterPillar);
    const res = await fetch(`/api/linkedin/posts?${params}`);
    const data = await res.json();
    let postsList = data.posts || [];
    if (filterAuthor === "__others__") {
      postsList = postsList.filter((p: Post) => p.author !== "me");
    }
    setPosts(postsList);

    if (postsList.length > 0) {
      try {
        const ids = postsList.map((p: Post) => p.id).join(",");
        const mRes = await fetch(`/api/linkedin/posts/batch-metrics?post_ids=${ids}`);
        const mData = await mRes.json();
        const metrics: Record<number, Metrics> = {};
        for (const [postId, m] of Object.entries(mData.metrics || {})) {
          metrics[Number(postId)] = m as Metrics;
        }
        setMetricsMap(metrics);
      } catch (err) {
        console.error("PostsPage.fetchPosts: batch-metrics fetch failed:", err);
        setMetricsMap({});
      }
    }
  }, [filterAuthor, filterPillar]);

  const fetchPillars = useCallback(async () => {
    const res = await fetch("/api/linkedin/pillars");
    const data = await res.json();
    setPillars(data.pillars || []);
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchPillars();
  }, [fetchPosts, fetchPillars]);

  const { running: analyzing, launch: launchAnalyze } = useBackgroundTask({
    key: "post_analyze",
    onDone: () => fetchPosts(),
    successMessage: "Post analysis complete",
  });

  const { running: batchAnalyzing, launch: launchBatchAnalyze } = useBackgroundTask({
    key: "batch_analyze",
    onDone: () => fetchPosts(),
    successMessage: "Batch analysis complete",
  });

  const handleCreatePost = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/linkedin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error("Failed to save post. Please try again.");
      throw new Error("Failed to create post");
    }
    setShowForm(false);
    fetchPosts();
  };

  const handleEditPost = (postId: number) => {
    const post = posts.find((p) => p.id === postId);
    if (post) {
      setEditingPost(post);
      setShowForm(false);
    }
  };

  const handleUpdatePost = async (data: Record<string, unknown>) => {
    if (!editingPost) return;
    const res = await fetch(`/api/linkedin/posts/${editingPost.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error("Failed to update post. Please try again.");
      throw new Error("Failed to update post");
    }
    setEditingPost(null);
    fetchPosts();
  };

  const handleAddMetrics = async (
    postId: number,
    data: Record<string, number>
  ) => {
    const res = await fetch(`/api/linkedin/posts/${postId}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error("Failed to save metrics. Please try again.");
      return;
    }
    setMetricsPostId(null);
    fetchPosts();
    toast.success("Metrics saved — AI analysis running in background.");
  };

  const handleAnalyze = useCallback((postId: number) => {
    launchAnalyze(
      `/api/linkedin/analyze/${postId}`,
      { method: "POST" },
      "Analyzing post — you can navigate away safely"
    );
  }, [launchAnalyze]);

  const handleBatchAnalyze = useCallback(() => {
    if (posts.length === 0) return;
    launchBatchAnalyze(
      "/api/linkedin/analyze/batch?force=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(posts.map((p) => p.id)),
      },
      `Analyzing ${posts.length} posts — you can navigate away safely`
    );
  }, [posts, launchBatchAnalyze]);

  const handleImportMetrics = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    const allowedTypes = [".csv", ".xlsx", ".xls"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowedTypes.includes(ext)) {
      toast.error(`Unsupported file type: ${ext}. Please upload a .csv or .xlsx file.`);
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/linkedin/posts/import-metrics", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
        toast.error(`Import failed: ${detail}`);
        return;
      }

      const data = await res.json();
      const sheets = (data.sheets_processed as string[]) ?? [];
      const topPosts = data.top_posts as { matched?: number; created?: number; total_posts?: number } | undefined;
      const engagement = data.engagement as { days?: number } | undefined;
      const followers = data.followers as { total_followers?: number; days?: number } | undefined;
      const demographics = data.demographics as { entries?: number } | undefined;

      const parts: string[] = [];
      if (topPosts?.total_posts) {
        parts.push(`${topPosts.total_posts} posts (${topPosts.matched ?? 0} matched, ${topPosts.created ?? 0} new)`);
      }
      if (engagement?.days) parts.push(`${engagement.days} days of engagement`);
      if (followers?.total_followers) parts.push(`${followers.total_followers} followers`);
      if (demographics?.entries) parts.push(`${demographics.entries} demographics`);

      if (parts.length > 0) {
        toast.success(`Imported: ${parts.join(", ")}`);
        fetchPosts();
      } else if (sheets.length === 0) {
        toast.error("No recognized sheets found. Upload a LinkedIn Creator Analytics .xlsx export.");
      } else {
        toast.success(`Import complete: ${sheets.length} sheets processed`);
        fetchPosts();
      }
    } catch (err) {
      console.error("PostsPage.handleImportMetrics: POST /api/linkedin/posts/import-metrics failed:", err);
      toast.error("Failed to import metrics. Is the backend running?");
    } finally {
      setImporting(false);
    }
  }, [toast, fetchPosts]);

  const handleDelete = async (postId: number) => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/linkedin/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete post. Please try again.");
        return;
      }
      fetchPosts();
    } catch (err) {
      console.error("PostsPage.handleDelete: DELETE /api/linkedin/posts/:id failed:", err);
      toast.error("Failed to delete post. Please try again.");
    }
  };

  const pillarMap = Object.fromEntries(pillars.map((p) => [p.id, p]));

  const filteredPosts = posts
    .filter((post) => {
      if (filterType && post.post_type !== filterType) return false;
      if (filterClassification && post.classification !== filterClassification) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const tags = (() => { try { return JSON.parse(post.topic_tags || "[]"); } catch { return []; } })();
        const matchesContent = post.content.toLowerCase().includes(q);
        const matchesTags = tags.some((t: string) => t.toLowerCase().includes(q));
        const matchesHook = post.hook_line?.toLowerCase().includes(q);
        if (!matchesContent && !matchesTags && !matchesHook) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") return (b.posted_at || "").localeCompare(a.posted_at || "");
      if (sortBy === "engagement") return (metricsMap[b.id]?.engagement_score || 0) - (metricsMap[a.id]?.engagement_score || 0);
      if (sortBy === "impressions") return (metricsMap[b.id]?.impressions || 0) - (metricsMap[a.id]?.impressions || 0);
      if (sortBy === "comments") return (metricsMap[b.id]?.comments || 0) - (metricsMap[a.id]?.comments || 0);
      if (sortBy === "saves") return (metricsMap[b.id]?.saves || 0) - (metricsMap[a.id]?.saves || 0);
      return 0;
    });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Post Library</h1>
          <p className="text-sm text-stone-500 mt-1">
            {filteredPosts.length} of {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportMetrics}
            className="hidden"
            aria-label="Import metrics file"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="gap-2 rounded-xl border-stone-200"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Metrics</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing || posts.length === 0}
            className="gap-2 rounded-xl border-stone-200"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analyze All</span>
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2 rounded-xl active:scale-[0.98] transition-all">
            <Plus className="w-4 h-4" />
            Add Post
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-stone-200/60 px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts by content, tags, or hook..."
            className="pl-10 rounded-xl border-stone-200 focus-visible:ring-stone-400"
          />
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <select value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)} className={selectClass}>
            <option value="">All authors</option>
            <option value="me">My posts</option>
            <option value="__others__">Others&apos; posts</option>
          </select>
          <select value={filterPillar} onChange={(e) => setFilterPillar(e.target.value)} className={selectClass}>
            <option value="">All pillars</option>
            {pillars.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectClass}>
            <option value="">All types</option>
            <option value="text">Text</option>
            <option value="carousel">Carousel</option>
            <option value="personal image">Personal Image</option>
            <option value="social proof image">Social Proof Image</option>
            <option value="poll">Poll</option>
            <option value="video">Video</option>
            <option value="article">Article</option>
          </select>
          <select value={filterClassification} onChange={(e) => setFilterClassification(e.target.value)} className={selectClass}>
            <option value="">All results</option>
            <option value="hit">Hit</option>
            <option value="average">Average</option>
            <option value="miss">Miss</option>
          </select>
          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-stone-400 shrink-0" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass}>
              <option value="date">Sort by Date</option>
              <option value="engagement">Sort by Engagement</option>
              <option value="impressions">Sort by Impressions</option>
              <option value="comments">Sort by Comments</option>
              <option value="saves">Sort by Saves</option>
            </select>
          </div>
        </div>
      </div>

      {showForm && <PostForm pillars={pillars} onSubmit={handleCreatePost} onCancel={() => setShowForm(false)} />}

      {/* Post List */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200/60">
            <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-stone-400" />
            </div>
            <p className="text-base font-semibold text-stone-800">
              {searchQuery || filterType || filterClassification ? "No matching posts" : "No posts yet"}
            </p>
            <p className="text-sm text-stone-400 mt-1 max-w-xs mx-auto">
              {searchQuery || filterType || filterClassification
                ? "Try adjusting your filters or search query"
                : "Log your LinkedIn posts to start tracking performance and getting AI insights"}
            </p>
            {!searchQuery && !filterType && !filterClassification && (
              <Button onClick={() => setShowForm(true)} className="mt-5 gap-2 rounded-xl active:scale-[0.98] transition-all">
                <Plus className="w-4 h-4" />
                Add Post
              </Button>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id}>
              {editingPost?.id === post.id ? (
                <PostForm
                  pillars={pillars}
                  onSubmit={handleUpdatePost}
                  onCancel={() => setEditingPost(null)}
                  initial={{
                    author: editingPost.author,
                    content: editingPost.content,
                    post_url: editingPost.post_url || "",
                    post_type: editingPost.post_type,
                    cta_type: editingPost.cta_type,
                    hook_line: editingPost.hook_line || "",
                    hook_style: editingPost.hook_style || "",
                    posted_at: editingPost.posted_at || "",
                    pillar_id: editingPost.pillar_id,
                    topic_tags: (() => { try { return JSON.parse(editingPost.topic_tags || "[]").join(", "); } catch { return ""; } })(),
                  }}
                />
              ) : (
                <>
                  <div className="relative group/link">
                    <Link href={`/linkedin/posts/${post.id}`} className="absolute inset-0 z-0" aria-label={`View post #${post.id} details`} />
                    <div className="relative z-10 pointer-events-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto">
                      <PostCard
                        post={post}
                        pillarName={post.pillar_id ? pillarMap[post.pillar_id]?.name : undefined}
                        pillarColor={post.pillar_id ? pillarMap[post.pillar_id]?.color : undefined}
                        latestMetrics={metricsMap[post.id] || null}
                        onAddMetrics={(id) => { setMetricsPostId(id); setMetricsPostAuthor(post.author); }}
                        onAnalyze={handleAnalyze}
                        onEdit={handleEditPost}
                        onDelete={handleDelete}
                      />
                    </div>
                  </div>
                  {metricsPostId === post.id && (
                    <MetricsForm postId={metricsPostId} author={metricsPostAuthor} initialMetrics={metricsMap[post.id] ?? undefined} onSubmit={handleAddMetrics} onCancel={() => setMetricsPostId(null)} />
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {(analyzing || batchAnalyzing || importing) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-stone-900 text-white rounded-xl px-5 py-3 flex items-center gap-3 shadow-2xl">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
            <span className="text-sm font-medium">
              {importing
                ? "Importing metrics..."
                : batchAnalyzing
                  ? `Analyzing ${posts.length} posts with AI...`
                  : "Analyzing post..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

PostsPage.displayName = "PostsPage";
export default PostsPage;
