/**
 * This is the second stage of the parser.
 *
 * Input:
 *  - A Concrete Syntax Tree (CST)
 *
 * Output:
 *  - An Abstract Syntax Tree (AST)
 *
 * This stage traverses the flat tree we get from the previous stage and
 * establishes the parent/child relationship between the nodes.
 *
 * Recall the Twig example we had in the first stage:
 *   {% if cond %}hi <em>there!</em>{% endif %}
 *
 * Whereas the previous stage gives us this CST:
 *   - TwigTagOpen/if
 *     condition: TwigVariableExpression/cond
 *   - TextNode/"hi "
 *   - HtmlTagOpen/em
 *   - TextNode/"there!"
 *   - HtmlTagClose/em
 *   - TwigTagClose/if
 *
 * We now traverse all the nodes and turn that into a proper AST:
 *   - TwigTag/if
 *     condition: TwigVariableExpression
 *     children:
 *       - TextNode/"hi "
 *       - HtmlElement/em
 *         children:
 *           - TextNode/"there!"
 *
 */

import {
  ConcreteAttributeNode,
  ConcreteHtmlTagClose,
  ConcreteHtmlTagOpen,
  ConcreteHtmlVoidElement,
  ConcreteTwigDrop,
  ConcreteTwigNode,
  ConcreteTwigTagClose,
  ConcreteNodeTypes,
  ConcreteTextNode,
  TwigCST,
  TwigHtmlCST,
  toTwigHtmlCST,
  ConcreteHtmlSelfClosingElement,
  ConcreteAttrSingleQuoted,
  ConcreteAttrDoubleQuoted,
  ConcreteAttrUnquoted,
  ConcreteAttrEmpty,
  ConcreteTwigVariable,
  ConcreteTwigLiteral,
  ConcreteTwigFilter,
  ConcreteTwigExpression,
  ConcreteTwigNamedArgument,
  ConcreteTwigTagNamed,
  ConcreteTwigTag,
  ConcreteTwigTagIncludeMarkup,
  ConcreteIncludeVariableExpression,
  ConcreteTwigTagOpenNamed,
  ConcreteTwigTagOpen,
  ConcreteTwigArgument,
  ConcreteTwigCondition,
  ConcreteTwigComparison,
  ConcreteTwigTagForMarkup,
  ConcreteHtmlRawTag,
  ConcreteTwigRawTag,
  TwigHtmlConcreteNode,
} from '~/parser/stage-1-cst';
import {
  Comparators,
  isTwigHtmlNode,
  NamedTags,
  NodeTypes,
  nonTraversableProperties,
  Position,
} from '~/types';
import { assertNever, deepGet, dropLast } from '~/utils';
import { TwigHTMLASTParsingError } from '~/parser/errors';
import { toTwigCST } from '~/parser/stage-1-cst';

interface HasPosition {
  locStart: number;
  locEnd: number;
}

export type TwigHtmlNode =
  | DocumentNode
  | YAMLFrontmatter
  | TwigNode
  | HtmlDoctype
  | HtmlNode
  | AttributeNode
  | TwigVariable
  | TwigExpression
  | TwigFilter
  | TwigNamedArgument
  | ForMarkup
  | IncludeMarkup
  | RawMarkup
  | IncludeVariableExpression
  | TwigLogicalExpression
  | TwigComparison
  | TextNode;

export interface DocumentNode extends ASTNode<NodeTypes.Document> {
  children: TwigHtmlNode[];
  name: '#document';
}

export interface YAMLFrontmatter extends ASTNode<NodeTypes.YAMLFrontmatter> {
  body: string;
}

export type TwigNode = TwigRawTag | TwigTag | TwigDrop | TwigBranch;

export interface HasChildren {
  children?: TwigHtmlNode[];
}
export interface HasAttributes {
  attributes: AttributeNode[];
}
export interface HasValue {
  value: (TextNode | TwigNode)[];
}
export interface HasName {
  name: string | TwigDrop;
}
export interface HasCompoundName {
  name: (TextNode | TwigNode)[];
}

export type ParentNode = Extract<
  TwigHtmlNode,
  HasChildren | HasAttributes | HasValue | HasName | HasCompoundName
>;

export interface TwigRawTag extends ASTNode<NodeTypes.TwigRawTag> {
  /**
   * e.g. verbatim, css, js
   */
  name: string;
  markup: string;

  /**
   * String body of the tag. So we don't try to parse it.
   */
  body: RawMarkup;
  whitespaceStart: '-' | '~' | '';
  whitespaceEnd: '-' | '~' | '';
  delimiterWhitespaceStart: '-' | '~' | '';
  delimiterWhitespaceEnd: '-' | '~' | '';
  blockStartPosition: Position;
  blockEndPosition: Position;
}

export type TwigTag = TwigTagNamed | TwigTagBaseCase;
export type TwigTagNamed = TwigTagFor | TwigTagIf | TwigTagInclude;

export interface TwigTagNode<Name, Markup> extends ASTNode<NodeTypes.TwigTag> {
  /**
   * e.g. if, for, block, etc.
   */
  name: Name;

  /**
   * The body of the tag. May contain arguments. Excludes the name of the tag. Left trimmed if string.
   */
  markup: Markup;
  children?: TwigHtmlNode[];
  whitespaceStart: '-' | '~' | '';
  whitespaceEnd: '-' | '~' | '';
  delimiterWhitespaceStart?: '-' | '~' | '';
  delimiterWhitespaceEnd?: '-' | '~' | '';
  blockStartPosition: Position;
  blockEndPosition?: Position;
}

