"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Heading3, Quote, Link2, Image as ImageIcon, Undo2, Redo2, Code2, AlignLeft, AlignCenter, Minus, Eraser, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPickerButton } from "./media-picker";

function ToolbarButton({ onClick, active, title, children, disabled }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} title={title} aria-label={title} disabled={disabled} className={cn("grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-200 disabled:opacity-40", active && "bg-brand-600 text-white hover:bg-brand-700")}>{children}</button>
  );
}
const B = ToolbarButton;

export function RichText({ value, onChange, placeholder = "Write something…", minHeight = 220, compact, name }: { value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number; compact?: boolean; name?: string }) {
  const lastHtml = React.useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: { attributes: { class: "tiptap prose-icet max-w-none px-4 py-3 text-[15px]", "data-placeholder": placeholder, style: `min-height:${minHeight}px` } },
    onUpdate({ editor }) {
      const h = editor.isEmpty ? "" : editor.getHTML();
      lastHtml.current = h;
      onChange(h);
    },
  });
  // Sync external value changes (e.g. form reset) into the editor without touching React state.
  React.useEffect(() => {
    if (editor && value !== lastHtml.current && value !== editor.getHTML()) {
      lastHtml.current = value;
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);
  if (!editor) return <div className="skeleton" style={{ height: minHeight + 44 }} />;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (!url) return editor.chain().focus().extendMarkRange("link").unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: url.startsWith("http") ? "_blank" : null }).run();
  };
  const embedYoutube = () => {
    const url = window.prompt("YouTube URL");
    if (!url) return;
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (!m) return alert("Could not read a YouTube video id from that URL.");
    editor.chain().focus().insertContent(`<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="YouTube video" allowfullscreen></iframe><p></p>`).run();
  };
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-1.5">
        <B title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></B>
        <B title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></B>
        <B title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}><UnderlineIcon className="h-4 w-4" /></B>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {!compact && <B title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></B>}
        {!compact && <B title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></B>}
        <B title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></B>
        <B title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></B>
        {!compact && <B title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></B>}
        {!compact && <B title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}><Code2 className="h-4 w-4" /></B>}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <B title="Link" onClick={setLink} active={editor.isActive("link")}><Link2 className="h-4 w-4" /></B>
        {!compact && (
          <MediaPickerButton onSelect={(url, alt) => editor.chain().focus().setImage({ src: url, alt: alt || "" }).run()} className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-200" title="Insert image">
            <ImageIcon className="h-4 w-4" />
          </MediaPickerButton>
        )}
        {!compact && <B title="Embed YouTube" onClick={embedYoutube}><Video className="h-4 w-4" /></B>}
        {!compact && <B title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}><AlignLeft className="h-4 w-4" /></B>}
        {!compact && <B title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}><AlignCenter className="h-4 w-4" /></B>}
        {!compact && <B title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></B>}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <B title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></B>
        <B title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="h-4 w-4" /></B>
        <B title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="h-4 w-4" /></B>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
