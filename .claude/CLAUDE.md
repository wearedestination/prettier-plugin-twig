## Project Overview

This project is a Prettier plugin for formatting Twig templates. It is a fork of the [Shopify Liquid Prettier plugin](https://github.com/Shopify/theme-tools/tree/main/packages/prettier-plugin-liquid), adapted to work with Twig syntax instead of Liquid. Much of the underlying parser, printer, and formatting logic still mirrors the upstream Liquid plugin — when investigating behavior or making changes, it can be useful to keep the Liquid origin in mind.

## Package Manager

You must use `yarn` instead of `npm` for managing dependencies. To install dependencies, run:

```bash
yarn install
```

You must also use `yarn` for running scripts defined in `package.json`. For example, to run tests, use:

```bash
yarn test
```

When testing changes in the CLI, use the `prettier2` and `prettier3` package.json scripts instead of using prettier directly.