export interface TwigTagBaseCase extends TwigTagNode<string, string> {}
export interface TwigTagFor extends TwigTagNode<NamedTags.for, ForMarkup> {}
export interface ForMarkup extends ASTNode<NodeTypes.ForMarkup> {
  variableName: string;
  collection: TwigExpression;
  reversed: boolean;
  args: TwigNamedArgument[];
}

export interface TwigTagIf extends TwigTagConditional<NamedTags.if> {}
export interface TwigBranchElseif
  extends TwigBranchNode<NamedTags.elseif, TwigConditionalExpression> {}
export interface TwigTagConditional<Name>
  extends TwigTagNode<Name, TwigConditionalExpression> {}

export type TwigConditionalExpression =
  | TwigLogicalExpression
  | TwigComparison
  | TwigExpression;

export interface TwigLogicalExpression
  extends ASTNode<NodeTypes.LogicalExpression> {
  relation: 'and' | 'or';
  left: TwigConditionalExpression;
  right: TwigConditionalExpression;
}

export interface TwigComparison extends ASTNode<NodeTypes.Comparison> {
  comparator: Comparators;
  left: TwigConditionalExpression;
  right: TwigConditionalExpression;
}

export interface TwigTagInclude
  extends TwigTagNode<NamedTags.include, IncludeMarkup> {}

export interface IncludeMarkup extends ASTNode<NodeTypes.IncludeMarkup> {
  template: TwigString | TwigVariableLookup;
  alias: string | null;
  variable: IncludeVariableExpression | null;
  args: TwigNamedArgument[];
}

export interface IncludeVariableExpression
  extends ASTNode<NodeTypes.IncludeVariableExpression> {
  kind: 'for' | 'with';
  name: TwigExpression;
}

export type TwigBranch =
  | TwigBranchUnnamed
  | TwigBranchBaseCase
  | TwigBranchNamed;
export type TwigBranchNamed = TwigBranchElseif;

interface TwigBranchNode<Name, Markup> extends ASTNode<NodeTypes.TwigBranch> {
  /**
   * e.g. else, elseif | null when in the main branch
   */
  name: Name;

  /**
   * The body of the branch tag. May contain arguments. Excludes the name of the tag. Left trimmed.
   */
  markup: Markup;
  children: TwigHtmlNode[];
  whitespaceStart: '-' | '~' | '';
  whitespaceEnd: '-' | '~' | '';
  blockStartPosition: Position;
}

export interface TwigBranchUnnamed extends TwigBranchNode<null, string> {}
export interface TwigBranchBaseCase extends TwigBranchNode<string, string> {}

export interface TwigDrop extends ASTNode<NodeTypes.TwigDrop> {
  /**
   * The body of the drop. May contain filters. Not trimmed.
   */
  markup: string | TwigVariable;
  whitespaceStart: '-' | '~' | '';
  whitespaceEnd: '-' | '~' | '';
}

interface TwigVariable extends ASTNode<NodeTypes.TwigVariable> {
  expression: TwigExpression;
  filters: TwigFilter[];
  rawSource: string;
}

export type TwigExpression =
  | TwigString
  | TwigNumber
  | TwigLiteral
  | TwigRange
  | TwigVariableLookup;

interface TwigFilter extends ASTNode<NodeTypes.TwigFilter> {
  name: string;
  args: TwigArgument[];
}

type TwigArgument = TwigExpression | TwigNamedArgument;

interface TwigNamedArgument extends ASTNode<NodeTypes.NamedArgument> {
  name: string;
  value: TwigExpression;
}

interface TwigString extends ASTNode<NodeTypes.String> {
  single: boolean;
  value: string;
}

interface TwigNumber extends ASTNode<NodeTypes.Number> {
  value: string;
}

interface TwigRange extends ASTNode<NodeTypes.Range> {
  start: TwigExpression;
  end: TwigExpression;
}

interface TwigLiteral extends ASTNode<NodeTypes.TwigLiteral> {
  keyword: ConcreteTwigLiteral['keyword'];
  value: ConcreteTwigLiteral['value'];
}

interface TwigVariableLookup extends ASTNode<NodeTypes.VariableLookup> {
  name: string | null;
  lookups: TwigExpression[];
}

export type HtmlNode =
  | HtmlComment
  | HtmlElement
  | HtmlDanglingMarkerOpen
  | HtmlDanglingMarkerClose
  | HtmlVoidElement
  | HtmlSelfClosingElement
  | HtmlRawNode;

export interface HtmlElement extends HtmlNodeBase<NodeTypes.HtmlElement> {
  /**
   * The name of the tag can be compound
   * @example <{{ header_type }}--header />
   */
  name: (TextNode | TwigDrop)[];
  children: TwigHtmlNode[];
  blockEndPosition: Position;
}

export interface HtmlDanglingMarkerOpen
  extends HtmlNodeBase<NodeTypes.HtmlDanglingMarkerOpen> {
  name: (TextNode | TwigDrop)[];
}

export interface HtmlDanglingMarkerClose
  extends ASTNode<NodeTypes.HtmlDanglingMarkerClose> {
  name: (TextNode | TwigDrop)[];
  blockStartPosition: Position;
}

export interface HtmlSelfClosingElement
  extends HtmlNodeBase<NodeTypes.HtmlSelfClosingElement> {
  /**
   * The name of the tag can be compound
   * @example <{{ header_type }}--header />
   */
  name: (TextNode | TwigDrop)[];
}

