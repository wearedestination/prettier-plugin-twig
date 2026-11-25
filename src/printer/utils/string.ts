import { TwigAstPath, TwigParserOptions, Position } from '~/types';

export function isWhitespace(source: string, loc: number): boolean {
  if (loc < 0 || loc >= source.length) return false;
  return !!source[loc].match(/\s/);
}

export function hasTwigToken(source: string): boolean {
  return /\{[{%#]/.test(source);
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
  path: TwigAstPath,
  { locStart, locEnd }: TwigParserOptions,
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
 * Whether a Twig string literal keeps its meaning when its delimiters are
 * replaced with `quote`.
 *
 * It doesn't when its content contains that quote, a backslash escape, or `#{`
 * interpolation (Twig evaluates `#{…}` only inside double quotes).
 */
export function canUseQuote(content: string, quote: string): boolean {
  return (
    !content.includes(quote) &&
    !content.includes('\\') &&
    !content.includes('#{')
  );
}

/**
 * Returns the index of the quote that closes the string literal opened at
 * `start`, or -1 if the string is unterminated.
 *
 * Quotes inside of the `#{…}` interpolations of a double-quoted string belong
 * to the interpolated expression, they don't close the string.
 */
function findStringEnd(markup: string, start: number): number {
  const quote = markup[start];
  let i = start + 1;
  while (i < markup.length) {
    if (markup[i] === '\\') {
      i += 2;
    } else if (markup[i] === quote) {
      return i;
    } else if (quote === '"' && markup.startsWith('#{', i)) {
      const interpolationEnd = findInterpolationEnd(markup, i + 1);
      if (interpolationEnd === -1) return -1;
      i = interpolationEnd + 1;
    } else {
      i++;
    }
  }
  return -1;
}

/**
 * Returns the index of the brace that closes the one opened at `start`, or -1
 * if there isn't one.
 */
function findInterpolationEnd(markup: string, start: number): number {
  let depth = 0;
  for (let i = start; i < markup.length; i++) {
    switch (markup[i]) {
      case '{':
        depth++;
        break;
      case '}':
        depth--;
        if (depth === 0) return i;
        break;
      case "'":
      case '"':
        i = findStringEnd(markup, i);
        if (i === -1) return -1;
        break;
    }
  }
  return -1;
}

/**
 * Transforms quotes in base case markup strings based on the twigSingleQuote option.
 * This handles cases where the parser falls back to storing markup as a raw string
 * (e.g., Twig function calls like `stimulus_controller('controller-name')`).
 *
 * Scans the markup left to right, tracking open-string state, so only
 * top-level string literals of the non-preferred quote style are converted.
 * A quote nested inside an open string is content, not a string literal, and
 * must be left alone. Strings whose meaning depends on their quotes are left
 * alone too (see canUseQuote).
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

    const end = findStringEnd(markup, i);
    if (end === -1) {
      // Unterminated string: copy the rest verbatim
      result += markup.slice(i);
      break;
    }

    const content = markup.slice(i + 1, end);
    result += canUseQuote(content, preferredQuote)
      ? preferredQuote + content + preferredQuote
      : markup.slice(i, end + 1);
    i = end + 1;
  }
  return result;
}
