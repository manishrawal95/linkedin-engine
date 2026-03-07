"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { useBackgroundTask } from "@/hooks/use-background-task";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import type { StrategyReviewResponse } from "@/types/linkedin";

function healthColor(score: number): string {
  if (score >= 7) return "text-emerald-700 bg-emerald-50 border-emerald-200/60";
  if (score >= 5) return "text-amber-700 bg-amber-50 border-amber-200/60";
  return "text-red-700 bg-red-50 border-red-200/60";
}

function verdictColor(verdict: string): string {
  if (verdict === "Invest") return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  if (verdict === "Retire") return "bg-red-50 text-red-600 border-red-200/60";
  return "bg-stone-100 text-stone-600 border-stone-200/60";
}

const StrategyReviewCard = memo(function StrategyReviewCard() {
  const [data, setData] = useState<StrategyReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const parseReview = useCallback((json: Record<string, unknown>) => {
    const review = json.review as StrategyReviewResponse["review"];
    if (review) {
      setData({
        health_score: (json.health_score as number) ?? review.health_score,
        diagnosis: (json.diagnosis as string) ?? review.diagnosis,
        review,
        metrics: json.metrics as StrategyReviewResponse["metrics"],
        created_at: json.created_at as string,
      });
    }
  }, []);

  const fetchReview = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/strategy/review");
      const json = await res.json();
      parseReview(json);
    } catch (err) {
      console.error("StrategyReviewCard: fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [parseReview]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  const { running: refreshing, launch: launchRefresh } = useBackgroundTask({
    key: "strategy_review",
    onDone: () => fetchReview(),
    successMessage: "Strategy review updated",
  });

  const handleRefresh = useCallback(() => {
    launchRefresh(
      "/api/linkedin/strategy/review",
      { method: "POST" },
      "Running strategy review — you can navigate away safely"
    );
  }, [launchRefresh]);

  if (loading) {
    return (
      <SectionCard title="Strategy Review" icon={Activity}>
        <div className="h-32 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-400" />
        </div>
      </SectionCard>
    );
  }

  if (!data) {
    return (
      <SectionCard title="Strategy Review" icon={Activity}>
        <div className="text-center py-8">
          <Activity className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500 mb-1">No strategy review yet</p>
          <p className="text-xs text-stone-400 mb-4">Import metrics to trigger an automatic review</p>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="rounded-xl border-stone-200/60 text-stone-700 hover:bg-stone-50"
          >
            {refreshing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Run Review
          </Button>
        </div>
      </SectionCard>
    );
  }

  const review = data.review;
  const age = data.created_at
    ? Math.floor((Date.now() - new Date(data.created_at).getTime()) / 86400000)
    : null;

  return (
    <SectionCard
      title="Strategy Review"
      icon={Activity}
      action={
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="ghost"
          size="sm"
          className="text-xs text-stone-500 hover:text-stone-700 rounded-lg"
        >
          {refreshing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Health Score + Diagnosis */}
        <div className="flex items-start gap-3">
          <Badge variant="outline" className={`text-lg font-bold px-3 py-1 ${healthColor(data.health_score)}`}>
            {data.health_score}/10
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-700 font-medium leading-relaxed">{data.diagnosis}</p>
            {age !== null && (
              <p className="text-xs text-stone-400 mt-1">
                {age === 0 ? "Updated today" : `${age}d ago`}
              </p>
            )}
          </div>
        </div>

        {/* What's Working / Not Working */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {review.whats_working?.length > 0 && (
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/60">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">Working</span>
              </div>
              <ul className="space-y-1">
                {review.whats_working.map((item, i) => (
                  <li key={i} className="text-xs text-emerald-800 leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          )}
          {review.whats_not_working?.length > 0 && (
            <div className="bg-red-50/50 rounded-xl p-3 border border-red-100/60">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-600">Needs Work</span>
              </div>
              <ul className="space-y-1">
                {review.whats_not_working.map((item, i) => (
                  <li key={i} className="text-xs text-red-700 leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-stone-500 hover:text-stone-700 font-medium transition-colors"
        >
          {expanded ? "Show less" : "Show recommendations, experiments, pillar scores..."}
        </button>

        {expanded && (
          <div className="space-y-4 pt-2 border-t border-stone-100">
            {/* Pillar Verdicts */}
            {review.pillar_verdicts?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-600 mb-2">Pillar Scores</h4>
                <div className="flex flex-wrap gap-2">
                  {review.pillar_verdicts.map((pv, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${verdictColor(pv.verdict)}`}>
                        {pv.verdict}
                      </Badge>
                      <span className="text-xs text-stone-600">{pv.pillar}</span>
                      <span className="text-xs font-semibold text-stone-700">{pv.score}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {review.recommendations?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <h4 className="text-xs font-semibold text-stone-600">Recommendations</h4>
                </div>
                <div className="space-y-2">
                  {review.recommendations.map((rec, i) => (
                    <div key={i} className="bg-stone-50 rounded-lg p-2.5">
                      <p className="text-xs text-stone-700 font-medium">{rec.action}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">{rec.expected_impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experiments */}
            {review.experiments?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                  <h4 className="text-xs font-semibold text-stone-600">Experiments to Run</h4>
                </div>
                <div className="space-y-2">
                  {review.experiments.map((exp, i) => (
                    <div key={i} className="bg-purple-50/50 rounded-lg p-2.5 border border-purple-100/60">
                      <p className="text-xs font-medium text-purple-800">{exp.name}</p>
                      <p className="text-[11px] text-purple-700 mt-0.5">{exp.hypothesis}</p>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-purple-600">
                        <span>{exp.duration}</span>
                        <span>{exp.success_metric}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hit Formula */}
            {review.hit_formula && (
              <div className="bg-amber-50/50 rounded-lg p-2.5 border border-amber-100/60">
                <h4 className="text-xs font-semibold text-amber-700 mb-1">Hit Formula</h4>
                <p className="text-xs text-amber-800 leading-relaxed">{review.hit_formula}</p>
              </div>
            )}

            {/* Audience Depth */}
            {review.audience_depth_assessment && (
              <div className="bg-stone-50 rounded-lg p-2.5">
                <h4 className="text-xs font-semibold text-stone-600 mb-1">Audience Depth</h4>
                <p className="text-xs text-stone-700 leading-relaxed">{review.audience_depth_assessment}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
});

StrategyReviewCard.displayName = "StrategyReviewCard";
export default StrategyReviewCard;
