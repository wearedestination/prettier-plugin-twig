import { Augment, TwigHtmlNode, WithFamily } from '~/types';

export const augmentWithFamily: Augment<{}> = (_options, node) => {
  const children: TwigHtmlNode[] = (node as any).children || [];
  const augmentations: WithFamily = {
    firstChild: children[0],
    lastChild: children[children.length - 1],
  };

  Object.assign(node, augmentations);
};
