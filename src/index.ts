import { Plugin, SupportLanguage, SupportOptions } from 'prettier';
import { parsers, twigLanguageName } from '~/parser';
import { printers } from '~/printer';
import { TwigHtmlNode } from '~/types';

const languages: SupportLanguage[] = [
  {
    name: 'Twig',
    parsers: [twigLanguageName],
    extensions: ['.twig'],
    vscodeLanguageIds: ['twig', 'Twig'],
  },
];

const options: SupportOptions = {
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

const defaultOptions = {
  printWidth: 120,
};

const plugin: Plugin<TwigHtmlNode> = {
  languages,
  parsers: parsers as Plugin['parsers'],
  printers: printers as any,
  options,
  defaultOptions,
};

export = plugin;
