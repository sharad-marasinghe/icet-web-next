import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";

type Opt = { value: string; label: string };

/**
 * Option lists for `ref` fields in the block editor and content forms.
 * GET /admin/api/content/refs?entity=faq_group → [{ value, label }]
 */
export async function GET(req: NextRequest) {
  await assertRole("viewer");
  const entity = req.nextUrl.searchParams.get("entity") || "";
  let rows: Opt[] = [];
  switch (entity) {
    case "faq_group":
      rows = await sql<Opt[]>`select slug as value, title as label from public.faq_groups order by title`;
      break;
    case "gallery_album":
      rows = await sql<Opt[]>`select slug as value, title as label from public.gallery_albums order by sort_order, title`;
      break;
    case "workshop":
      rows = await sql<Opt[]>`select slug as value, title || ' (' || status::text || ')' as label from public.reg_workshops order by status, starts_at desc nulls last, id desc`;
      break;
    case "batch":
      rows = await sql<Opt[]>`select slug as value, batch_name || case when course_code <> '' then ' · ' || course_code else '' end as label from public.reg_batches order by is_open desc, id desc`;
      break;
    case "feedback_form":
      rows = await sql<Opt[]>`select slug as value, name as label from public.feedback_forms order by is_default desc, name`;
      break;
    case "program":
      rows = await sql<Opt[]>`select code as value, code || ' – ' || name as label from public.programs order by sort_order, code`;
      break;
    case "event_category":
      rows = await sql<Opt[]>`select slug as value, name as label from public.event_categories order by name`;
      break;
    case "post_category":
      rows = await sql<Opt[]>`select slug as value, name as label from public.post_categories order by name`;
      break;
    case "video_collection":
      rows = await sql<Opt[]>`select distinct collection as value, collection as label from public.videos order by collection`;
      break;
    case "partner_category":
      rows = await sql<Opt[]>`select distinct category as value, category as label from public.partners order by category`;
      break;
    default:
      return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  return NextResponse.json(rows.map((r) => ({ value: String(r.value), label: String(r.label) })), { headers: { "Cache-Control": "no-store" } });
}
