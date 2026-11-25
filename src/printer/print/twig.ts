import { Doc, doc } from 'prettier';
import {
  AstPath,
  TwigAstPath,
  TwigBranch,
  TwigDrop,
  TwigParserOptions,
  TwigPrinter,
  TwigPrinterArgs,
  TwigTag,
  TwigTagNamed,
  TwigBranchNamed,
  NamedTags,
  NodeTypes,
  TwigRawTag,
} from '~/types';
import { isBranchedTag } from '~/parser/stage-2-ast';
import { assertNever } from '~/utils';

import {
  getWhitespaceTrim,
  hasMeaningfulLackOfLeadingWhitespace,
  hasMeaningfulLackOfTrailingWhitespace,
  hasMeaningfulLackOfDanglingWhitespace,
  isDeeplyNested,
  isEmpty,
  markupLines,
  originallyHadLineBreaks,
  reindent,
  trim,
  hasLineBreakInRange,
  isAttributeNode,
  shouldPreserveContent,
  FORCE_FLAT_GROUP_ID,
  last,
  transformStringQuotes,
} from '~/printer/utils';

import { printChildren } from '~/printer/print/children';

const TWIG_TAGS_THAT_ALWAYS_BREAK = ['for'];

const { builders } = doc;
const { group, hardline, ifBreak, indent, join, line, softline, literalline } =
  builders;
const { replaceEndOfLine } = doc.utils as any;

export function printTwigDrop(
  path: TwigAstPath,
  options: TwigParserOptions,
  print: TwigPrinter,
  { leadingSpaceGroupId, trailingSpaceGroupId }: TwigPrinterArgs,
) {
  const node: TwigDrop = path.getValue() as TwigDrop;
  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    hasMeaningfulLackOfLeadingWhitespace(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    hasMeaningfulLackOfTrailingWhitespace(node),
    trailingSpaceGroupId,
  );

  if (typeof node.markup !== 'string') {
    const whitespace = node.markup.filters.length > 0 ? line : ' ';
    return group([
      '{{',
      whitespaceStart,
      indent([whitespace, path.call(print, 'markup')]),
      whitespace,
      whitespaceEnd,
      '}}',
    ]);
  }

  // Transform quotes in base case markup based on twigSingleQuote option
  const markup = transformStringQuotes(node.markup, options.twigSingleQuote);

  // This should probably be better than this but it'll do for now.
  const lines = markupLines(markup);
  if (lines.length > 1) {
    return group([
      '{{',
      whitespaceStart,
      indent([hardline, join(hardline, lines.map(trim))]),
      hardline,
      whitespaceEnd,
      '}}',
    ]);
  }

  return group(['{{', whitespaceStart, ' ', markup, ' ', whitespaceEnd, '}}']);
}