export interface HtmlVoidElement
  extends HtmlNodeBase<NodeTypes.HtmlVoidElement> {
  name: string;
}

export interface HtmlRawNode extends HtmlNodeBase<NodeTypes.HtmlRawNode> {
  /**
   * The innerHTML of the tag as a string. Not trimmed. Not parsed.
   */
  body: RawMarkup;
  name: string;
  blockEndPosition: Position;
}

export enum RawMarkupKinds {
  css = 'css',
  html = 'html',
  javascript = 'javascript',
  json = 'json',
  markdown = 'markdown',
  typescript = 'typescript',
  text = 'text',
}

export interface RawMarkup extends ASTNode<NodeTypes.RawMarkup> {
  kind: RawMarkupKinds;
  value: string;
}

export interface HtmlDoctype extends ASTNode<NodeTypes.HtmlDoctype> {
  legacyDoctypeString: string | null;
}

export interface HtmlComment extends ASTNode<NodeTypes.HtmlComment> {
  body: string;
}

export interface HtmlNodeBase<T> extends ASTNode<T> {
  attributes: AttributeNode[];
  blockStartPosition: Position;
}

export type AttributeNode =
  | TwigNode
  | AttrSingleQuoted
  | AttrDoubleQuoted
  | AttrUnquoted
  | AttrEmpty;

export interface AttrSingleQuoted
  extends AttributeNodeBase<NodeTypes.AttrSingleQuoted> {}
export interface AttrDoubleQuoted
  extends AttributeNodeBase<NodeTypes.AttrDoubleQuoted> {}
export interface AttrUnquoted
  extends AttributeNodeBase<NodeTypes.AttrUnquoted> {}
export interface AttrEmpty extends ASTNode<NodeTypes.AttrEmpty> {
  name: (TextNode | TwigDrop | TwigTagBaseCase)[];
}

export type ValueNode = TextNode | TwigNode;

export interface AttributeNodeBase<T> extends ASTNode<T> {
  name: (TextNode | TwigDrop | TwigTagBaseCase)[];
  value: ValueNode[];
  attributePosition: Position;
}

export interface TextNode extends ASTNode<NodeTypes.TextNode> {
  value: string;
}

export interface ASTNode<T> {
  type: T;
  position: Position;
  source: string;
}

interface ASTBuildOptions {
  /**
   * Whether the parser should throw if the document node isn't closed
   */
  allowUnclosedDocumentNode: boolean;

  /**
   * 'strict' will disable the Twig parsing base cases. Which means that we will
   * throw an error if we can't parse the node `markup` properly.
   *
   * 'tolerant' is the default case so that prettier can pretty print nodes
   * that it doesn't understand.
   */
  mode: 'strict' | 'tolerant' | 'completion';
}

export function isBranchedTag(node: TwigHtmlNode) {
  return node.type === NodeTypes.TwigTag && ['if', 'for'].includes(node.name);
}

// Not exported because you can use node.type === NodeTypes.TwigBranch.
function isTwigBranchDisguisedAsTag(
  node: TwigHtmlNode,
): node is TwigTagBaseCase {
  return (
    node.type === NodeTypes.TwigTag && ['else', 'elseif'].includes(node.name)
  );
}

function isConcreteTwigBranchDisguisedAsTag(
  node: TwigHtmlConcreteNode,
): node is ConcreteTwigNode & { name: 'else' | 'elseif' } {
  return (
    node.type === ConcreteNodeTypes.TwigTag &&
    ['else', 'elseif'].includes(node.name)
  );
}

export function toTwigAST(
  source: string,
  options: ASTBuildOptions = {
    allowUnclosedDocumentNode: true,
    mode: 'tolerant',
  },
) {
  const cst = toTwigCST(source, { mode: options.mode });
  const root: DocumentNode = {
    type: NodeTypes.Document,
    source: source,
    children: cstToAst(cst, options),
    name: '#document',
    position: {
      start: 0,
      end: source.length,
    },
  };
  return root;
}

export function toTwigHtmlAST(
  source: string,
  options: ASTBuildOptions = {
    allowUnclosedDocumentNode: false,
    mode: 'tolerant',
  },
): DocumentNode {
  const cst = toTwigHtmlCST(source, { mode: options.mode });
  const root: DocumentNode = {
    type: NodeTypes.Document,
    source: source,
    children: cstToAst(cst, options),
    name: '#document',
    position: {
      start: 0,
      end: source.length,
    },
  };
  return root;
}

class ASTBuilder {
  ast: TwigHtmlNode[];
  cursor: (string | number)[];
  source: string;

  constructor(source: string) {
    this.ast = [];
    this.cursor = [];
    this.source = source;
  }

  get current() {
    return deepGet<TwigHtmlNode[]>(this.cursor, this.ast) as TwigHtmlNode[];
  }

  get currentPosition(): number {
    return (this.current || []).length - 1;
  }

  get parent(): ParentNode | undefined {
    if (this.cursor.length == 0) return undefined;
    return deepGet<TwigTag | HtmlElement>(dropLast(1, this.cursor), this.ast);
  }

  get grandparent(): ParentNode | undefined {
    if (this.cursor.length < 4) return undefined;
    return deepGet<TwigTag | HtmlElement>(dropLast(3, this.cursor), this.ast);
  }

  open(node: TwigHtmlNode) {
    this.current.push(node);
    this.cursor.push(this.currentPosition);
    this.cursor.push('children');

    if (isBranchedTag(node)) {
      this.open(toUnnamedTwigBranch(node));
    }
  }

