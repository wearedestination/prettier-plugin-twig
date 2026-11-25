import { locEnd, locStart } from '~/utils';
import { toTwigHtmlAST, TwigHtmlNode } from '~/parser/stage-2-ast';

export function parse(text: string): TwigHtmlNode {
  return toTwigHtmlAST(text);
}

export const twigHtmlAstFormat = 'twig-html-ast';

export const twigLanguageName = 'twig';

export const twigHtmlParser = {
  parse,
  astFormat: twigHtmlAstFormat,
  locStart,
  locEnd,
};
