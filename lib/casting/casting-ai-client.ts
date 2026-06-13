import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  selectGeminiKeyForTask,
  markKeySuccess,
  markKeyFailure,
  isRateLimitError,
} from "@/lib/subtitles/key-manager";
import type { CastingAgentRecommendation } from "@prisma/client";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export type AuditionReviewInput = {
  applicationId:   string;
  roleTitle:       string;
  roleDescription: string;
  requireGender:   boolean;
  allowedGender:   string | null;
  requireAgeRange: boolean;
  minAge:          number | null;
  maxAge:          number | null;
  requireVoiceSample: boolean;
  // Applicant data
  name:            string;
  location:        string;
  socialHandle:    string;
  roleInterest:    string;
  shortNote:       string;
  gender:          string | null;
  ageRange:        string | null;
  // Media summary (do not pass actual file contents or URLs)
  imageCount:      number;
  imageMimeTypes:  string[];
  audioCount:      number;
  audioDurationSeconds: number | null;
  // Policy
  consentAccepted:          boolean;
  policyAccepted:           boolean;
  isAdultConfirmed:         boolean;
  unpaidAccepted:           boolean;
  likenessReleaseAccepted:  boolean;
  withdrawalTermsAccepted:  boolean;
};

export type AuditionReviewResult = {
  overallScore:   number;                    // 0–100
  photoScore:     number;                    // 0–30
  voiceScore:     number;                    // 0–30
  socialScore:    number;                    // 0–20
  formScore:      number;                    // 0–20
  recommendation: CastingAgentRecommendation;
  summary:        string;
  imageReview:    string;
  audioReview:    string;
  socialResult:   string;
  roleMatchResult: string;
  suggestedAction: string;
  missingItems:   string[];
  scoreBreakdown: Record<string, unknown>;
};

function buildPrompt(input: AuditionReviewInput): string {
  const roleRequirements: string[] = [];
  if (input.requireGender && input.allowedGender) {
    roleRequirements.push(`Gender requirement: ${input.allowedGender}`);
  }
  if (input.requireAgeRange && input.minAge != null && input.maxAge != null) {
    roleRequirements.push(`Age range requirement: ${input.minAge}–${input.maxAge}`);
  }
  if (input.requireVoiceSample) {
    roleRequirements.push("Voice/audio sample required");
  }

  const audioDurationMin = input.audioDurationSeconds != null
    ? (input.audioDurationSeconds / 60).toFixed(1)
    : null;

  return `You are the AIM Studio Casting Autopilot agent. Your task is to review a casting application and produce a structured quality report.

CRITICAL RULES:
- Do NOT judge beauty, attractiveness, race, ethnicity, disability, religion, body type, or any protected characteristics.
- Do NOT make casting decisions. Only assess submission completeness, quality, and policy compliance.
- Do NOT say "denied", "rejected", or any harsh language.
- Be professional, factual, and objective.

ROLE INFORMATION:
- Title: ${input.roleTitle}
- Description: ${input.roleDescription}
- Requirements: ${roleRequirements.length > 0 ? roleRequirements.join("; ") : "No specific requirements"}

APPLICANT SUBMISSION SUMMARY:
- Name: ${input.name}
- Location: ${input.location}
- Social Handle: ${input.socialHandle || "(not provided)"}
- Role Interest: ${input.roleInterest || "(not provided)"}
- Short Note: ${input.shortNote || "(not provided)"}
- Gender (if provided): ${input.gender || "Not stated"}
- Age Range (if provided): ${input.ageRange || "Not stated"}

MEDIA SUBMISSION:
- Images submitted: ${input.imageCount} (required: 4–6)
- Image MIME types: ${input.imageMimeTypes.join(", ") || "(none)"}
- Audio files submitted: ${input.audioCount} (required: 1 if role requires voice sample)
- Audio duration: ${audioDurationMin != null ? `${audioDurationMin} minutes (required: 1–3 minutes)` : "No audio submitted"}

POLICY ACCEPTANCE:
- Consent accepted: ${input.consentAccepted ? "Yes" : "No"}
- Casting Policy accepted: ${input.policyAccepted ? "Yes" : "No"}
- 18+ confirmed: ${input.isAdultConfirmed ? "Yes" : "No"}
- Unpaid opportunity accepted: ${input.unpaidAccepted ? "Yes" : "No"}
- Likeness release accepted: ${input.likenessReleaseAccepted ? "Yes" : "No"}
- Withdrawal terms accepted: ${input.withdrawalTermsAccepted ? "Yes" : "No"}

SCORING RUBRIC:
Score each category as a number only. Do not add explanations inside the score fields.

1. Photo Quality (0–30):
   - 0: Fewer than 4 images submitted
   - 10: 4+ images submitted but image types suggest non-standard formats or potential issues
   - 20: 4–6 images submitted, valid image formats (JPEG/PNG/WEBP)
   - 25: 4–6 images, all standard formats, appears complete
   - 30: 4–6 images, all standard formats, complete, meets all requirements

2. Voice/Audio Quality (0–30):
   - 0: No audio submitted AND role requires voice sample
   - 0: Audio duration is 0 or not provided AND role requires voice sample
   - 10: Audio submitted but duration is less than 1 minute
   - 15: Audio submitted but duration exceeds 3 minutes
   - 20: Audio submitted with appropriate duration (1–3 min) but no confirmation of voice content
   - 25: Audio with appropriate duration (1–3 min), standard audio format
   - 30: Audio with appropriate duration (1–3 min), standard format, all criteria met
   - If role does NOT require voice sample: award 25 points for no audio, 30 points if audio is provided anyway.

3. Social/Contact Completeness (0–20):
   - 0: Social handle completely missing or empty
   - 10: Social handle present but very short or appears incomplete
   - 15: Social handle provided, looks plausible
   - 20: Social handle provided, appears professional/complete, location and contact info filled

4. Form/Policy Completeness (0–20):
   - Each unchecked required policy field deducts 4 points from 20.
   - Role interest and short note being empty each deduct 3 points.
   - All complete = 20.

REQUIRED RESPONSE FORMAT (JSON only, no markdown, no extra text):
{
  "photoScore": <integer 0-30>,
  "voiceScore": <integer 0-30>,
  "socialScore": <integer 0-20>,
  "formScore": <integer 0-20>,
  "imageReview": "<one sentence describing image submission completeness>",
  "audioReview": "<one sentence describing audio submission completeness>",
  "socialResult": "<one sentence describing social/contact completeness>",
  "roleMatchResult": "<one sentence on whether role-specific requirements were addressed>",
  "missingItems": ["<item1 if missing>", "<item2 if missing>"],
  "summary": "<2-3 sentence professional summary of the overall submission quality>",
  "suggestedAction": "<one sentence recommended next step for the admin>"
}`;
}

