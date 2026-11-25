import { Doc, doc } from 'prettier';
import { hasTwigToken } from '~/printer/utils/string';

// Output tags that are on one line. The end of a tag is the first "}}" that
// isn't inside of a string or a hash.
const twigOutput =
  /\{\{(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\{(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|[^'"{}\n])*\}|[^'"{}\n])*\}\}/g;

// These characters aren't valid in JS outside of strings, template literals,
// regular expressions and comments. So if a Twig tag is in any other place,
// the script doesn't parse once the tag is replaced.
const placeholderStart = '';
const placeholderEnd = '';
const placeholder = /(\d+)_*/g;

const stringLiteral = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

export interface MaskedScript {
  source: string;
  twigOutputs: string[];
}

/**
 * Replaces the Twig output tags of a script with placeholders of the same
 * width. Returns undefined when the script contains any other Twig.
 */
export function maskTwigOutputs(script: string): MaskedScript | undefined {
  if (script.includes(placeholderStart) || script.includes(placeholderEnd)) {
    return undefined;
  }
  const twigOutputs: string[] = [];
  const source = script.replace(twigOutput, (output) => {
    const start = `${placeholderStart}${twigOutputs.length}`;
    twigOutputs.push(output);
    return start.padEnd(output.length - 1, '_') + placeholderEnd;
  });
  return hasTwigToken(source) ? undefined : { source, twigOutputs };
}

/**
 * Puts the Twig output tags back in the formatted script. Returns undefined
 * unless all of them are in string literals.
 *
 * The string literals keep their original quotes, because the output may
 * contain the other kind.
 */
export function unmaskTwigOutputs(
  formatted: Doc,
  { source, twigOutputs }: MaskedScript,
): Doc | undefined {
  const restored = new Set<number>();
  let isSafe = true;

  const restoreLiteral = (literal: string) =>
    withOriginalQuotes(literal, source)?.replace(placeholder, (_, index) => {
      restored.add(Number(index));
      return twigOutputs[Number(index)];
    }) ?? literal;

  const result = doc.utils.mapDoc(formatted, (part) => {
    if (typeof part !== 'string' || !part.includes(placeholderStart)) {
      return part;
    }
    // The part can have more code in it than the literal, e.g. `foo['bar']`.
    const unmasked = part.replace(stringLiteral, (literal) =>
      literal.includes(placeholderStart) ? restoreLiteral(literal) : literal,
    );
    if (unmasked.includes(placeholderStart)) isSafe = false;
    return unmasked;
  });

  return isSafe && restored.size === twigOutputs.length ? result : undefined;
}

// Since the placeholders are unique, a literal that contains one can only be
// found in the source where it came from. If it isn't found, then more than its
// quotes have changed.
function withOriginalQuotes(
  literal: string,
  source: string,
): string | undefined {
  const oppositeQuote = literal[0] === '"' ? "'" : '"';
  const candidates = [
    literal,
    oppositeQuote + literal.slice(1, -1) + oppositeQuote,
  ];
  return candidates.find((candidate) => source.includes(candidate));
}
