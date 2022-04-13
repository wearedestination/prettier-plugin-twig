import * as AST from '../../parsers/ast';
import { LiquidParserOptions } from '../utils';

// This one warrants a bit of an explanation 'cuz it's definitely next
// level typescript kung-fu shit.
//
// We have an AST, right? And we want to augment every node in the AST with
// new properties. But we don't want to traverse the tree and repeat
// ourselves. So we use a mapped type to map on the properties of T to do
// the following:
//
// - If the property is an array of LiquidHtmlNode, we'll map that to an array of
// Augmented<T[property]> instead.
//
// - If the property is a something | LiquidHtmlNode, then we'll map that type
// to something | Augmented<T[Property]>
//
// So this thing will go through node.name, node.children, node.attributes,
// and so on and give us augmented types.
//
// prettier-ignore
export type Augmented<T, Aug> = {
  [Property in keyof T]: [T[Property]] extends [(infer Item)[] | undefined]
    ? [Item] extends [AST.LiquidHtmlNode]
      ? Augmented<Item, Aug>[]
      : Item[]
    : T[Property] extends infer P // this here is to distribute the condition
      ? P extends AST.LiquidHtmlNode // so string and LiquidDrop go through this check independently
        ? Augmented<P, Aug>
        : P
      : never;
} & Aug;

export type AllAugmentations = WithParent &
  WithSiblings &
  WithCssDisplay &
  WithWhitespaceHelpers;

export type WithParent = {
  parentNode?: ParentNode;
};

export type WithSiblings = {
  // We're cheating here by saying the prev/next will have all the props.
  // That's kind of a lie. But it would be too complicated to do this any
  // other way.
  prev: LiquidHtmlNode | undefined;
  next: LiquidHtmlNode | undefined;
};

export type WithCssDisplay = {
  cssDisplay: string;
};

export type WithWhitespaceHelpers = {
  isDanglingWhitespaceSensitive: boolean;
  isWhitespaceSensitive: boolean;
  isIndentationSensitive: boolean;
};

export type AugmentedNode<Aug> = Augmented<AST.LiquidHtmlNode, Aug>;

export type Augment<Aug> = <NodeType extends AugmentedNode<Aug>>(
  options: LiquidParserOptions,
  node: NodeType,
  parentNode?: NodeType,
) => void;

export type LiquidHtmlNode = Augmented<AST.LiquidHtmlNode, AllAugmentations>;
export type DocumentNode = Augmented<AST.DocumentNode, AllAugmentations>;
export type LiquidNode = Augmented<AST.LiquidNode, AllAugmentations>;
export type ParentNode = Augmented<AST.ParentNode, AllAugmentations>;
export type LiquidRawTag = Augmented<AST.LiquidRawTag, AllAugmentations>;
export type LiquidTag = Augmented<AST.LiquidTag, AllAugmentations>;
export type LiquidBranch = Augmented<AST.LiquidBranch, AllAugmentations>;
export type LiquidDrop = Augmented<AST.LiquidDrop, AllAugmentations>;
export type HtmlNode = Augmented<AST.HtmlNode, AllAugmentations>;
export type HtmlElement = Augmented<AST.HtmlElement, AllAugmentations>;
export type HtmlVoidElement = Augmented<AST.HtmlVoidElement, AllAugmentations>;
export type HtmlSelfClosingElement = Augmented<
  AST.HtmlSelfClosingElement,
  AllAugmentations
>;
export type HtmlRawNode = Augmented<AST.HtmlRawNode, AllAugmentations>;
export type HtmlComment = Augmented<AST.HtmlComment, AllAugmentations>;
export type AttributeNode = Augmented<AST.AttributeNode, AllAugmentations>;
export type AttrSingleQuoted = Augmented<
  AST.AttrSingleQuoted,
  AllAugmentations
>;
export type AttrDoubleQuoted = Augmented<
  AST.AttrDoubleQuoted,
  AllAugmentations
>;
export type AttrUnquoted = Augmented<AST.AttrUnquoted, AllAugmentations>;
export type AttrEmpty = Augmented<AST.AttrEmpty, AllAugmentations>;
export type TextNode = Augmented<AST.TextNode, AllAugmentations>;