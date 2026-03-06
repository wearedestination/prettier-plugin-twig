import {
  LiquidAstPath,
  LiquidHtmlNode,
  LiquidParserOptions,
  Position,
} from '~/types';

export function isWhitespace(source: string, loc: number): boolean {
  if (loc < 0 || loc >= source.length) return false;
  return !!source[loc].match(/\s/);
}

export const trim = (x: string) => x.trim();
export const trimEnd = (x: string) => x.trimEnd();

export function bodyLines(str: string): string[] {
  return str
    .replace(/^(?: |\t)*(\r?\n)*|\s*$/g, '') // only want the meat
    .split(/\r?\n/);
}

export function markupLines(markup: string): string[] {
  return markup.trim().split('\n');
}

export function reindent(lines: string[], skipFirst = false): string[] {
  const minIndentLevel = lines
    .filter((_, i) => (skipFirst ? i > 0 : true))
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (minIndentLevel === Infinity) {
    return lines;
  }

  const indentStrip = new RegExp('^' + '\\s'.repeat(minIndentLevel));
  return lines.map((line) => line.replace(indentStrip, '')).map(trimEnd);
}

export function originallyHadLineBreaks(
  path: LiquidAstPath,
  { locStart, locEnd }: LiquidParserOptions,
): boolean {
  const node = path.getValue();
  return hasLineBreakInRange(node.source, locStart(node), locEnd(node));
}

export function hasLineBreakInRange(
  source: string,
  locStart: number,
  locEnd: number,
): boolean {
  const indexOfNewLine = source.indexOf('\n', locStart);
  return 0 <= indexOfNewLine && indexOfNewLine < locEnd;
}

export function hasMoreThanOneNewLineBetweenNodes(
  source: string,
  prev: { position: Position } | undefined,
  next: { position: Position } | undefined,
): boolean {
  if (!prev || !next) return false;
  const between = source.slice(prev.position.end, next.position.start);
  const count = between.match(/\n/g)?.length || 0;
  return count > 1;
}

/**
 * Transforms quotes in base case markup strings based on the twigSingleQuote option.
 * This handles cases where the parser falls back to storing markup as a raw string
 * (e.g., Twig function calls like `stimulus_controller('controller-name')`).
 *
 * The function replaces quotes while being careful to:
 * - Not replace quotes that are escaped
 * - Not replace quotes inside strings that contain the target quote character
 * - Handle nested quotes properly
 */
export function transformStringQuotes(
  markup: string,
  twigSingleQuote: boolean,
): string {
  const preferredQuote = twigSingleQuote ? "'" : '"';

  // Match strings with the non-preferred quote style
  // This regex matches quoted strings, being careful about escapes
  const stringRegex = twigSingleQuote
    ? /"([^"\\]|\\.)*"/g // Match double-quoted strings
    : /'([^'\\]|\\.)*'/g; // Match single-quoted strings

  return markup.replace(stringRegex, (match) => {
    // Get the content without the outer quotes
    const content = match.slice(1, -1);

    // If the content contains the preferred quote (unescaped), keep original quotes
    // to avoid breaking the string
    if (content.includes(preferredQuote)) {
      return match;
    }

    // Replace the quotes
    return preferredQuote + content + preferredQuote;
  });
}
