import {
  liquidHtmlParser,
  liquidHtmlAstFormat,
  liquidHtmlLanguageName,
  twigLanguageName,
} from '~/parser/parser';

export * from '~/parser/stage-2-ast';

export { twigLanguageName, liquidHtmlLanguageName, liquidHtmlAstFormat };

export const parsers = {
  [twigLanguageName]: liquidHtmlParser,
  [liquidHtmlLanguageName]: liquidHtmlParser,
};
