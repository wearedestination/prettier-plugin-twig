# Twig Prettier Plugin

This is a fork of the excellent [Shopify Liquid Prettier Plugin](https://github.com/Shopify/prettier-plugin-liquid).

As Liquid and Twig are quite similar, we were able to make minimal changes to the original plugin to support Twig.

[Prettier](https://prettier.io) is an opinionated code formatter. It enforces a consistent style by parsing your code and re-printing it with its own rules that take the maximum line length into account, wrapping code when necessary.

![demo](https://github.com/Shopify/prettier-plugin-liquid/blob/main/docs/demo.gif?raw=true)

## Can this be used in production?

Yes! It's also available in the [Online Store Code Editor](https://shopify.dev/themes/tools/code-editor#formatting-theme-code).

## Installation

```bash
# with npm
npm install --save-dev prettier @shopify/prettier-plugin-liquid

# with yarn
yarn add --dev prettier @shopify/prettier-plugin-liquid
```

For Prettier version 3 and above, the plugin must also be declared in the [configuration](https://prettier.io/docs/en/configuration.html).

```
{
  "plugins": ["@shopify/prettier-plugin-liquid"]
}
```

## Usage

See our [Wiki](https://github.com/Shopify/prettier-plugin-liquid/wiki) pages on the subject:

- [In the terminal](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-your-terminal) (with Node.js)
- [In the browser](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-the-browser)
- [In your editor](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-your-editor)
- [In a CI workflow](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-CI)
- [As a pre-commit hook](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-as-a-pre-commit-hook)
- [With a bundler](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-with-a-bundler)

## Playground

You can try it out in your browser in the [playground](https://shopify.github.io/prettier-plugin-liquid/).

## Configuration

Prettier for Liquid supports the following options.

| Name                        | Default   | Description                                                                                                                                                              |
| ------------------          | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `printWidth`                | `120`     | Changed from Prettier's default (`80`) ([see prettier docs](https://prettier.io/docs/en/options.html#print-width))                                                       |
| `tabWidth`                  | `2`       | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#tab-width))                                                                            |
| `useTabs`                   | `false`   | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#tabs))                                                                                 |
| `singleQuote`               | `false`   | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#quotes))                                                                               |
| `bracketSameLine`           | `false`   | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#bracket-line))                                                                         |
| `liquidSingleQuote`         | `true`    | Use single quotes instead of double quotes in Liquid tag and objects (since v0.2.0).                                                                                     |
| `embeddedSingleQuote`       | `true`    | Use single quotes instead of double quotes in embedded languages (JavaScript, CSS, TypeScript inside `<script>`, `<style>` or Liquid equivalent) (since v0.4.0).         |
| `htmlWhitespaceSensitivity` | `css`     | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#html-whitespace-sensitivity))                                                          |
| `singleLineLinkTags`        | `false`   | If set to `true`, will print `<link>` tags on a single line to remove clutter                                                                                            |
| `indentSchema`              | `false`   | If set to `true`, will indent the contents of the `{% schema %}` tag                                                                                                     |

## Ignoring code

We support the following comments (either via HTML or Liquid comments):

- `prettier-ignore`
- `prettier-ignore-attribute`
- `prettier-ignore-attributes` (alias)

They target the next node in the tree. Unparseable code can't be ignored and will throw an error.

```liquid
{% # prettier-ignore %}
<div         class="x"       >hello world</div            >

{% # prettier-ignore-attributes %}
<div
  [[#if Condition]]
    class="a b c"
  [[/if ]]
></div>
```

## Known issues

Take a look at our [known issues](./KNOWN_ISSUES.md) and [open issues](https://github.com/Shopify/prettier-plugin-liquid/issues).

## Contributing

[Read our contributing guide](CONTRIBUTING.md)

## License

MIT.
