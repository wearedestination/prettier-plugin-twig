import { printerTwigHtml } from '~/printer/printer-twig-html';
import { twigHtmlAstFormat } from '~/parser';

export const printers = {
  [twigHtmlAstFormat]: printerTwigHtml,
};
