"use client";

import { Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import type { VoiceProfile } from "@/types/linkedin";

function ToneBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-stone-600">{label}</span>
        <span className="text-stone-400 font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-stone-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface Props {
  voice: VoiceProfile;
}

export default function VoiceProfileCard({ voice }: Props) {
  if (voice.error) {
    return (
      <SectionCard title="Voice Profile" icon={Mic}>
        <p className="text-sm text-stone-500">Voice profile could not be analyzed yet.</p>
      </SectionCard>
    );
  }

  const tone = voice.tone;
  const vocab = voice.vocabulary;
  const structure = voice.structure;

  return (
    <SectionCard title="Voice Profile" icon={Mic}>
      <div className="space-y-5">
        {/* Tone dimensions */}
        {tone && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Tone</p>
            {tone.formality != null && <ToneBar label="Formality" value={tone.formality} />}
            {tone.warmth != null && <ToneBar label="Warmth" value={tone.warmth} />}
            {tone.confidence != null && <ToneBar label="Confidence" value={tone.confidence} />}
            {tone.humor != null && <ToneBar label="Humor" value={tone.humor} />}
            {tone.vulnerability != null && <ToneBar label="Vulnerability" value={tone.vulnerability} />}
          </div>
        )}

        {/* Structure */}
        {structure && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Structure</p>
            {structure.paragraph_style && (
              <p className="text-sm text-stone-600">
                Style: <span className="font-medium text-stone-800">{structure.paragraph_style.replace(/_/g, " ")}</span>
              </p>
            )}
            {structure.typical_post_structure && (
              <p className="text-sm text-stone-600">
                Pattern: <span className="font-medium text-stone-800">{structure.typical_post_structure}</span>
              </p>
            )}
          </div>
        )}

        {/* Vocabulary */}
        {vocab && (
          <div className="space-y-2">
            {vocab.signature_phrases && vocab.signature_phrases.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Signature Phrases</p>
                <div className="flex flex-wrap gap-1.5">
                  {vocab.signature_phrases.map((p, i) => (
                    <Badge key={i} variant="secondary" className="bg-stone-100 text-stone-700 text-xs">
                      &ldquo;{p}&rdquo;
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {vocab.avoided_words && vocab.avoided_words.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Never Uses</p>
                <div className="flex flex-wrap gap-1.5">
                  {vocab.avoided_words.map((w, i) => (
                    <Badge key={i} variant="secondary" className="bg-red-50 text-red-600 text-xs border-red-200/60">
                      {w}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Anti-patterns */}
        {voice.anti_patterns && voice.anti_patterns.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Anti-Patterns</p>
            <ul className="space-y-1">
              {voice.anti_patterns.map((ap, i) => (
                <li key={i} className="text-xs text-stone-600 flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5 shrink-0">&times;</span>
                  {ap}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
