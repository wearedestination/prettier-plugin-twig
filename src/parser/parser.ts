import { locEnd, locStart } from '~/utils';
import { toLiquidHtmlAST, LiquidHtmlNode } from '~/parser/stage-2-ast';

export function parse(text: string): LiquidHtmlNode {
  return toLiquidHtmlAST(text);
}

export const liquidHtmlAstFormat = 'liquid-html-ast';

export const twigLanguageName = 'twig';

// Kept as an alias of `twig` for backwards compatibility with configs written
// against the Liquid plugin this one was forked from.
export const liquidHtmlLanguageName = 'liquid-html';

export const liquidHtmlParser = {
  parse,
  astFormat: liquidHtmlAstFormat,
  locStart,
  locEnd,
};