function printNamedTwigBlockStart(
  path: AstPath<TwigTagNamed | TwigBranchNamed>,
  _options: TwigParserOptions,
  print: TwigPrinter,
  args: TwigPrinterArgs,
  whitespaceStart: Doc,
  whitespaceEnd: Doc,
): Doc {
  const node = path.getValue();
  const prefix = ['{%', whitespaceStart, ' '];
  const suffix = (trailingWhitespace: Doc) => [
    trailingWhitespace,
    whitespaceEnd,
    '%}',
  ];

  const tag = (trailingWhitespace: Doc) =>
    group([
      ...prefix,
      node.name,
      ' ',
      indent(path.call((p) => print(p, args), 'markup')),
      ...suffix(trailingWhitespace),
    ]);

  switch (node.name) {
    case NamedTags.include: {
      const markup = node.markup;
      const trailingWhitespace =
        markup.args.length > 0 || (markup.variable && markup.alias)
          ? line
          : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.for: {
      const trailingWhitespace =
        node.markup.reversed || node.markup.args.length > 0 ? line : ' ';
      return tag(trailingWhitespace);
    }

    case NamedTags.if:
    case NamedTags.elseif: {
      const trailingWhitespace = [
        NodeTypes.Comparison,
        NodeTypes.LogicalExpression,
      ].includes(node.markup.type)
        ? line
        : ' ';
      return tag(trailingWhitespace);
    }

    default: {
      return assertNever(node);
    }
  }
}

export function printTwigBlockStart(
  path: AstPath<TwigTag | TwigBranch>,
  options: TwigParserOptions,
  print: TwigPrinter,
  args: TwigPrinterArgs = {},
): Doc {
  const node = path.getValue();
  const { leadingSpaceGroupId, trailingSpaceGroupId } = args;

  if (!node.name) return '';

  const whitespaceStart = getWhitespaceTrim(
    node.whitespaceStart,
    needsBlockStartLeadingWhitespaceStrippingOnBreak(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.whitespaceEnd,
    needsBlockStartTrailingWhitespaceStrippingOnBreak(node),
    trailingSpaceGroupId,
  );

  if (typeof node.markup !== 'string') {
    return printNamedTwigBlockStart(
      path as AstPath<TwigTagNamed | TwigBranchNamed>,
      options,
      print,
      args,
      whitespaceStart,
      whitespaceEnd,
    );
  }

  // For Twig comments ({# ... #}), don't transform quotes - comments should be preserved as-is
  if (node.name === 'twig') {
    const lines = markupLines(node.markup);
    // Keep the comment multi-line when the author wrote it that way, so `#}`
    // stays on its own line. Empty comments still collapse to `{# #}`.
    const isMultiline =
      node.markup.trim() !== '' && originallyHadLineBreaks(path, options);
    if (isMultiline) {
      return group([
        '{#',
        whitespaceStart,
        indent([hardline, join(hardline, lines.map(trim))]),
        hardline,
        whitespaceEnd,
        '#}',
      ]);
    }

    return group([
      '{#',
      whitespaceStart,
      node.markup ? ` ${node.markup}` : '',
      ' ',
      whitespaceEnd,
      '#}',
    ]);
  }

  // Transform quotes in base case markup based on twigSingleQuote option
  const transformedMarkup = transformStringQuotes(
    node.markup,
    options.twigSingleQuote,
  );
  const lines = markupLines(transformedMarkup);

  if (lines.length > 1) {
    const reindentedLines = reindent(lines, true);
    return group([
      '{%',
      whitespaceStart,
      indent([hardline, node.name, ' ', join(hardline, reindentedLines)]),
      hardline,
      whitespaceEnd,
      '%}',
    ]);
  }

  return group([
    '{%',
    whitespaceStart,
    ' ',
    node.name,
    transformedMarkup ? ` ${transformedMarkup}` : '',
    ' ',
    whitespaceEnd,
    '%}',
  ]);
}

export function printTwigBlockEnd(
  path: AstPath<TwigTag>,
  _options: TwigParserOptions,
  _print: TwigPrinter,
  args: TwigPrinterArgs = {},
): Doc {
  const node = path.getValue();
  const { leadingSpaceGroupId, trailingSpaceGroupId } = args;
  if (!node.children || !node.blockEndPosition) return '';
  const whitespaceStart = getWhitespaceTrim(
    node.delimiterWhitespaceStart ?? '',
    needsBlockEndLeadingWhitespaceStrippingOnBreak(node),
    leadingSpaceGroupId,
  );
  const whitespaceEnd = getWhitespaceTrim(
    node.delimiterWhitespaceEnd ?? '',
    hasMeaningfulLackOfTrailingWhitespace(node),
    trailingSpaceGroupId,
  );
  return group([
    '{%',
    whitespaceStart,
    ` end${node.name} `,
    whitespaceEnd,
    '%}',
  ]);
}

function getNodeContent(node: TwigTag) {
  if (!node.children || !node.blockEndPosition) return '';
  return node.source.slice(
    node.blockStartPosition.end,
    node.blockEndPosition.start,
  );
}

export function printTwigTag(
  path: AstPath<TwigTag>,
  options: TwigParserOptions,
  print: TwigPrinter,
  args: TwigPrinterArgs,
): Doc {
  const { leadingSpaceGroupId, trailingSpaceGroupId } = args;
  const node = path.getValue();
  if (!node.children || !node.blockEndPosition) {
    return printTwigBlockStart(path, options, print, args);
  }

  if (shouldPreserveContent(node)) {
    return [
      printTwigBlockStart(path, options, print, {
        ...args,
        leadingSpaceGroupId,
        trailingSpaceGroupId: FORCE_FLAT_GROUP_ID,
      }),
      ...replaceEndOfLine(getNodeContent(node)),
      printTwigBlockEnd(path, options, print, {
        ...args,
        leadingSpaceGroupId: FORCE_FLAT_GROUP_ID,
        trailingSpaceGroupId,
      }),
    ];
  }

  const tagGroupId = Symbol('tag-group');
  const blockStart = printTwigBlockStart(path, options, print, {
    ...args,
    leadingSpaceGroupId,
    trailingSpaceGroupId: tagGroupId,
  }); // {% if ... %}
  const blockEnd = printTwigBlockEnd(path, options, print, {
    ...args,
    leadingSpaceGroupId: tagGroupId,
    trailingSpaceGroupId,
  }); // {% endif %}

  let body: Doc = [];

  if (isBranchedTag(node)) {
    body = cleanDoc(
      path.map(
        (p) =>
          print(p, {
            ...args,
            leadingSpaceGroupId: tagGroupId,
            trailingSpaceGroupId: tagGroupId,
          }),
        'children',
      ),
    );
  } else if (node.children.length > 0) {
    body = indent([
      innerLeadingWhitespace(node),
      printChildren(path, options, print, {
        ...args,
        leadingSpaceGroupId: tagGroupId,
        trailingSpaceGroupId: tagGroupId,
      }),
    ]);
  }

  return group([blockStart, body, innerTrailingWhitespace(node), blockEnd], {
    id: tagGroupId,
    shouldBreak:
      TWIG_TAGS_THAT_ALWAYS_BREAK.includes(node.name) ||
      originallyHadLineBreaks(path, options) ||
      isAttributeNode(node) ||
      isDeeplyNested(node),
  });
}

export function printTwigRawTag(
  path: AstPath<TwigRawTag>,
  _options: TwigParserOptions,
  print: TwigPrinter,
  _args: TwigPrinterArgs,
): Doc {
  let body: Doc = [];
  const node = path.getValue();
  const hasEmptyBody = node.body.value.trim() === '';
  const shouldPrintAsIs =
    node.isIndentationSensitive ||
    !hasLineBreakInRange(
      node.source,
      node.body.position.start,
      node.body.position.end,
    );
  const blockStart = group([
    '{%',
    node.whitespaceStart,
    ' ',
    node.name,
    ' ',
    node.markup ? `${node.markup} ` : '',
    node.whitespaceEnd,
    '%}',
  ]);
  const blockEnd = [
    '{%',
    node.delimiterWhitespaceStart,
    ' ',
    'end',
    node.name,
    ' ',
    node.delimiterWhitespaceEnd,
    '%}',
  ];

  if (shouldPrintAsIs) {
    body = [
      node.source.slice(
        node.blockStartPosition.end,
        node.blockEndPosition.start,
      ),
    ];
  } else if (hasEmptyBody) {
    body = [hardline];
  } else {
    body = [indent([hardline, path.call(print, 'body')]), hardline];
  }

  return [blockStart, ...body, blockEnd];
}

function innerLeadingWhitespace(node: TwigTag | TwigBranch) {
  if (!node.firstChild) {
    if (node.isDanglingWhitespaceSensitive && node.hasDanglingWhitespace) {
      return line;
    } else {
      return '';
    }
  }

  if (
    node.firstChild.hasLeadingWhitespace &&
    node.firstChild.isLeadingWhitespaceSensitive
  ) {
    return line;
  }

  return softline;
}

function innerTrailingWhitespace(node: TwigTag | TwigBranch) {
  if (
    shouldPreserveContent(node) ||
    node.type === NodeTypes.TwigBranch ||
    !node.blockEndPosition ||
    !node.lastChild
  ) {
    return '';
  }

  if (
    node.lastChild.hasTrailingWhitespace &&
    node.lastChild.isTrailingWhitespaceSensitive
  ) {
    return line;
  }

  return softline;
}

function printTwigDefaultBranch(
  path: AstPath<TwigBranch>,
  options: TwigParserOptions,
  print: TwigPrinter,
  args: TwigPrinterArgs,
): Doc {
  const branch = path.getValue();
  const parentNode: TwigTag = path.getParentNode() as any;

  // When the node is empty and the parent is empty. The space will come
  // from the trailingWhitespace of the parent. When this happens, we don't
  // want the branch to print another one so we collapse it.
  // e.g. {% if A %} {% endif %}
  const shouldCollapseSpace =
    isEmpty(branch.children) && parentNode.children!.length === 1;
  if (shouldCollapseSpace) return '';

  // When the branch is empty and doesn't have whitespace, we don't want
  // anything so print nothing.
  // e.g. {% if A %}{% endif %}
  // e.g. {% if A %}{% else %}...{% endif %}
  const isBranchEmptyWithoutSpace =
    isEmpty(branch.children) && !branch.hasDanglingWhitespace;
  if (isBranchEmptyWithoutSpace) return '';

  // If the branch does not break, is empty and had whitespace, we might
  // want a space in there. We don't collapse those because the trailing
  // whitespace does not come from the parent.
  // {% if A %} {% else %}...{% endif %}
  if (branch.hasDanglingWhitespace) {
    return ifBreak('', ' ');
  }

  const shouldAddTrailingNewline =
    branch.next &&
    branch.children.length > 0 &&
    branch.source
      .slice(last(branch.children).position.end, branch.next.position.start)
      .replace(/ |\t/g, '').length >= 2;

  // Otherwise print the branch as usual
  // {% if A %} content...{% endif %}
  return indent([
    innerLeadingWhitespace(parentNode),
    printChildren(path, options, print, args),
    shouldAddTrailingNewline ? literalline : '',
  ]);
}

export function printTwigBranch(
  path: AstPath<TwigBranch>,
  options: TwigParserOptions,
  print: TwigPrinter,
  args: TwigPrinterArgs,
): Doc {
  const branch = path.getValue();
  const isDefaultBranch = !branch.name;

  if (isDefaultBranch) {
    return printTwigDefaultBranch(path, options, print, args);
  }

  const leftSibling = branch.prev as TwigBranch | undefined;

  // When the left sibling is empty, its trailing whitespace is its leading
  // whitespace. So we should collapse it here and ignore it.
  const shouldCollapseSpace = leftSibling && isEmpty(leftSibling.children);
  const outerLeadingWhitespace =
    branch.hasLeadingWhitespace && !shouldCollapseSpace ? line : softline;
  const shouldAddTrailingNewline =
    branch.next &&
    branch.children.length > 0 &&
    branch.source
      .slice(last(branch.children).position.end, branch.next.position.start)
      .replace(/ |\t/g, '').length >= 2;

  return [
    outerLeadingWhitespace,
    printTwigBlockStart(path as AstPath<TwigBranch>, options, print, args),
    indent([
      innerLeadingWhitespace(branch),
      printChildren(path, options, print, args),
      shouldAddTrailingNewline ? literalline : '',
    ]),
  ];
}

function needsBlockStartLeadingWhitespaceStrippingOnBreak(
  node: TwigTag | TwigBranch,
): boolean {
  switch (node.type) {
    case NodeTypes.TwigTag: {
      return (
        !isAttributeNode(node) && hasMeaningfulLackOfLeadingWhitespace(node)
      );
    }
    case NodeTypes.TwigBranch: {
      return (
        !isAttributeNode(node.parentNode! as TwigTag) &&
        hasMeaningfulLackOfLeadingWhitespace(node)
      );
    }
    default: {
      return assertNever(node);
    }
  }
}

function needsBlockStartTrailingWhitespaceStrippingOnBreak(
  node: TwigTag | TwigBranch,
): boolean {
  switch (node.type) {
    case NodeTypes.TwigTag: {
      if (isBranchedTag(node)) {
        return needsBlockStartLeadingWhitespaceStrippingOnBreak(
          node.firstChild! as TwigBranch,
        );
      }

      if (!node.children) {
        return hasMeaningfulLackOfTrailingWhitespace(node);
      }

      return isEmpty(node.children)
        ? hasMeaningfulLackOfDanglingWhitespace(node)
        : hasMeaningfulLackOfLeadingWhitespace(node.firstChild!);
    }

    case NodeTypes.TwigBranch: {
      if (isAttributeNode(node.parentNode! as TwigTag)) {
        return false;
      }

      return node.firstChild
        ? hasMeaningfulLackOfLeadingWhitespace(node.firstChild)
        : hasMeaningfulLackOfDanglingWhitespace(node);
    }

    default: {
      return assertNever(node);
    }
  }
}

function needsBlockEndLeadingWhitespaceStrippingOnBreak(node: TwigTag) {
  if (!node.children) {
    throw new Error(
      'Should only call needsBlockEndLeadingWhitespaceStrippingOnBreak for tags that have closing tags',
    );
  } else if (isAttributeNode(node)) {
    return false;
  } else if (isBranchedTag(node)) {
    return hasMeaningfulLackOfTrailingWhitespace(node.lastChild!);
  } else if (isEmpty(node.children)) {
    return hasMeaningfulLackOfDanglingWhitespace(node);
  } else {
    return hasMeaningfulLackOfTrailingWhitespace(node.lastChild!);
  }
}

function cleanDoc(doc: Doc[]): Doc[] {
  return doc.filter((x) => x !== '');
}
