import ohm from 'ohm-js';

export const twigHtmlGrammars = ohm.grammars(
  require('../../grammar/twig-html.ohm.js'),
);

export interface TwigGrammars {
  Twig: ohm.Grammar;
  TwigHTML: ohm.Grammar;
}

export const strictGrammars: TwigGrammars = {
  Twig: twigHtmlGrammars['StrictTwig'],
  TwigHTML: twigHtmlGrammars['StrictTwigHTML'],
};

export const tolerantGrammars: TwigGrammars = {
  Twig: twigHtmlGrammars['Twig'],
  TwigHTML: twigHtmlGrammars['TwigHTML'],
};

export const placeholderGrammars: TwigGrammars = {
  Twig: twigHtmlGrammars['WithPlaceholderTwig'],
  TwigHTML: twigHtmlGrammars['WithPlaceholderTwigHTML'],
};

// see ../../grammar/twig-html.ohm for full list
export const BLOCKS = (
  strictGrammars.TwigHTML.rules as any
).blockName.body.factors[0].terms.map((x: any) => x.obj) as string[];

// see ../../grammar/twig-html.ohm for full list
export const VOID_ELEMENTS = (
  strictGrammars.TwigHTML.rules as any
).voidElementName.body.factors[0].terms.map(
  (x: any) => x.args[0].obj,
) as string[];
