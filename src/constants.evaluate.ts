// This code is adapted from prettier/src/language-html/constants.evaluate.js
const htmlStyles: any = require('html-styles');

const getCssStyleTags = (property: string) =>
  Object.fromEntries(
    htmlStyles
      .filter((htmlStyle: any) => htmlStyle.style[property])
      .flatMap((htmlStyle: any) =>
        htmlStyle.selectorText
          .split(',')
          .map((selector: any) => selector.trim())
          .filter((selector: any) => /^[\dA-Za-z]+$/.test(selector))
          .map((tagName: any) => [tagName, htmlStyle.style[property]]),
      ),
  );

export const CSS_DISPLAY_TAGS: Record<string, string> = {
  ...getCssStyleTags('display'),

  // TODO: send PR to upstream
  button: 'inline-block',

  // special cases for some css display=none elements
  template: 'inline',
  source: 'block',
  track: 'block',
  script: 'block',
  param: 'block',

  // `noscript` is inline
  // noscript: "inline",

  // there's no css display for these elements but they behave these ways
  details: 'block',
  summary: 'block',
  dialog: 'block',
  meter: 'inline-block',
  progress: 'inline-block',
  object: 'inline-block',
  video: 'inline-block',
  audio: 'inline-block',
  select: 'inline-block',
  option: 'block',
  optgroup: 'block',
};

export const CSS_DISPLAY_TWIG_TAGS: Record<string, string> = {
  // control flow tags
  if: 'inline',
  else: 'inline',
  elseif: 'inline',

  // iteration tags
  for: 'inline',

  // template tags
  include: 'inline',
  raw: 'inline',
  verbatim: 'inline',

  // asset tags
  css: 'none',
  js: 'none',
  script: 'none',
  style: 'none',
};

export const CSS_DISPLAY_TWIG_DEFAULT = 'inline';

export const CSS_DISPLAY_DEFAULT = 'inline';
export const CSS_WHITE_SPACE_TAGS: Record<string, string> =
  getCssStyleTags('white-space');
export const CSS_WHITE_SPACE_DEFAULT = 'normal';

export const CSS_WHITE_SPACE_TWIG_TAGS: Record<string, string> = {
  raw: 'pre',
  verbatim: 'pre',
};
