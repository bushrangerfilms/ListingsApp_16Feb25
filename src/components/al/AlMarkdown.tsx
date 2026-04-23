import { Fragment, ReactNode } from "react";

// Tiny markdown renderer: bold, italic, inline code, links, lists, paragraphs.
// Plus: extracts <feedback_draft type="...">...</feedback_draft> blocks for the caller.

export interface ParsedFeedbackDraft {
  type: "idea" | "bug" | "improvement" | "general";
  message: string;
}

export interface ParsedAssistantMessage {
  segments: Array<
    | { kind: "text"; text: string }
    | { kind: "feedback_draft"; draft: ParsedFeedbackDraft }
  >;
}

const FEEDBACK_DRAFT_RE =
  /<feedback_draft\s+type=["'](idea|bug|improvement|general)["']\s*>([\s\S]*?)<\/feedback_draft>/g;

export function parseAssistantMessage(content: string): ParsedAssistantMessage {
  const segments: ParsedAssistantMessage["segments"] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  FEEDBACK_DRAFT_RE.lastIndex = 0;
  while ((match = FEEDBACK_DRAFT_RE.exec(content)) !== null) {
    const before = content.slice(lastIdx, match.index);
    if (before) segments.push({ kind: "text", text: before });
    segments.push({
      kind: "feedback_draft",
      draft: {
        type: match[1] as ParsedFeedbackDraft["type"],
        message: match[2].trim(),
      },
    });
    lastIdx = match.index + match[0].length;
  }
  const tail = content.slice(lastIdx);
  if (tail) segments.push({ kind: "text", text: tail });
  if (segments.length === 0) segments.push({ kind: "text", text: "" });
  return { segments };
}

interface MarkdownProps {
  text: string;
  onLinkClick?: (href: string) => void;
}

// Render markdown text. Splits into blocks (paragraphs, lists, code), then renders inline.
export function Markdown({ text, onLinkClick }: MarkdownProps) {
  const blocks = blockify(text);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => renderBlock(block, i, onLinkClick))}
    </div>
  );
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; text: string; lang?: string }
  | { kind: "h"; level: 1 | 2 | 3; text: string };

function blockify(input: string): Block[] {
  const lines = input.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ kind: "code", text: buf.join("\n"), lang });
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      blocks.push({
        kind: "h",
        level: hMatch[1].length as 1 | 2 | 3,
        text: hMatch[2],
      });
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Blank line — paragraph break
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph (collect contiguous non-empty, non-special lines)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) blocks.push({ kind: "p", text: buf.join("\n") });
  }
  return blocks;
}

function renderBlock(block: Block, idx: number, onLinkClick?: (href: string) => void): ReactNode {
  switch (block.kind) {
    case "p":
      return (
        <p key={idx} className="whitespace-pre-wrap">
          {renderInline(block.text, onLinkClick)}
        </p>
      );
    case "ul":
      return (
        <ul key={idx} className="list-disc pl-5 space-y-1">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, onLinkClick)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={idx} className="list-decimal pl-5 space-y-1">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, onLinkClick)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre
          key={idx}
          className="bg-muted text-muted-foreground rounded-md p-3 text-xs overflow-x-auto"
        >
          <code>{block.text}</code>
        </pre>
      );
    case "h": {
      const sizes = { 1: "text-base", 2: "text-sm", 3: "text-sm" };
      return (
        <p key={idx} className={`font-semibold ${sizes[block.level]}`}>
          {renderInline(block.text, onLinkClick)}
        </p>
      );
    }
  }
}

// Inline: links [text](href), bold **x**, italic *x*, inline code `x`.
function renderInline(text: string, onLinkClick?: (href: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  // Tokenize via a single regex with named alternates.
  const re = /(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    if (m[1]) {
      // Link
      const label = m[2];
      const href = m[3];
      out.push(
        <a
          key={key++}
          href={href}
          onClick={(e) => {
            // Internal links → use router navigation when handler provided
            if (onLinkClick && (href.startsWith("/") || href.startsWith("./"))) {
              e.preventDefault();
              onLinkClick(href);
            }
          }}
          className="text-primary underline underline-offset-2 hover:opacity-80"
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {label}
        </a>
      );
    } else if (m[4]) {
      out.push(
        <code key={key++} className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-xs">
          {m[5]}
        </code>
      );
    } else if (m[6]) {
      out.push(
        <strong key={key++} className="font-semibold">
          {m[7]}
        </strong>
      );
    } else if (m[8]) {
      out.push(
        <em key={key++} className="italic">
          {m[9]}
        </em>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}
