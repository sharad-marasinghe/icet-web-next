import "server-only";
import { revalidateTag, revalidatePath } from "next/cache";

/** Expire cached public content after an admin mutation. Safe in actions and route handlers. */
export function bust(...tags: string[]) {
  for (const t of tags) {
    try {
      revalidateTag(t, "max");
    } catch {
      /* ignore outside request scope */
    }
  }
}

export function bustPath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    /* ignore */
  }
}
