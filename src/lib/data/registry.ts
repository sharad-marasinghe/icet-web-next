import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/lib/cache";
import { getWorkshopBySlug, getBatchBySlug, type Workshop, type Batch } from "@/lib/registry/service";
import { getFeedbackForm, type FeedbackForm, type FeedbackQuestion } from "@/lib/feedback";

/** Cached public reads for registration/feedback forms. Admin actions bust these tags. */
export async function getPublicWorkshop(slug: string): Promise<Workshop | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.workshops);
  return getWorkshopBySlug(slug);
}

export async function getPublicBatch(slug: string): Promise<Batch | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.batches);
  return getBatchBySlug(slug);
}

export async function getPublicFeedbackForm(slug: string | null): Promise<(FeedbackForm & { questions: FeedbackQuestion[] }) | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.feedback);
  return getFeedbackForm(slug);
}