  push(node: TwigHtmlNode) {
    if (node.type === NodeTypes.TwigTag && isTwigBranchDisguisedAsTag(node)) {
      this.cursor.pop();
      this.cursor.pop();
      this.open(toNamedTwigBranchBaseCase(node));
    } else if (node.type === NodeTypes.TwigBranch) {
      this.cursor.pop();
      this.cursor.pop();
      this.open(node);
    } else {
      if (this.parent?.type === NodeTypes.TwigBranch) {
        this.parent.position.end = node.position.end;
      }
      this.current.push(node);
    }
  }

  close(
    node: ConcreteTwigTagClose | ConcreteHtmlTagClose,
    nodeType: NodeTypes.TwigTag | NodeTypes.HtmlElement,
  ) {
    if (isTwigBranch(this.parent)) {
      this.parent.position.end = node.locStart;
      this.cursor.pop();
      this.cursor.pop();
    }

    if (!this.parent) {
      throw new TwigHTMLASTParsingError(
        `Attempting to close ${nodeType} '${getName(
          node,
        )}' before it was opened`,
        this.source,
        node.locStart,
        node.locEnd,
      );
    }

    if (
      getName(this.parent) !== getName(node) ||
      this.parent.type !== nodeType
    ) {
      throw new TwigHTMLASTParsingError(
        `Attempting to close ${nodeType} '${getName(node)}' before ${
          this.parent.type
        } '${getName(this.parent)}' was closed`,
        this.source,
        this.parent.position.start,
        node.locEnd,
      );
    }

    // The parent end is the end of the outer tag.
    this.parent.position.end = node.locEnd;
    this.parent.blockEndPosition = position(node);
    if (
      this.parent.type == NodeTypes.TwigTag &&
      node.type == ConcreteNodeTypes.TwigTagClose
    ) {
      this.parent.delimiterWhitespaceStart = node.whitespaceStart ?? '';
      this.parent.delimiterWhitespaceEnd = node.whitespaceEnd ?? '';
    }
    this.cursor.pop();
    this.cursor.pop();
  }
}

function isTwigBranch(
  node: TwigHtmlNode | undefined,
): node is TwigBranchNode<any, any> {
  return !!node && node.type === NodeTypes.TwigBranch;
}

function getName(
  node: ConcreteTwigTagClose | ConcreteHtmlTagClose | ParentNode | undefined,
): string | TwigDrop | null {
  if (!node) return null;
  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlDanglingMarkerOpen:
    case NodeTypes.HtmlDanglingMarkerClose:
    case NodeTypes.HtmlSelfClosingElement:
    case ConcreteNodeTypes.HtmlTagClose:
      return node.name
        .map((part) => {
          if (
            part.type === NodeTypes.TextNode ||
            part.type == ConcreteNodeTypes.TextNode
          ) {
            return part.value;
          } else if (typeof part.markup === 'string') {
            return `{{${part.markup.trim()}}}`;
          } else {
            return `{{${part.markup.rawSource}}}`;
          }
        })
        .join('');
    case NodeTypes.AttrEmpty:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
      // <a href="{{ hello }}">
      return node.name
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          } else {
            return part.source.slice(part.position.start, part.position.end);
          }
        })
        .join('');
    default:
      return node.name;
  }
}

export function cstToAst(
  cst: TwigHtmlCST | TwigCST | ConcreteAttributeNode[],
  options: ASTBuildOptions,
): TwigHtmlNode[] {
  if (cst.length === 0) return [];

  const builder = buildAst(cst, options);

  if (!options.allowUnclosedDocumentNode && builder.cursor.length !== 0) {
    throw new TwigHTMLASTParsingError(
      `Attempting to end parsing before ${builder.parent?.type} '${getName(
        builder.parent,
      )}' was closed`,
      builder.source,
      builder.source.length - 1,
      builder.source.length,
    );
  }

  return builder.ast;
}

