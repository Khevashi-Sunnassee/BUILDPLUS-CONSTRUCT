import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect, useState, useCallback } from "react";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Link as LinkIcon,
  ImageIcon,
  TableIcon,
  Minus,
  Quote,
  Code2,
  Undo2,
  Redo2,
  Paintbrush,
  Palette,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff",
  "#9900ff", "#ff00ff", "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3",
  "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
];

const HIGHLIGHT_COLORS = [
  "#ffff00", "#00ff00", "#00ffff", "#ff00ff", "#ff0000", "#0000ff",
  "#fce5cd", "#d9ead3", "#cfe2f3", "#d9d2e9", "#f4cccc", "#fff2cc",
];

const FONT_FAMILIES = [
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
];

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
}

function ColorPickerGrid({
  colors,
  activeColor,
  onSelect,
}: {
  colors: string[];
  activeColor: string | undefined;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {colors.map((color) => (
        <button
          key={color}
          className={`rounded-sm border border-border cursor-pointer transition-transform ${
            activeColor === color ? "ring-2 ring-ring scale-110" : ""
          }`}
          style={{
            backgroundColor: color,
            width: 24,
            height: 24,
            minWidth: 24,
            minHeight: 24,
          }}
          onClick={() => onSelect(color)}
          data-testid={`color-swatch-${color.replace("#", "")}`}
          type="button"
        />
      ))}
    </div>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightColorOpen, setHighlightColorOpen] = useState(false);

  if (!editor) return null;

  const addLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const currentFontFamily = editor.getAttributes("textStyle").fontFamily || "";
  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : "normal";

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 p-1.5">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        data-testid="button-undo"
        title="Undo"
        className="toggle-elevate"
      >
        <Undo2 />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        data-testid="button-redo"
        title="Redo"
        className="toggle-elevate"
      >
        <Redo2 />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select
        value={
          FONT_FAMILIES.some((f) => f.value === currentFontFamily)
            ? currentFontFamily
            : "Arial"
        }
        onValueChange={(val) =>
          editor.chain().focus().setFontFamily(val).run()
        }
      >
        <SelectTrigger
          className="w-[140px] text-xs"
          data-testid="select-font-family"
        >
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((font) => (
            <SelectItem
              key={font.value}
              value={font.value}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select
        value={currentHeading}
        onValueChange={(val) => {
          if (val === "normal") {
            editor.chain().focus().setParagraph().run();
          } else {
            const level = parseInt(val.replace("h", "")) as 1 | 2 | 3;
            editor.chain().focus().toggleHeading({ level }).run();
          }
        }}
      >
        <SelectTrigger
          className="w-[120px] text-xs"
          data-testid="select-heading"
        >
          <SelectValue placeholder="Normal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">
            <span className="flex items-center gap-2">
              <Type className="h-3.5 w-3.5" /> Normal
            </span>
          </SelectItem>
          <SelectItem value="h1">
            <span className="flex items-center gap-2">
              <Heading1 className="h-3.5 w-3.5" /> Heading 1
            </span>
          </SelectItem>
          <SelectItem value="h2">
            <span className="flex items-center gap-2">
              <Heading2 className="h-3.5 w-3.5" /> Heading 2
            </span>
          </SelectItem>
          <SelectItem value="h3">
            <span className="flex items-center gap-2">
              <Heading3 className="h-3.5 w-3.5" /> Heading 3
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleBold().run()}
        data-testid="button-bold"
        title="Bold"
        className={`toggle-elevate ${editor.isActive("bold") ? "toggle-elevated" : ""}`}
      >
        <Bold />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        data-testid="button-italic"
        title="Italic"
        className={`toggle-elevate ${editor.isActive("italic") ? "toggle-elevated" : ""}`}
      >
        <Italic />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        data-testid="button-underline"
        title="Underline"
        className={`toggle-elevate ${editor.isActive("underline") ? "toggle-elevated" : ""}`}
      >
        <UnderlineIcon />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        data-testid="button-strikethrough"
        title="Strikethrough"
        className={`toggle-elevate ${editor.isActive("strike") ? "toggle-elevated" : ""}`}
      >
        <Strikethrough />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-text-color"
            title="Text Color"
          >
            <Palette />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Text Color
          </p>
          <ColorPickerGrid
            colors={TEXT_COLORS}
            activeColor={editor.getAttributes("textStyle").color}
            onSelect={(color) => {
              editor.chain().focus().setColor(color).run();
              setTextColorOpen(false);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setTextColorOpen(false);
            }}
            data-testid="button-reset-text-color"
          >
            Reset Color
          </Button>
        </PopoverContent>
      </Popover>

      <Popover open={highlightColorOpen} onOpenChange={setHighlightColorOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-highlight"
            title="Highlight"
            className={`toggle-elevate ${editor.isActive("highlight") ? "toggle-elevated" : ""}`}
          >
            <Paintbrush />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Highlight Color
          </p>
          <div className="grid grid-cols-6 gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                className={`rounded-sm border border-border cursor-pointer transition-transform ${
                  editor.getAttributes("highlight").color === color
                    ? "ring-2 ring-ring scale-110"
                    : ""
                }`}
                style={{
                  backgroundColor: color,
                  width: 24,
                  height: 24,
                  minWidth: 24,
                  minHeight: 24,
                }}
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .toggleHighlight({ color })
                    .run();
                  setHighlightColorOpen(false);
                }}
                data-testid={`highlight-swatch-${color.replace("#", "")}`}
                type="button"
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setHighlightColorOpen(false);
            }}
            data-testid="button-reset-highlight"
          >
            Remove Highlight
          </Button>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        data-testid="button-align-left"
        title="Align Left"
        className={`toggle-elevate ${editor.isActive({ textAlign: "left" }) ? "toggle-elevated" : ""}`}
      >
        <AlignLeft />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        data-testid="button-align-center"
        title="Align Center"
        className={`toggle-elevate ${editor.isActive({ textAlign: "center" }) ? "toggle-elevated" : ""}`}
      >
        <AlignCenter />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        data-testid="button-align-right"
        title="Align Right"
        className={`toggle-elevate ${editor.isActive({ textAlign: "right" }) ? "toggle-elevated" : ""}`}
      >
        <AlignRight />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        data-testid="button-align-justify"
        title="Justify"
        className={`toggle-elevate ${editor.isActive({ textAlign: "justify" }) ? "toggle-elevated" : ""}`}
      >
        <AlignJustify />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        data-testid="button-bullet-list"
        title="Bullet List"
        className={`toggle-elevate ${editor.isActive("bulletList") ? "toggle-elevated" : ""}`}
      >
        <List />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        data-testid="button-ordered-list"
        title="Numbered List"
        className={`toggle-elevate ${editor.isActive("orderedList") ? "toggle-elevated" : ""}`}
      >
        <ListOrdered />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        size="icon"
        variant="ghost"
        onClick={addLink}
        data-testid="button-link"
        title="Insert Link"
        className={`toggle-elevate ${editor.isActive("link") ? "toggle-elevated" : ""}`}
      >
        <LinkIcon />
      </Button>
      {editor.isActive("link") && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => editor.chain().focus().unsetLink().run()}
          data-testid="button-unlink"
          title="Remove Link"
        >
          <Unlink />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={addImage}
        data-testid="button-image"
        title="Insert Image"
      >
        <ImageIcon />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={insertTable}
        data-testid="button-table"
        title="Insert Table"
      >
        <TableIcon />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        data-testid="button-horizontal-rule"
        title="Horizontal Rule"
      >
        <Minus />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        data-testid="button-blockquote"
        title="Blockquote"
        className={`toggle-elevate ${editor.isActive("blockquote") ? "toggle-elevated" : ""}`}
      >
        <Quote />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        data-testid="button-code-block"
        title="Code Block"
        className={`toggle-elevate ${editor.isActive("codeBlock") ? "toggle-elevated" : ""}`}
      >
        <Code2 />
      </Button>
    </div>
  );
}


export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  editable = true,
  minHeight = "300px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          style: "max-width: 100%; height: auto;",
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "editor-link",
        },
      }),
      Color,
      TextStyle,
      FontFamily,
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const items = Array.from(clipboardData.items || []);
        const imageItem = items.find(item => item.type.startsWith("image/"));

        if (imageItem) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (!file) return false;

          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            view.dispatch(
              view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src: base64 })
              )
            );
          };
          reader.readAsDataURL(file);
          return true;
        }

        const html = clipboardData.getData("text/html");
        if (html && /<img[^>]+src\s*=\s*["']https?:\/\//i.test(html)) {
          event.preventDefault();

          const cleaned = html
            .replace(/<!--\[if[\s\S]*?endif\]-->/gi, "")
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<meta[^>]*>/gi, "")
            .replace(/<link[^>]*>/gi, "")
            .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "");

          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = cleaned;

          const bodyEl = tempDiv.querySelector("body");
          const contentEl = bodyEl || tempDiv;

          contentEl.querySelectorAll("img").forEach((img) => {
            const src = img.getAttribute("src");
            if (!src || (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:"))) {
              img.remove();
              return;
            }
            img.removeAttribute("width");
            img.removeAttribute("height");
            img.setAttribute("style", "max-width: 100%; height: auto;");
          });

          const editor = (view as any)._tiptapEditor;
          if (editor && editor.commands) {
            editor.commands.insertContent(contentEl.innerHTML);
          } else {
            const { state, dispatch } = view;
            const parser = ProseMirrorDOMParser.fromSchema(state.schema);
            const parsedDoc = document.createElement("div");
            parsedDoc.innerHTML = contentEl.innerHTML;
            const slice = parser.parseSlice(parsedDoc);
            const tr = state.tr.replaceSelection(slice);
            dispatch(tr);
          }
          return true;
        }

        return false;
      },
      transformPastedHTML(html) {
        return html
          .replace(/<!--\[if[\s\S]*?endif\]-->/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "");
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  return (
    <div className="rounded-md border border-border bg-background" data-testid="rich-text-editor">
      <style>{`
        .tiptap-editor .ProseMirror {
          min-height: ${minHeight};
          padding: 16px;
          outline: none;
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #000000;
          background-color: #ffffff;
        }
        .tiptap-editor .ProseMirror p {
          margin: 0 0 0.5em 0;
        }
        .tiptap-editor .ProseMirror h1 {
          font-size: 1.75em;
          font-weight: 700;
          margin: 0.67em 0;
          line-height: 1.2;
        }
        .tiptap-editor .ProseMirror h2 {
          font-size: 1.4em;
          font-weight: 600;
          margin: 0.5em 0;
          line-height: 1.3;
        }
        .tiptap-editor .ProseMirror h3 {
          font-size: 1.15em;
          font-weight: 600;
          margin: 0.4em 0;
          line-height: 1.4;
        }
        .tiptap-editor .ProseMirror ul,
        .tiptap-editor .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor .ProseMirror ul {
          list-style-type: disc;
        }
        .tiptap-editor .ProseMirror ol {
          list-style-type: decimal;
        }
        .tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #6b7280;
          font-style: italic;
        }
        .tiptap-editor .ProseMirror pre {
          background: #f3f4f6;
          border-radius: 6px;
          padding: 12px 16px;
          font-family: "Courier New", monospace;
          font-size: 0.9em;
          overflow-x: auto;
          margin: 0.5em 0;
          color: #1f2937;
        }
        .tiptap-editor .ProseMirror code {
          background: #f3f4f6;
          border-radius: 3px;
          padding: 2px 4px;
          font-family: "Courier New", monospace;
          font-size: 0.9em;
          color: #1f2937;
        }
        .tiptap-editor .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        .tiptap-editor .ProseMirror hr {
          border: none;
          border-top: 1px solid #d1d5db;
          margin: 1em 0;
        }
        .tiptap-editor .ProseMirror .editor-link,
        .tiptap-editor .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 0.5em 0;
        }
        .tiptap-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 2px;
        }
        .tiptap-editor .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.5em 0;
          overflow: hidden;
        }
        .tiptap-editor .ProseMirror table td,
        .tiptap-editor .ProseMirror table th {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          vertical-align: top;
          min-width: 80px;
          position: relative;
          color: #000000;
        }
        .tiptap-editor .ProseMirror table th {
          background: #f3f4f6;
          font-weight: 600;
          text-align: left;
        }
        .tiptap-editor .ProseMirror table .selectedCell {
          background: #dbeafe;
        }
        .tiptap-editor .ProseMirror .is-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .tiptap-editor .ProseMirror:focus {
          outline: none;
        }
        .tiptap-editor .ProseMirror mark {
          border-radius: 2px;
          padding: 1px 2px;
        }
      `}</style>
      {editable && <EditorToolbar editor={editor} />}
      <div className="tiptap-editor" style={{ backgroundColor: "#ffffff" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
