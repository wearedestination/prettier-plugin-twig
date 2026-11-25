import { doc, Doc } from 'prettier';
import type { Printer } from 'prettier';
import {
  AttrDoubleQuoted,
  AttrEmpty,
  AttrSingleQuoted,
  AttrUnquoted,
  DocumentNode,
  HtmlDanglingMarkerClose,
  HtmlDanglingMarkerOpen,
  HtmlElement,
  HtmlRawNode,
  HtmlSelfClosingElement,
  HtmlVoidElement,
  TwigAstPath,
  TwigBranch,
  TwigDrop,
  TwigExpression,
  TwigHtmlNode,
  TwigParserOptions,
  TwigPrinter,
  TwigPrinterArgs,
  TwigRawTag,
  TwigTag,
  NodeTypes,
  Position,
  TextNode,
  nonTraversableProperties,
  AstPath,
} from '~/types';
import { assertNever } from '~/utils';

import { preprocess } from '~/printer/print-preprocess';
import {
  bodyLines,
  hasLineBreakInRange,
  isEmpty,
  reindent,
} from '~/printer/utils';
import { printElement } from '~/printer/print/element';
import {
  printClosingTagSuffix,
  printOpeningTagPrefix,
} from '~/printer/print/tag';
import {
  printTwigBranch,
  printTwigDrop,
  printTwigRawTag,
  printTwigTag,
} from '~/printer/print/twig';
import { printChildren } from '~/printer/print/children';
import { embed } from '~/printer/embed';
import { RawMarkupKinds } from '~/parser';
import { getConditionalComment } from '~/parser/conditional-comment';

const { builders, utils } = doc;
const { fill, group, hardline, indent, join, line, literalline, softline } =
  builders;
const { replaceEndOfLine } = utils as any;

/**
 * Reindenting the inside of a template literal would change its contents. The
 * lines before the first backtick and after the last one are always outside,
 * but what's in between is only known when there are exactly two backticks.
 */
function printScriptWithTemplateLiterals(source: string): Doc {
  const startsOnTagLine = /^[ \t]*\S/.test(source);
  const body = startsOnTagLine
    ? source.trim()
    : source.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd();
  const lines = body.split(/\r?\n/);
  const linesWithBacktick = lines
    .map((line, i) => (line.includes('`') ? i : -1))
    .filter((i) => i !== -1);
  const first = linesWithBacktick[0];
  const last = linesWithBacktick[linesWithBacktick.length - 1];

  if (first !== last && body.split('`').length - 1 !== 2) {
    // Keep every line where it was, so that they remain aligned.
    return [startsOnTagLine ? '' : builders.trim, replaceEndOfLine(body)];
  }

  const isInsideLiteral = (i: number) => i > first && i <= last;
  const minIndentLevel = lines
    .filter((_, i) => !isInsideLiteral(i) && !(startsOnTagLine && i === 0))
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  return lines.map((line, i) => {
    if (isInsideLiteral(i)) return [literalline, line];
    const isBlank = line.trim() === '';
    const reindented =
      isBlank || (startsOnTagLine && i === 0)
        ? line.trimStart()
        : line.slice(minIndentLevel);
    return i === 0 ? reindented : [hardline, reindented];
  });
}

const oppositeQuotes = {
  '"': "'",
  "'": '"',
};

function printAttributeName(
  path: AstPath<AttrEmpty | AttrSingleQuoted | AttrUnquoted | AttrDoubleQuoted>,
  _options: TwigParserOptions,
  print: TwigPrinter,
): Doc {
  const node = path.getValue();
  node.name;
  return join(
    '',
    (path as any).map((part: AstPath<string | TwigDrop | TwigTag>) => {
      const value = part.getValue();
      if (typeof value === 'string') {
        return value;
      } else {
        // We want to force the Twig node to be on one line to avoid weird
        // shenanigans
        return utils.removeLines(print(part as AstPath<TwigDrop | TwigTag>));
      }
    }, 'name'),
  );
}

/**
 * Picks the delimiter to wrap an attribute value with.
 *
 * `value` is the raw source slice we're about to print, so it may contain
 * quotes that live inside Twig drops or tags. We can't escape those (the
 * escape would end up in the Twig expression), so the best we can do is pick
 * the delimiter that doesn't appear in the value.
 *
 * When the value contains both quote characters there is no safe delimiter.
 * Rather than pick one and break the value, we keep whatever the author wrote
 * and leave it to them.
 */
