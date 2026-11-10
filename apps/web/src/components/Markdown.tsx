import { Lexer } from "marked";
import type { Token, Tokens } from "marked";
import type { ReactNode } from "react";
import { Link } from "./Link";

/**
 * Shows Markdown text from a content file.
 *
 * Safety design: the `marked` library only reads the text and gives back a list of tokens (it
 * does not make HTML here). We turn each known token into a React element ourselves. React
 * escapes all text, so nothing from the file can become a tag. Raw HTML in the file is shown as
 * plain text. Images are never loaded from the text (a step's image comes from the lesson's
 * `image` setting, which the schema limits to our own server). A link is kept only if it goes to
 * a page in this app, or to https, mailto or tel. Anything else, such as `javascript:`, shows as
 * plain text. There is no dangerouslySetInnerHTML anywhere.
 */

/** Returns the link to use, or null if it is not on the short list of safe kinds. */
export function safeHref(href: string): string | null {
  if (/^\/(?![/\\])/.test(href)) {
    return href;
  }
  try {
    const url = new URL(href);
    return ["https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function inline(tokens: Token[] | undefined): ReactNode[] {
  return render(tokens ?? []);
}

function render(tokens: Token[]): ReactNode[] {
  return tokens.map((token, i) => renderToken(token, i));
}

function renderToken(token: Token, key: number): ReactNode {
  switch (token.type) {
    case "space":
      return null;
    case "paragraph":
      return <p key={key}>{inline((token as Tokens.Paragraph).tokens)}</p>;
    case "heading": {
      const { depth, tokens } = token as Tokens.Heading;
      // The screen already has one h1, so content headings start at h2.
      const Tag = (["h2", "h2", "h3", "h4", "h5", "h6", "h6"] as const)[Math.min(depth, 6)] ?? "h6";
      return <Tag key={key}>{inline(tokens)}</Tag>;
    }
    case "list": {
      const list = token as Tokens.List;
      const Tag = list.ordered ? "ol" : "ul";
      return (
        <Tag key={key}>
          {list.items.map((item, j) => (
            <li key={j}>{render(item.tokens)}</li>
          ))}
        </Tag>
      );
    }
    case "blockquote":
      return <blockquote key={key}>{render((token as Tokens.Blockquote).tokens)}</blockquote>;
    case "hr":
      return <hr key={key} />;
    case "code":
      return (
        <pre key={key}>
          <code>{(token as Tokens.Code).text}</code>
        </pre>
      );
    case "codespan":
      return <code key={key}>{(token as Tokens.Codespan).text}</code>;
    case "strong":
      return <strong key={key}>{inline((token as Tokens.Strong).tokens)}</strong>;
    case "em":
      return <em key={key}>{inline((token as Tokens.Em).tokens)}</em>;
    case "br":
      return <br key={key} />;
    case "text": {
      const { tokens, text } = token as Tokens.Text;
      return tokens ? <span key={key}>{inline(tokens)}</span> : text;
    }
    case "link": {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      if (href === null) {
        return <span key={key}>{inline(link.tokens)}</span>;
      }
      if (href.startsWith("/")) {
        return (
          <Link key={key} to={href}>
            {inline(link.tokens)}
          </Link>
        );
      }
      return (
        <a key={key} className="link" href={href} rel="noopener noreferrer">
          {inline(link.tokens)}
        </a>
      );
    }
    case "image":
      // Never load an image named in the text. Show its description instead.
      return (token as Tokens.Image).text;
    default:
      // Raw HTML (the "html" token) and anything else we do not list: show as plain text.
      return (token as { raw: string }).raw;
  }
}

export function Markdown({ source }: { source: string }) {
  return <div className="markdown stack">{render(Lexer.lex(source))}</div>;
}
