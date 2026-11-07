"use client";

import React from "react";

type MarkdownViewerProps = {
  content: string;
};

/**
 * Safe, zero-HTML-injection Markdown viewer for Secure Notes.
 * Never uses dangerouslySetInnerHTML; parses text directly into native React elements.
 * Any raw HTML tags are safely rendered as inert text.
 */
export function MarkdownViewer({ content }: MarkdownViewerProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // Code blocks: ```
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-3 overflow-x-auto rounded-xl bg-[#262135] p-3 text-xs font-mono text-[#f3edf9]"
          >
            <code>{codeBlockLines.join("\n")}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      elements.push(<div key={`blank-${i}`} className="h-2" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-3 text-sm font-bold text-[#3c3348]">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="mt-4 text-base font-bold text-[#3c3348]">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="mt-5 text-lg font-bold text-[#3c3348]">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 border-l-4 border-[#7354d6] bg-[#f7f5fb] py-1 pl-3 text-xs italic text-[#635a71]"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-disc text-xs text-[#51485c]">
          {renderInline(trimmed.slice(2))}
        </li>
      );
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${i}`} className="my-1 text-xs leading-relaxed text-[#51485c]">
        {renderInline(line)}
      </p>
    );
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key="unclosed-code"
        className="my-3 overflow-x-auto rounded-xl bg-[#262135] p-3 text-xs font-mono text-[#f3edf9]"
      >
        <code>{codeBlockLines.join("\n")}</code>
      </pre>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

/**
 * Render inline markdown elements safely: bold (**text**), italic (*text*), inline code (`code`).
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match `code`, **bold**, *italic*
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${match.index}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={key}
          className="rounded bg-[#eee9f8] px-1.5 py-0.5 font-mono text-[11px] text-[#5e4b85]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key} className="font-semibold text-[#2b2535]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={key} className="italic text-[#433c4f]">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