function chooseAttributeQuote(
  node: Extract<TwigHtmlNode, { attributePosition: Position }>,
  value: string,
  options: TwigParserOptions,
): string {
  const preferredQuote = options.singleQuote ? `'` : `"`;
  const otherQuote = oppositeQuotes[preferredQuote];

  if (!value.includes(preferredQuote)) return preferredQuote;
  if (!value.includes(otherQuote)) return otherQuote;

  switch (node.type) {
    case NodeTypes.AttrSingleQuoted:
      return `'`;
    case NodeTypes.AttrDoubleQuoted:
      return `"`;
    default:
      return preferredQuote;
  }
}

function printAttribute<
  T extends Extract<TwigHtmlNode, { attributePosition: Position }>,
>(path: AstPath<T>, options: TwigParserOptions, print: TwigPrinter): Doc {
  const node = path.getValue();
  const attrGroupId = Symbol('attr-group-id');
  // What should be the rule here? Should it really be "paragraph"?
  // ideally... if the thing is and the line is too long
  // use cases:
  //  - attr-{{ section.id }}--something.
  //  * We should try to put that "block" on one line
  //
  //  - attr {{ classname }} foo
  //  * we should try to put on one line?
  //
  //  - attr hello world ok fellow friends what do
  //  * if the line becomes too long do we want to break one per line?
  //    - for alt, would be paragraph
  //    - for classes, yeah maybe
  //    - for srcset?, it should be "split on comma"
  //    - for sizes?, it should be "split on comma"
  //    - for href?, it should be no space url
  //    - for others?, it should be keywords
  //    - for style, should be break on ;
  //    - for other?, should be...
  //    - how the fuck am I going to do that?
  //    - same way we do this? with a big ass switch case?
  //    - or we... don't and leave it as is?
  //
  // Anyway, for that reason ^, for now I'll just paste in what we have in
  // the source. It's too hard to get right.

  const value = node.source.slice(
    node.attributePosition.start,
    node.attributePosition.end,
  );
  // We print `value` verbatim — Twig drops and tags included — so the
  // delimiter has to be chosen against that entire string, not just the
  // text-like parts of it. A quote inside `{{ … }}` closes the attribute in
  // any HTML parser that reads the template without rendering it.
  const quote = chooseAttributeQuote(node, value, options);

  return [
    printAttributeName(path, options, print),
    '=',
    quote,
    hasLineBreakInRange(
      node.source,
      node.attributePosition.start,
      node.attributePosition.end,
    )
      ? group(
          [
            indent([
              softline,
              join(hardline, reindent(bodyLines(value), true)),
            ]),
            softline,
          ],
          { id: attrGroupId },
        )
      : value,
    quote,
  ];
}

function isYamlFrontMatter(node: TextNode) {
  return (
    node.parentNode &&
    node.parentNode.type === NodeTypes.Document &&
    !node.prev &&
    /^---\r?\n/.test(node.value)
  );
}

function printTextNode(
  path: AstPath<TextNode>,
  options: TwigParserOptions,
  _print: TwigPrinter,
) {
  const node = path.getValue();

  if (isYamlFrontMatter(node)) return node.value;

  if (node.value.match(/^\s*$/)) return '';
  const text = node.value;

  const paragraphs = text
    .split(/(\r?\n){2,}/)
    .filter(Boolean) // removes empty paragraphs (trailingWhitespace)
    .map((curr) => {
      let doc = [];
      const words = curr.trim().split(/\s+/g);
      let isFirst = true;
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        if (isFirst) {
          isFirst = false;
        } else {
          doc.push(line);
        }
        doc.push(word);
      }
      return fill(doc);
    });

  return [
    printOpeningTagPrefix(node, options),
    join(hardline, paragraphs),
    printClosingTagSuffix(node, options),
  ];
}

