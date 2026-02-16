"use client";

import { memo, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Filter, FileText, Search, ArrowUpDown, Sparkles } from "lucide-react";
import PostForm from "../components/PostForm";
import PostCard from "../components/PostCard";
import MetricsForm from "../components/MetricsForm";

interface Post {
  id: number;
  author: string;
  content: string;
  post_url: string | null;
  post_type: string;
  hook_line: string | null;
  cta_type: string;
  word_count: number;
  posted_at: string | null;
  pillar_id: number | null;
  topic_tags: string;
}

interface Pillar {
  id: number;
  name: string;
  color: string;
}

interface Metrics {
  impressions: number;
  members_reached: number;
  profile_viewers: number;
  followers_gained: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  engagement_score: number;
  snapshot_type: string | null;
}

const PostsPage = memo(function PostsPage() {
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);

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

    // Batch fetch metrics for all posts at once
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
      } catch {
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

  const handleCreatePost = async (data: Record<string, unknown>) => {
    await fetch("/api/linkedin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
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
    await fetch(`/api/linkedin/posts/${editingPost.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
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
    const result = await res.json();
    setMetricsPostId(null);
    fetchPosts();
    if (result.analysis) {
      alert(
        `Metrics saved & auto-analyzed!\nClassification: ${result.analysis.classification}\nLearnings extracted: ${result.analysis.learnings_extracted}\nPlaybook updated: ${result.analysis.playbook_updated ? "Yes" : "No"}`
      );
    }
  };

  const handleAnalyze = async (postId: number) => {
    setAnalyzing(postId);
    try {
      const res = await fetch(`/api/linkedin/analyze/${postId}`, {
        method: "POST",
      });
      const data = await res.json();
      alert(
        `Analysis complete!\nClassification: ${data.classification}\nLearnings extracted: ${data.learnings_extracted}`
      );
    } catch {
      alert("Analysis failed. Make sure the post has metrics.");
    } finally {
      setAnalyzing(null);
    }
  };

  const handleBatchAnalyze = async () => {
    const postIds = posts.map((p) => p.id);
    if (postIds.length === 0) return;
    if (!confirm(`Analyze all ${postIds.length} posts with AI? This uses batch processing to minimize API calls.`)) return;
    setBatchAnalyzing(true);
    try {
      const res = await fetch("/api/linkedin/analyze/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postIds),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Batch analysis failed");
      }
      const data = await res.json();
      const results = data.results || [];
      const skipped = data.skipped || [];
      const hits = results.filter((r: { classification: string }) => r.classification === "hit").length;
      const misses = results.filter((r: { classification: string }) => r.classification === "miss").length;
      const avg = results.filter((r: { classification: string }) => r.classification === "average").length;
      const totalLearnings = results.reduce((sum: number, r: { learnings_extracted: number }) => sum + r.learnings_extracted, 0);
      const alreadyAnalyzed = skipped.filter((s: { reason: string }) => s.reason?.includes("Already analyzed")).length;
      const noMetrics = skipped.length - alreadyAnalyzed;
      alert(
        `Batch analysis complete!\n\nAnalyzed: ${results.length} posts\nHits: ${hits} | Average: ${avg} | Misses: ${misses}\nTotal learnings extracted: ${totalLearnings}${alreadyAnalyzed ? `\nSkipped (up to date): ${alreadyAnalyzed}` : ""}${noMetrics ? `\nSkipped (no metrics): ${noMetrics}` : ""}\nPlaybook updated: ${data.playbook_updated ? "Yes" : "No"}`
      );
    } catch {
      alert("Batch analysis failed. Make sure your posts have metrics.");
    } finally {
      setBatchAnalyzing(false);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`/api/linkedin/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete post. Please try again.");
        return;
      }
      fetchPosts();
    } catch {
      alert("Failed to delete post. Please try again.");
    }
  };

  const pillarMap = Object.fromEntries(pillars.map((p) => [p.id, p]));

  // Client-side search, type filter, and sorting
  const filteredPosts = posts
    .filter((post) => {
      if (filterType && post.post_type !== filterType) return false;
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
      if (sortBy === "date") {
        return (b.posted_at || "").localeCompare(a.posted_at || "");
      }
      if (sortBy === "engagement") {
        const engA = metricsMap[a.id]?.engagement_score || 0;
        const engB = metricsMap[b.id]?.engagement_score || 0;
        return engB - engA;
      }
      if (sortBy === "impressions") {
        const impA = metricsMap[a.id]?.impressions || 0;
        const impB = metricsMap[b.id]?.impressions || 0;
        return impB - impA;
      }
      if (sortBy === "comments") {
        const comA = metricsMap[a.id]?.comments || 0;
        const comB = metricsMap[b.id]?.comments || 0;
        return comB - comA;
      }
      return 0;
    });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post Library</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredPosts.length} of {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing || posts.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Analyze All
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Post
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts by content, tags, or hook..."
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white transition-colors"
          >
            <option value="">All authors</option>
            <option value="me">My posts</option>
            <option value="__others__">Others&apos; posts</option>
          </select>
          <select
            value={filterPillar}
            onChange={(e) => setFilterPillar(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white transition-colors"
          >
            <option value="">All pillars</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white transition-colors"
          >
            <option value="">All types</option>
            <option value="text">Text</option>
            <option value="carousel">Carousel</option>
            <option value="poll">Poll</option>
            <option value="video">Video</option>
            <option value="article">Article</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white transition-colors"
            >
              <option value="date">Sort by Date</option>
              <option value="engagement">Sort by Engagement</option>
              <option value="impressions">Sort by Impressions</option>
              <option value="comments">Sort by Comments</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Post Form */}
      {showForm && (
        <PostForm
          pillars={pillars}
          onSubmit={handleCreatePost}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit Post Form */}
      {editingPost && (
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
      )}

      {/* Metrics Form */}
      {metricsPostId && (
        <MetricsForm
          postId={metricsPostId}
          author={metricsPostAuthor}
          onSubmit={handleAddMetrics}
          onCancel={() => setMetricsPostId(null)}
        />
      )}

      {/* Post List */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No posts yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Add your first post to start tracking performance
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Post
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="relative group/link">
              <Link
                href={`/linkedin/posts/${post.id}`}
                className="absolute inset-0 z-0"
                aria-label={`View post #${post.id} details`}
              />
              <div className="relative z-10 pointer-events-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto">
                <PostCard
                  post={post}
                  pillarName={
                    post.pillar_id ? pillarMap[post.pillar_id]?.name : undefined
                  }
                  pillarColor={
                    post.pillar_id ? pillarMap[post.pillar_id]?.color : undefined
                  }
                  latestMetrics={metricsMap[post.id] || null}
                  onAddMetrics={(id) => {
                    setMetricsPostId(id);
                    setMetricsPostAuthor(post.author);
                  }}
                  onAnalyze={handleAnalyze}
                  onEdit={handleEditPost}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {(analyzing || batchAnalyzing) && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
            <span className="text-sm text-gray-700">
              {batchAnalyzing
                ? "Batch analyzing all posts with AI..."
                : "Analyzing post with AI..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

PostsPage.displayName = "PostsPage";
export default PostsPage;
