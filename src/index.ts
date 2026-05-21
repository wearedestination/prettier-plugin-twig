import { Plugin, SupportLanguage, SupportOptions } from 'prettier';
import { parsers, liquidHtmlLanguageName } from '~/parser';
import { printers } from '~/printer';
import { LiquidHtmlNode } from '~/types';

const languages: SupportLanguage[] = [
  {
    name: 'LiquidHTML',
    parsers: [liquidHtmlLanguageName],
    extensions: ['.twig'],
    vscodeLanguageIds: ['twig', 'Twig'],
  },
];

const options: SupportOptions = {
  twigSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description:
      'Use single quotes instead of double quotes in Twig tags and objects.',
  },
  liquidSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: undefined,
    description:
      'Deprecated: Use twigSingleQuote instead. Use single quotes instead of double quotes in Twig tags and objects.',
  },
  embeddedSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description:
      'Use single quotes instead of double quotes in embedded languages (JavaScript, CSS, TypeScript inside <script>, <style> or Liquid equivalent).',
  },
  singleLineLinkTags: {
    type: 'boolean',
    category: 'HTML',
    default: false,
    description: 'Always print link tags on a single line to remove clutter',
  },
  indentSchema: {
    type: 'boolean',
    category: 'LIQUID',
    default: false,
    description: 'Indent the contents of the {% schema %} tag',
  },
};

const defaultOptions = {
  printWidth: 120,
};

const plugin: Plugin<LiquidHtmlNode> = {
  languages,
  parsers: parsers as Plugin['parsers'],
  printers: printers as any,
  options,
  defaultOptions,
};

export = plugin;
