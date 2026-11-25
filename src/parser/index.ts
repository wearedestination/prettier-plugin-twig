import {
  twigHtmlParser,
  twigHtmlAstFormat,
  twigLanguageName,
} from '~/parser/parser';

export * from '~/parser/stage-2-ast';

export { twigLanguageName, twigHtmlAstFormat };

export const parsers = {
  [twigLanguageName]: twigHtmlParser,
};