function printNode(
  path: TwigAstPath,
  options: TwigParserOptions,
  print: TwigPrinter,
  args: TwigPrinterArgs = {},
): Doc {
  const node = path.getValue();
  switch (node.type) {
    case NodeTypes.Document: {
      return [
        printChildren(path as AstPath<DocumentNode>, options, print, args),
        hardline,
      ];
    }

    case NodeTypes.HtmlElement: {
      return printElement(path as AstPath<HtmlElement>, options, print, args);
    }

    case NodeTypes.HtmlDanglingMarkerOpen: {
      return printElement(
        path as AstPath<HtmlDanglingMarkerOpen>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlDanglingMarkerClose: {
      return printElement(
        path as AstPath<HtmlDanglingMarkerClose>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlVoidElement: {
      return printElement(
        path as AstPath<HtmlVoidElement>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlSelfClosingElement: {
      return printElement(
        path as AstPath<HtmlSelfClosingElement>,
        options,
        print,
        args,
      );
    }

    case NodeTypes.HtmlRawNode: {
      return printElement(path as AstPath<HtmlRawNode>, options, print, args);
    }

    case NodeTypes.RawMarkup: {
      const isRawMarkupIdentationSensitive = () => {
        switch (node.kind) {
          case RawMarkupKinds.typescript:
          case RawMarkupKinds.javascript: {
            return node.value.includes('`');
          }
          default: {
            return false;
          }
        }
      };

      if (isRawMarkupIdentationSensitive()) {
        return printScriptWithTemplateLiterals(node.value);
      }

      const lines = bodyLines(node.value);

      const rawFirstLineIsntIndented = !!node.value
        .split(/\r?\n/)[0]
        ?.match(/\S/);
      const shouldSkipFirstLine = rawFirstLineIsntIndented;

      return lines.length > 0 && lines.find((line) => line.trim() !== '')
        ? join(hardline, reindent(lines, shouldSkipFirstLine))
        : softline;
    }

    case NodeTypes.TwigDrop: {
      return printTwigDrop(path as AstPath<TwigDrop>, options, print, args);
    }

    case NodeTypes.TwigRawTag: {
      return printTwigRawTag(path as AstPath<TwigRawTag>, options, print, args);
    }

    case NodeTypes.TwigTag: {
      return printTwigTag(path as AstPath<TwigTag>, options, print, args);
    }

    case NodeTypes.TwigBranch: {
      return printTwigBranch(path as AstPath<TwigBranch>, options, print, args);
    }

    case NodeTypes.AttrEmpty: {
      return printAttributeName(path as AstPath<AttrEmpty>, options, print);
    }

    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrSingleQuoted:
    case NodeTypes.AttrDoubleQuoted: {
      return printAttribute(
        path as AstPath<AttrUnquoted | AttrSingleQuoted | AttrDoubleQuoted>,
        options,
        print,
      );
    }

    case NodeTypes.HtmlDoctype: {
      if (!node.legacyDoctypeString) return '<!doctype html>';
      return node.source.slice(node.position.start, node.position.end);
    }

    case NodeTypes.HtmlComment: {
      const conditionalComment = getConditionalComment(
        node.source.slice(node.position.start, node.position.end),
      );
      if (conditionalComment) {
        const { startTag, body, endTag } = conditionalComment;
        return [
          startTag,
          group([
            indent([line, join(hardline, reindent(bodyLines(body), true))]),
            line,
          ]),
          endTag,
        ];
      }
      if (
        node.body.includes('prettier-ignore') ||
        node.body.startsWith('display:') ||
        node.body.startsWith('white-space:')
      ) {
        return node.source.slice(node.position.start, node.position.end);
      }
      return [
        '<!--',
        group([
          indent([line, join(hardline, reindent(bodyLines(node.body), true))]),
          line,
        ]),
        '-->',
      ];
    }

    case NodeTypes.ForMarkup: {
      const doc = [node.variableName, ' in ', path.call(print, 'collection')];

      if (node.reversed) {
        doc.push(line, 'reversed');
      }

      if (node.args.length > 0) {
        doc.push([
          line,
          join(
            line,
            path.map((p) => print(p), 'args'),
          ),
        ]);
      }

      return doc;
    }

    case NodeTypes.IncludeMarkup: {
      const template = path.call(print, 'template');
      const doc: Doc = [template];
      if (node.variable) {
        const whitespace = node.alias ? line : ' ';
        doc.push(whitespace, path.call(print, 'variable'));
      }
      if (node.alias) {
        doc.push(' ', 'as', ' ', node.alias);
      }
      if (node.args.length > 0) {
        doc.push(
          ',',
          line,
          join(
            [',', line],
            path.map((p) => print(p), 'args'),
          ),
        );
      }
      return doc;
    }

    case NodeTypes.IncludeVariableExpression: {
      return [node.kind, ' ', path.call(print, 'name')];
    }

    case NodeTypes.LogicalExpression: {
      return [
        path.call(print, 'left'),
        line,
        node.relation,
        ' ',
        path.call(print, 'right'),
      ];
    }

    case NodeTypes.Comparison: {
      return group([
        path.call(print, 'left'),
        indent([line, node.comparator, ' ', path.call(print, 'right')]),
      ]);
    }

    case NodeTypes.TwigVariable: {
      const name = path.call(print, 'expression');
      let filters: Doc = '';
      if (node.filters.length > 0) {
        filters = [
          line,
          join(
            line,
            path.map((p) => print(p), 'filters'),
          ),
        ];
      }
      return [name, filters];
    }

    case NodeTypes.TwigFilter: {
      let args: Doc[] = [];

      if (node.args.length > 0) {
        const printed = path.map((p) => print(p), 'args');
        const shouldPrintFirstArgumentSameLine =
          node.args[0].type !== NodeTypes.NamedArgument;

        if (shouldPrintFirstArgumentSameLine) {
          const [firstDoc, ...rest] = printed;
          const restDoc = isEmpty(rest)
            ? ''
            : indent([',', line, join([',', line], rest)]);
          args = [': ', firstDoc, restDoc];
        } else {
          args = [':', indent([line, join([',', line], printed)])];
        }
      }

      return group(['| ', node.name, ...args]);
    }

    case NodeTypes.NamedArgument: {
      return [node.name, ': ', path.call(print, 'value')];
    }

    case NodeTypes.TextNode: {
      return printTextNode(path as AstPath<TextNode>, options, print);
    }

    case NodeTypes.YAMLFrontmatter: {
      return ['---', hardline, node.body, '---'];
    }

    case NodeTypes.String: {
      const preferredQuote = options.twigSingleQuote ? `'` : `"`;
      const valueHasQuotes = node.value.includes(preferredQuote);
      const quote = valueHasQuotes
        ? oppositeQuotes[preferredQuote]
        : preferredQuote;
      return [quote, node.value, quote];
    }

    case NodeTypes.Number: {
      if (args.truncate) {
        return node.value.replace(/\.\d+$/, '');
      } else {
        return node.value;
      }
    }

    case NodeTypes.Range: {
      return [
        '(',
        path.call((p) => print(p, { truncate: true }), 'start'),
        '..',
        path.call((p) => print(p, { truncate: true }), 'end'),
        ')',
      ];
    }

    case NodeTypes.TwigLiteral: {
      // We prefer null over nil.
      if (node.keyword === 'nil') {
        return 'null';
      }
      return node.keyword;
    }

    case NodeTypes.VariableLookup: {
      const doc: Doc[] = [];
      if (node.name) {
        doc.push(node.name);
      }
      const lookups: Doc[] = path.map((lookupPath, index) => {
        const lookup = lookupPath.getValue() as TwigExpression;
        switch (lookup.type) {
          case NodeTypes.String: {
            const value = lookup.value;
            // We prefer direct access
            // (for everything but stuff with dashes)
            const isGlobalStringLookup = index === 0 && !node.name;
            if (!isGlobalStringLookup && /^[a-z0-9_]+\??$/i.test(value)) {
              return ['.', value];
            }
            return ['[', print(lookupPath), ']'];
          }
          default: {
            return ['[', print(lookupPath), ']'];
          }
        }
      }, 'lookups');
      return [...doc, ...lookups];
    }

    default: {
      return assertNever(node);
    }
  }
}

export const printerTwigHtml: Printer<TwigHtmlNode> & {
  preprocess: any;
} & { getVisitorKeys: any } = {
  print: printNode as any,
  embed,
  preprocess,
  getVisitorKeys(node: any, nonTraversableKeys: Set<string>) {
    return Object.keys(node).filter(
      (key) =>
        !nonTraversableKeys.has(key) && !nonTraversableProperties.has(key),
    );
  },
};