async function callGeminiWithKey(apiKey: string, prompt: string): Promise<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const model  = client.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function runAuditionReview(
  input: AuditionReviewInput,
): Promise<AuditionReviewResult | { error: string; noKey: boolean }> {
  const selected = await selectGeminiKeyForTask("CASTING_AUDITION");

  if (!selected) {
    return {
      error: "No active AI key is assigned to Casting Audition. Add and assign a key in Admin → AI Keys.",
      noKey: true,
    };
  }

  const prompt = buildPrompt(input);
  let rawText: string;

  try {
    rawText = await callGeminiWithKey(selected.decryptedKey, prompt);
    if (selected.apiKeyId) await markKeySuccess(selected.apiKeyId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (selected.apiKeyId) await markKeyFailure(selected.apiKeyId, msg);
    // If rate-limited, surface so caller can retry later
    if (isRateLimitError(msg)) {
      return { error: "AI key rate limited. The application will be retried automatically.", noKey: false };
    }
    return { error: `Agent error: ${msg}`, noKey: false };
  }

  // Extract JSON from response
  let parsed: {
    photoScore: number;
    voiceScore: number;
    socialScore: number;
    formScore: number;
    imageReview: string;
    audioReview: string;
    socialResult: string;
    roleMatchResult: string;
    missingItems: string[];
    summary: string;
    suggestedAction: string;
  };

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch (err) {
    return { error: `Agent returned malformed response: ${(err as Error).message}`, noKey: false };
  }

  // Clamp scores to valid ranges
  const photoScore  = Math.max(0, Math.min(30, Math.round(parsed.photoScore  ?? 0)));
  const voiceScore  = Math.max(0, Math.min(30, Math.round(parsed.voiceScore  ?? 0)));
  const socialScore = Math.max(0, Math.min(20, Math.round(parsed.socialScore ?? 0)));
  const formScore   = Math.max(0, Math.min(20, Math.round(parsed.formScore   ?? 0)));
  const overallScore = photoScore + voiceScore + socialScore + formScore;

  let recommendation: CastingAgentRecommendation;
  if (overallScore >= 85) {
    recommendation = "PASS";
  } else if (overallScore >= 50) {
    recommendation = "MANUAL_REVIEW";
  } else {
    recommendation = "FAIL";
  }

  return {
    overallScore,
    photoScore,
    voiceScore,
    socialScore,
    formScore,
    recommendation,
    summary:         parsed.summary         ?? "",
    imageReview:     parsed.imageReview     ?? "",
    audioReview:     parsed.audioReview     ?? "",
    socialResult:    parsed.socialResult    ?? "",
    roleMatchResult: parsed.roleMatchResult ?? "",
    suggestedAction: parsed.suggestedAction ?? "",
    missingItems:    Array.isArray(parsed.missingItems) ? parsed.missingItems : [],
    scoreBreakdown: { photoScore, voiceScore, socialScore, formScore, overallScore },
  };
}
