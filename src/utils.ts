import { Position } from '~/types';

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${(x as any).type}`);
}

export function locStart(node: { position: Position }) {
  return node.position.start;
}

export function locEnd(node: { position: Position }) {
  return node.position.end;
}

export function deepGet<T = any>(path: (string | number)[], obj: any): T {
  return path.reduce((curr: any, k: string | number) => {
    if (curr && curr[k] !== undefined) return curr[k];
    return undefined;
  }, obj);
}

export function dropLast<T>(n: number, xs: readonly T[]) {
  const result = [...xs];
  for (let i = 0; i < n; i++) {
    result.pop();
  }
  return result;
}

let hasWarnedLiquidSingleQuote = false;

/**
 * Resets the deprecation warning state. Only used for testing.
 * @internal
 */
export function resetTwigSingleQuoteWarning(): void {
  hasWarnedLiquidSingleQuote = false;
}

/**
 * Gets the effective twigSingleQuote value, supporting the deprecated liquidSingleQuote option.
 * Shows a deprecation warning once if liquidSingleQuote is used.
 */
export function getTwigSingleQuote(options: {
  twigSingleQuote: boolean;
  liquidSingleQuote?: boolean;
}): boolean {
  // If liquidSingleQuote is explicitly set (not undefined), use it with deprecation warning
  if (options.liquidSingleQuote !== undefined) {
    if (!hasWarnedLiquidSingleQuote) {
      hasWarnedLiquidSingleQuote = true;
      console.warn(
        '[prettier-plugin-twig] The "liquidSingleQuote" option is deprecated. Please use "twigSingleQuote" instead.',
      );
    }
    return options.liquidSingleQuote;
  }
  return options.twigSingleQuote;
}
