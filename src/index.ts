import { Plugin, SupportLanguage, SupportOptions } from 'prettier';
import { parsers as twigParsers, twigLanguageName } from '~/parser';
import { printers as twigPrinters } from '~/printer';
import { TwigHtmlNode } from '~/types';

export const languages: SupportLanguage[] = [
  {
    name: 'Twig',
    parsers: [twigLanguageName],
    extensions: ['.twig'],
    vscodeLanguageIds: ['twig', 'Twig'],
  },
];

export const options: SupportOptions = {
  twigSingleQuote: {
    type: 'boolean',
    category: 'TWIG',
    default: true,
    description:
      'Use single quotes instead of double quotes in Twig tags and objects.',
  },
  embeddedSingleQuote: {
    type: 'boolean',
    category: 'TWIG',
    default: true,
    description:
      'Use single quotes instead of double quotes in embedded languages (JavaScript, CSS, TypeScript inside <script>, <style> or Twig equivalent).',
  },
  singleLineLinkTags: {
    type: 'boolean',
    category: 'HTML',
    default: false,
    description: 'Always print link tags on a single line to remove clutter',
  },
};

export const defaultOptions = {
  printWidth: 120,
};

export const parsers = twigParsers as Plugin['parsers'];

export const printers = twigPrinters as any;

const plugin: Plugin<TwigHtmlNode> = {
  languages,
  parsers,
  printers,
  options,
  defaultOptions,
};

export default plugin;
