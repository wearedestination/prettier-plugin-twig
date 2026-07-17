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
 * Scans the markup left to right, tracking open-string state, so only
 * top-level string literals of the non-preferred quote style are converted.
 * A quote of the other style nested inside an open string is content, not a
 * string literal, and must be left alone. A conversion is skipped when the
 * string's content contains the preferred quote, a backslash escape, or
 * `#{` interpolation — any of which would change the string's meaning under
 * the new quote style (Twig evaluates `#{…}` only inside double quotes).
 */
export function transformStringQuotes(
  markup: string,
  twigSingleQuote: boolean,
): string {
  const preferredQuote = twigSingleQuote ? "'" : '"';

  let result = '';
  let i = 0;
  while (i < markup.length) {
    const char = markup[i];
    if (char !== "'" && char !== '"') {
      result += char;
      i++;
      continue;
    }

    // Scan to the closing quote, honoring backslash escapes
    let j = i + 1;
    while (j < markup.length && markup[j] !== char) {
      if (markup[j] === '\\') j++;
      j++;
    }

    if (j >= markup.length) {
      // Unterminated string: copy the rest verbatim
      result += markup.slice(i);
      break;
    }

    const content = markup.slice(i + 1, j);
    const isConvertible =
      char !== preferredQuote &&
      !content.includes(preferredQuote) &&
      !content.includes('\\') &&
      !content.includes('#{');
    result += isConvertible
      ? preferredQuote + content + preferredQuote
      : markup.slice(i, j + 1);
    i = j + 1;
  }
  return result;
}
