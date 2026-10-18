import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchBuffer } from "@/lib/storage";

export type MappingItem = {
  var_key: string;             // student_name | certificate_id | student_id | student_nic | issue_date | course_name | signature
  x: number; y: number;        // pixel coordinates on the template image (top-left origin)
  font_size?: number;
  font_color?: string;
  font_weight?: "normal" | "bold" | "italic";
  align?: "left" | "center" | "right";
  image_url?: string;          // for signature layers
  width?: number; height?: number;
};

export type CertificateValues = { student_name: string; certificate_id: string; student_id?: string; student_nic?: string; issue_date?: string; course_name?: string };

function hexToRgb(hex: string) {
  const h = (hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.padEnd(6, "0").slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Render a certificate PDF: the template image fills the page (page size follows
 * the image aspect ratio), text is placed using the same pixel coordinates the
 * admin canvas mapper uses (origin top-left, baseline at y).
 */
export async function buildCertificatePdf(templateUrl: string | null, mapping: MappingItem[], values: CertificateValues): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate ${values.certificate_id}`);
  pdf.setAuthor("iCET - Institute of Computer Engineering Technology");

  let imgW = 1754, imgH = 1240; // A4 landscape @150dpi fallback
  let image: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (templateUrl) {
    try {
      const { buffer, contentType } = await fetchBuffer(templateUrl);
      image = contentType.includes("png") || templateUrl.toLowerCase().endsWith(".png") ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
      imgW = image.width;
      imgH = image.height;
    } catch {
      image = null;
    }
  }
  // Page in points: scale the pixel canvas so the long edge = 842pt (A4 landscape) keeping aspect.
  const scale = imgW >= imgH ? 842 / imgW : 842 / imgH;
  const pageW = imgW * scale, pageH = imgH * scale;
  const page = pdf.addPage([pageW, pageH]);
  if (image) page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH });
  else page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });

  const fonts = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  for (const m of mapping) {
    if (m.var_key === "signature" && m.image_url) {
      try {
        const { buffer, contentType } = await fetchBuffer(m.image_url);
        const sig = contentType.includes("png") || m.image_url.toLowerCase().endsWith(".png") ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
        const w = (m.width || 300) * scale, h = (m.height || (sig.height / sig.width) * (m.width || 300)) * scale;
        page.drawImage(sig, { x: m.x * scale - w / 2, y: pageH - m.y * scale - h / 2, width: w, height: h });
      } catch { /* skip broken signature */ }
      continue;
    }
    const text = String((values as Record<string, string | undefined>)[m.var_key] ?? "");
    if (!text) continue;
    const font = fonts[m.font_weight || "normal"] || fonts.normal;
    const size = (m.font_size || 24) * scale;
    const width = font.widthOfTextAtSize(text, size);
    const align = m.align || (m.var_key === "student_name" ? "center" : "left");
    const x = align === "center" ? m.x * scale - width / 2 : align === "right" ? m.x * scale - width : m.x * scale;
    page.drawText(text, { x, y: pageH - m.y * scale, size, font, color: hexToRgb(m.font_color || "#000000") });
  }
  return pdf.save();
}
