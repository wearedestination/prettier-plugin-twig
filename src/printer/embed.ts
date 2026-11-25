import { doc, Doc, Printer } from 'prettier';
import { RawMarkupKinds } from '~/parser';
import { hasTwigToken } from '~/printer/utils';
import { TwigHtmlNode, TwigParserOptions, NodeTypes } from '~/types';

// null will pass through
export const ParserMap: { [key in RawMarkupKinds]: string | null } = {
  [RawMarkupKinds.css]: 'css',
  [RawMarkupKinds.html]: null,
  [RawMarkupKinds.javascript]: 'babel',
  [RawMarkupKinds.json]: 'json',
  [RawMarkupKinds.markdown]: 'markdown',
  [RawMarkupKinds.typescript]: 'typescript',
  [RawMarkupKinds.text]: null,
};

export const embed: Printer<TwigHtmlNode>['embed'] = (path, options) => {
  return (textToDoc) => {
    const node = path.node as TwigHtmlNode;
    switch (node.type) {
      case NodeTypes.RawMarkup: {
        // Twig is evaluated before the script runs, but the JS parsers could
        // mistake e.g. {{ output }} for nested blocks and reformat it into
        // broken Twig.
        const isScript =
          node.kind === RawMarkupKinds.javascript ||
          node.kind === RawMarkupKinds.typescript;
        if (
          (isScript || path.parent?.type === NodeTypes.TwigRawTag) &&
          hasTwigToken(node.value)
        ) {
          return undefined;
        }
        const parser = ParserMap[node.kind];
        if (parser && node.value.trim() !== '') {
          return textToDoc(node.value, {
            ...options,
            singleQuote: (options as TwigParserOptions).embeddedSingleQuote,
            parser,
            __embeddedInHtml: true,
          }).then((document) =>
            doc.utils.stripTrailingHardline(document),
          ) as Promise<Doc>;
        }
      }
      default:
        return undefined;
    }
  };
};