function buildAst(
  cst: TwigHtmlCST | TwigCST | ConcreteAttributeNode[],
  options: ASTBuildOptions,
) {
  const builder = new ASTBuilder(cst[0].source);

  for (let i = 0; i < cst.length; i++) {
    const node = cst[i];

    switch (node.type) {
      case ConcreteNodeTypes.TextNode: {
        builder.push(toTextNode(node));
        break;
      }

      case ConcreteNodeTypes.TwigDrop: {
        builder.push(toTwigDrop(node));
        break;
      }

      case ConcreteNodeTypes.TwigTagOpen: {
        builder.open(toTwigTag(node, { isBlockTag: true, ...options }));
        break;
      }

      case ConcreteNodeTypes.TwigTagClose: {
        builder.close(node, NodeTypes.TwigTag);
        break;
      }

      case ConcreteNodeTypes.TwigTag: {
        builder.push(toTwigTag(node, { isBlockTag: false, ...options }));
        break;
      }

      case ConcreteNodeTypes.TwigRawTag: {
        builder.push({
          type: NodeTypes.TwigRawTag,
          markup: node.markup,
          name: node.name,
          body: toRawMarkup(node),
          whitespaceStart: node.whitespaceStart ?? '',
          whitespaceEnd: node.whitespaceEnd ?? '',
          delimiterWhitespaceStart: node.delimiterWhitespaceStart ?? '',
          delimiterWhitespaceEnd: node.delimiterWhitespaceEnd ?? '',
          position: position(node),
          blockStartPosition: {
            start: node.blockStartLocStart,
            end: node.blockStartLocEnd,
          },
          blockEndPosition: {
            start: node.blockEndLocStart,
            end: node.blockEndLocEnd,
          },
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlTagOpen: {
        if (isAcceptableDanglingMarkerOpen(builder, cst as TwigHtmlCST, i)) {
          builder.push(toHtmlDanglingMarkerOpen(node, options));
        } else {
          builder.open(toHtmlElement(node, options));
        }
        break;
      }

      case ConcreteNodeTypes.HtmlTagClose: {
        if (isAcceptableDanglingMarkerClose(builder, cst as TwigHtmlCST, i)) {
          builder.push(toHtmlDanglingMarkerClose(node, options));
        } else {
          builder.close(node, NodeTypes.HtmlElement);
        }
        break;
      }

      case ConcreteNodeTypes.HtmlVoidElement: {
        builder.push(toHtmlVoidElement(node, options));
        break;
      }

      case ConcreteNodeTypes.HtmlSelfClosingElement: {
        builder.push(toHtmlSelfClosingElement(node, options));
        break;
      }

      case ConcreteNodeTypes.HtmlDoctype: {
        builder.push({
          type: NodeTypes.HtmlDoctype,
          legacyDoctypeString: node.legacyDoctypeString,
          position: position(node),
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlComment: {
        builder.push({
          type: NodeTypes.HtmlComment,
          body: node.body,
          position: position(node),
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlRawTag: {
        builder.push({
          type: NodeTypes.HtmlRawNode,
          name: node.name,
          body: toRawMarkup(node),
          attributes: toAttributes(node.attrList || [], options),
          position: position(node),
          source: node.source,
          blockStartPosition: {
            start: node.blockStartLocStart,
            end: node.blockStartLocEnd,
          },
          blockEndPosition: {
            start: node.blockEndLocStart,
            end: node.blockEndLocEnd,
          },
        });
        break;
      }

      case ConcreteNodeTypes.AttrEmpty: {
        builder.push({
          type: NodeTypes.AttrEmpty,
          name: cstToAst(node.name, options) as AttrEmpty['name'],
          position: position(node),
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.AttrSingleQuoted:
      case ConcreteNodeTypes.AttrDoubleQuoted:
      case ConcreteNodeTypes.AttrUnquoted: {
        const abstractNode: AttrUnquoted | AttrSingleQuoted | AttrDoubleQuoted =
          {
            type: node.type as unknown as
              | NodeTypes.AttrSingleQuoted
              | NodeTypes.AttrDoubleQuoted
              | NodeTypes.AttrUnquoted,
            name: cstToAst(node.name, options) as AttrUnquoted['name'],
            position: position(node),
            source: node.source,

            // placeholders
            attributePosition: { start: -1, end: -1 },
            value: [],
          };
        const value = toAttributeValue(node.value, options);
        abstractNode.value = value;
        abstractNode.attributePosition = toAttributePosition(node, value);
        builder.push(abstractNode);
        break;
      }

      case ConcreteNodeTypes.YAMLFrontmatter: {
        builder.push({
          type: NodeTypes.YAMLFrontmatter,
          body: node.body,
          position: position(node),
          source: node.source,
        });
        break;
      }

      default: {
        assertNever(node);
      }
    }
  }

  return builder;
}

function nameLength(names: ConcreteAttrEmpty['name']) {
  const start = names.at(0)!;
  const end = names.at(-1)!;
  return end.locEnd - start.locStart;
}

function toAttributePosition(
  node:
    | ConcreteAttrSingleQuoted
    | ConcreteAttrDoubleQuoted
    | ConcreteAttrUnquoted,
  value: (TwigNode | TextNode)[],
): Position {
  if (value.length === 0) {
    // This is bugged when there's whitespace on either side. But I don't
    // think it's worth solving.
    return {
      start: node.locStart + nameLength(node.name) + '='.length + '"'.length,
      // name=""
      // 012345678
      // 0 + 4 + 1 + 1
      // = 6
      end: node.locStart + nameLength(node.name) + '='.length + '"'.length,
      // name=""
      // 012345678
      // 0 + 4 + 1 + 2
      // = 6
    };
  }

  return {
    start: value[0].position.start,
    end: value[value.length - 1].position.end,
  };
}

function toAttributeValue(
  value: (ConcreteTwigNode | ConcreteTextNode)[],
  options: ASTBuildOptions,
): (TwigNode | TextNode)[] {
  return cstToAst(value, options) as (TwigNode | TextNode)[];
}

function toAttributes(
  attrList: ConcreteAttributeNode[],
  options: ASTBuildOptions,
): AttributeNode[] {
  return cstToAst(attrList, options) as AttributeNode[];
}

function twigTagBaseAttributes(
  node: ConcreteTwigTag | ConcreteTwigTagOpen,
): Omit<TwigTag, 'name' | 'markup'> {
  return {
    type: NodeTypes.TwigTag,
    position: position(node),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    blockStartPosition: position(node),
    source: node.source,
  };
}

function twigBranchBaseAttributes(
  node: ConcreteTwigTag,
): Omit<TwigBranch, 'name' | 'markup'> {
  return {
    type: NodeTypes.TwigBranch,
    children: [],
    position: position(node),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toTwigTag(
  node: ConcreteTwigTag | ConcreteTwigTagOpen,
  options: ASTBuildOptions & { isBlockTag: boolean },
): TwigTag | TwigBranch {
  if (typeof node.markup !== 'string') {
    return toNamedTwigTag(node as ConcreteTwigTagNamed);
  } else if (options.isBlockTag) {
    return {
      name: node.name,
      markup: node.markup,
      children: options.isBlockTag ? [] : undefined,
      ...twigTagBaseAttributes(node),
    };
  }
  return {
    name: node.name,
    markup: node.markup,
    ...twigTagBaseAttributes(node),
  };
}

function toNamedTwigTag(
  node: ConcreteTwigTagNamed | ConcreteTwigTagOpenNamed,
): TwigTagNamed | TwigBranchNamed {
  switch (node.name) {
    case NamedTags.include: {
      return {
        ...twigTagBaseAttributes(node),
        name: node.name,
        markup: toIncludeMarkup(node.markup),
      };
    }

    case NamedTags.for: {
      return {
        ...twigTagBaseAttributes(node),
        name: node.name,
        markup: toForMarkup(node.markup),
        children: [],
      };
    }

    case NamedTags.if: {
      return {
        ...twigTagBaseAttributes(node),
        name: node.name,
        markup: toConditionalExpression(node.markup),
        children: [],
      };
    }

    case NamedTags.elseif: {
      return {
        ...twigBranchBaseAttributes(node),
        name: node.name,
        markup: toConditionalExpression(node.markup),
      };
    }

    default: {
      return assertNever(node);
    }
  }
}

function toNamedTwigBranchBaseCase(node: TwigTagBaseCase): TwigBranchBaseCase {
  return {
    name: node.name,
    type: NodeTypes.TwigBranch,
    markup: node.markup,
    position: { ...node.position },
    children: [],
    blockStartPosition: { ...node.position },
    whitespaceStart: node.whitespaceStart,
    whitespaceEnd: node.whitespaceEnd,
    source: node.source,
  };
}

function toUnnamedTwigBranch(parentNode: TwigHtmlNode): TwigBranchUnnamed {
  return {
    type: NodeTypes.TwigBranch,
    name: null,
    markup: '',
    position: {
      start: parentNode.position.end,
      end: parentNode.position.end, // tmp value
    },
    blockStartPosition: {
      start: parentNode.position.end,
      end: parentNode.position.end,
    },
    children: [],
    whitespaceStart: '',
    whitespaceEnd: '',
    source: parentNode.source,
  };
}

function toForMarkup(node: ConcreteTwigTagForMarkup): ForMarkup {
  return {
    type: NodeTypes.ForMarkup,
    variableName: node.variableName,
    collection: toExpression(node.collection),
    args: node.args.map(toNamedArgument),
    reversed: !!node.reversed,
    position: position(node),
    source: node.source,
  };
}

function toRawMarkup(node: ConcreteHtmlRawTag | ConcreteTwigRawTag): RawMarkup {
  return {
    type: NodeTypes.RawMarkup,
    kind: toRawMarkupKind(node),
    value: node.body,
    position: {
      start: node.blockStartLocEnd,
      end: node.blockEndLocStart,
    },
    source: node.source,
  };
}

function toRawMarkupKind(
  node: ConcreteHtmlRawTag | ConcreteTwigRawTag,
): RawMarkupKinds {
  switch (node.type) {
    case ConcreteNodeTypes.HtmlRawTag:
      return toRawMarkupKindFromHtmlNode(node);
    case ConcreteNodeTypes.TwigRawTag:
      return toRawMarkupKindFromTwigNode(node);
    default:
      return assertNever(node);
  }
}

const twigToken = /\{%|\{\{/;

function toRawMarkupKindFromHtmlNode(node: ConcreteHtmlRawTag): RawMarkupKinds {
  switch (node.name) {
    case 'script': {
      const scriptAttr = node.attrList?.find(
        (attr) =>
          'name' in attr &&
          typeof attr.name !== 'string' &&
          attr.name.length === 1 &&
          attr.name[0].type === ConcreteNodeTypes.TextNode &&
          attr.name[0].value === 'type',
      );

      if (
        !scriptAttr ||
        !('value' in scriptAttr) ||
        scriptAttr.value.length === 0 ||
        scriptAttr.value[0].type !== ConcreteNodeTypes.TextNode
      ) {
        return RawMarkupKinds.javascript;
      }
      const type = scriptAttr.value[0].value;

      if (type === 'text/markdown') {
        return RawMarkupKinds.markdown;
      }

      if (type === 'application/x-typescript') {
        return RawMarkupKinds.typescript;
      }

      if (type === 'text/html') {
        return RawMarkupKinds.html;
      }

      if (isJsonScriptType(type)) {
        return RawMarkupKinds.json;
      }

      return RawMarkupKinds.javascript;
    }
    case 'style':
      if (twigToken.test(node.body)) {
        return RawMarkupKinds.text;
      }
      return RawMarkupKinds.css;
    default:
      return RawMarkupKinds.text;
  }
}

function isJsonScriptType(type: string) {
  return (
    type.endsWith('json') ||
    type.endsWith('importmap') ||
    type === 'speculationrules'
  );
}

/**
 * The type of script is given by its attributes, e.g.
 * {% script with { type: 'application/json' } %}. When we can't tell what they
 * are, or don't recognise the type, we don't parse the contents.
 */
function toRawMarkupKindFromScriptArguments(markup: string): RawMarkupKinds {
  const attributes = markup.match(/(?:^|\s)with\b\s*([\s\S]*)$/)?.[1];
  if (attributes === undefined) return RawMarkupKinds.javascript;

  const isStatic =
    attributes.startsWith('{') && !/\.\.\.|\|\s*merge\b/.test(attributes);
  if (!isStatic) return RawMarkupKinds.text;

  const kinds = Array.from(
    attributes.matchAll(
      /[{,]\s*(['"]?)type\1\s*:\s*(?:(['"])(.*?)\2\s*(?=[,}]))?/g,
    ),
    ([, , , type]) => toRawMarkupKindFromScriptType(type),
  );
  if (kinds.length === 0) return RawMarkupKinds.javascript;
  return kinds.every((kind) => kind === kinds[0])
    ? kinds[0]
    : RawMarkupKinds.text;
}

function toRawMarkupKindFromScriptType(
  type: string | undefined,
): RawMarkupKinds {
  if (type === undefined) return RawMarkupKinds.text;
  const name = type.split(';')[0].trim().toLowerCase();
  if (isJsonScriptType(name)) return RawMarkupKinds.json;
  switch (name) {
    case '':
    case 'module':
    case 'text/javascript':
    case 'application/javascript':
    case 'text/ecmascript':
    case 'application/ecmascript':
      return RawMarkupKinds.javascript;
    case 'application/x-typescript':
      return RawMarkupKinds.typescript;
    default:
      return RawMarkupKinds.text;
  }
}

function toRawMarkupKindFromTwigNode(node: ConcreteTwigRawTag): RawMarkupKinds {
  switch (node.name) {
    case 'js':
    case 'script':
      return toRawMarkupKindFromScriptArguments(node.markup);
    case 'css':
    case 'style':
      if (twigToken.test(node.body)) {
        return RawMarkupKinds.text;
      }
      return RawMarkupKinds.css;
    default:
      return RawMarkupKinds.text;
  }
}

function toIncludeMarkup(node: ConcreteTwigTagIncludeMarkup): IncludeMarkup {
  return {
    type: NodeTypes.IncludeMarkup,
    template: toExpression(node.template) as TwigString | TwigVariableLookup,
    alias: node.alias,
    variable: toIncludeVariableExpression(node.variable),
    args: node.args.map(toNamedArgument),
    position: position(node),
    source: node.source,
  };
}

function toIncludeVariableExpression(
  node: ConcreteIncludeVariableExpression | null,
): IncludeVariableExpression | null {
  if (!node) return null;
  return {
    type: NodeTypes.IncludeVariableExpression,
    kind: node.kind,
    name: toExpression(node.name),
    position: position(node),
    source: node.source,
  };
}

function toConditionalExpression(
  nodes: ConcreteTwigCondition[],
): TwigConditionalExpression {
  if (nodes.length === 1) {
    return toComparisonOrExpression(nodes[0]);
  }

  const [first, second] = nodes;
  const [, ...rest] = nodes;
  return {
    type: NodeTypes.LogicalExpression,
    relation: second.relation as 'and' | 'or',
    left: toComparisonOrExpression(first),
    right: toConditionalExpression(rest),
    position: {
      start: first.locStart,
      end: nodes[nodes.length - 1].locEnd,
    },
    source: first.source,
  };
}

function toComparisonOrExpression(
  node: ConcreteTwigCondition,
): TwigComparison | TwigExpression {
  const expression = node.expression;
  switch (expression.type) {
    case ConcreteNodeTypes.Comparison:
      return toComparison(expression);
    default:
      return toExpression(expression);
  }
}

function toComparison(node: ConcreteTwigComparison): TwigComparison {
  return {
    type: NodeTypes.Comparison,
    comparator: node.comparator,
    left: toExpression(node.left),
    right: toExpression(node.right),
    position: position(node),
    source: node.source,
  };
}

function toTwigDrop(node: ConcreteTwigDrop): TwigDrop {
  return {
    type: NodeTypes.TwigDrop,
    markup:
      typeof node.markup === 'string'
        ? node.markup
        : toTwigVariable(node.markup),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    position: position(node),
    source: node.source,
  };
}

function toTwigVariable(node: ConcreteTwigVariable): TwigVariable {
  return {
    type: NodeTypes.TwigVariable,
    expression: toExpression(node.expression),
    filters: node.filters.map(toFilter),
    position: position(node),
    rawSource: node.rawSource,
    source: node.source,
  };
}

function toExpression(node: ConcreteTwigExpression): TwigExpression {
  switch (node.type) {
    case ConcreteNodeTypes.String: {
      return {
        type: NodeTypes.String,
        position: position(node),
        single: node.single,
        value: node.value,
        source: node.source,
      };
    }
    case ConcreteNodeTypes.Number: {
      return {
        type: NodeTypes.Number,
        position: position(node),
        value: node.value,
        source: node.source,
      };
    }
    case ConcreteNodeTypes.TwigLiteral: {
      return {
        type: NodeTypes.TwigLiteral,
        position: position(node),
        value: node.value,
        keyword: node.keyword,
        source: node.source,
      };
    }
    case ConcreteNodeTypes.Range: {
      return {
        type: NodeTypes.Range,
        start: toExpression(node.start),
        end: toExpression(node.end),
        position: position(node),
        source: node.source,
      };
    }
    case ConcreteNodeTypes.VariableLookup: {
      return {
        type: NodeTypes.VariableLookup,
        name: node.name,
        lookups: node.lookups.map(toExpression),
        position: position(node),
        source: node.source,
      };
    }
    default: {
      return assertNever(node);
    }
  }
}

function toFilter(node: ConcreteTwigFilter): TwigFilter {
  return {
    type: NodeTypes.TwigFilter,
    name: node.name,
    args: node.args.map(toTwigArgument),
    position: position(node),
    source: node.source,
  };
}

function toTwigArgument(node: ConcreteTwigArgument): TwigArgument {
  switch (node.type) {
    case ConcreteNodeTypes.NamedArgument: {
      return toNamedArgument(node);
    }
    default: {
      return toExpression(node);
    }
  }
}

function toNamedArgument(node: ConcreteTwigNamedArgument): TwigNamedArgument {
  return {
    type: NodeTypes.NamedArgument,
    name: node.name,
    value: toExpression(node.value),
    position: position(node),
    source: node.source,
  };
}

function toHtmlElement(
  node: ConcreteHtmlTagOpen,
  options: ASTBuildOptions,
): HtmlElement {
  return {
    type: NodeTypes.HtmlElement,
    name: cstToAst(node.name, options) as (TextNode | TwigDrop)[],
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    blockEndPosition: { start: -1, end: -1 },
    children: [],
    source: node.source,
  };
}

function toHtmlDanglingMarkerOpen(
  node: ConcreteHtmlTagOpen,
  options: ASTBuildOptions,
): HtmlDanglingMarkerOpen {
  return {
    type: NodeTypes.HtmlDanglingMarkerOpen,
    name: cstToAst(node.name, options) as (TextNode | TwigDrop)[],
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toHtmlDanglingMarkerClose(
  node: ConcreteHtmlTagClose,
  options: ASTBuildOptions,
): HtmlDanglingMarkerClose {
  return {
    type: NodeTypes.HtmlDanglingMarkerClose,
    name: cstToAst(node.name, options) as (TextNode | TwigDrop)[],
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toHtmlVoidElement(
  node: ConcreteHtmlVoidElement,
  options: ASTBuildOptions,
): HtmlVoidElement {
  return {
    type: NodeTypes.HtmlVoidElement,
    name: node.name,
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toHtmlSelfClosingElement(
  node: ConcreteHtmlSelfClosingElement,
  options: ASTBuildOptions,
): HtmlSelfClosingElement {
  return {
    type: NodeTypes.HtmlSelfClosingElement,
    name: cstToAst(node.name, options) as (TextNode | TwigDrop)[],
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toTextNode(node: ConcreteTextNode): TextNode {
  return {
    type: NodeTypes.TextNode,
    value: node.value,
    position: position(node),
    source: node.source,
  };
}

const MAX_NUMBER_OF_SIBLING_DANGLING_NODES = 2;

function isAcceptableDanglingMarkerOpen(
  builder: ASTBuilder,
  cst: TwigHtmlCST,
  currIndex: number,
): boolean {
  return isAcceptableDanglingMarker(
    builder,
    cst,
    currIndex,
    ConcreteNodeTypes.HtmlTagOpen,
  );
}

function isAcceptableDanglingMarkerClose(
  builder: ASTBuilder,
  cst: TwigHtmlCST,
  currIndex: number,
): boolean {
  return isAcceptableDanglingMarker(
    builder,
    cst,
    currIndex,
    ConcreteNodeTypes.HtmlTagClose,
  );
}

function isAcceptableDanglingMarker(
  builder: ASTBuilder,
  cst: TwigHtmlCST,
  currIndex: number,
  nodeType: ConcreteNodeTypes.HtmlTagOpen | ConcreteNodeTypes.HtmlTagClose,
): boolean {
  if (!isAcceptingDanglingMarkers(builder, nodeType)) {
    return false;
  }

  const maxIndex = Math.min(
    cst.length,
    currIndex + MAX_NUMBER_OF_SIBLING_DANGLING_NODES - builder.current.length,
  );

  for (let i = currIndex; i <= maxIndex; i++) {
    if (isConcreteExceptionEnd(cst[i])) {
      return true;
    }
    if (cst[i].type !== nodeType) {
      return false;
    }
  }

  return false;
}

const DanglingMapping = {
  [ConcreteNodeTypes.HtmlTagOpen]: NodeTypes.HtmlDanglingMarkerOpen,
  [ConcreteNodeTypes.HtmlTagClose]: NodeTypes.HtmlDanglingMarkerClose,
} as const;

function isAcceptingDanglingMarkers(
  builder: ASTBuilder,
  nodeType: ConcreteNodeTypes.HtmlTagOpen | ConcreteNodeTypes.HtmlTagClose,
) {
  const { parent, grandparent } = builder;
  if (!parent || !grandparent) return false;
  return (
    parent.type === NodeTypes.TwigBranch &&
    grandparent.type === NodeTypes.TwigTag &&
    grandparent.name === 'if' &&
    builder.current.every((node) => node.type === DanglingMapping[nodeType])
  );
}

// checking that is a {% else %} or {% endif %}
function isConcreteExceptionEnd(node: TwigHtmlConcreteNode | undefined) {
  return (
    !node ||
    node.type === ConcreteNodeTypes.TwigTagClose ||
    isConcreteTwigBranchDisguisedAsTag(node)
  );
}

function position(node: HasPosition): Position {
  return {
    start: node.locStart,
    end: node.locEnd,
  };
}

export function walk(
  ast: TwigHtmlNode,
  fn: (ast: TwigHtmlNode, parentNode: TwigHtmlNode | undefined) => void,
  parentNode?: TwigHtmlNode,
) {
  for (const key of Object.keys(ast)) {
    if (nonTraversableProperties.has(key)) {
      continue;
    }

    const value = (ast as any)[key];
    if (Array.isArray(value)) {
      value
        .filter(isTwigHtmlNode)
        .forEach((node: TwigHtmlNode) => walk(node, fn, ast));
    } else if (isTwigHtmlNode(value)) {
      walk(value, fn, ast);
    }
  }

  fn(ast, parentNode);
}
