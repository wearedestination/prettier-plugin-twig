## Project Overview

This project is a Prettier plugin for formatting Twig templates. It is a fork of the [Shopify Liquid Prettier plugin](https://github.com/Shopify/theme-tools/tree/main/packages/prettier-plugin-liquid), adapted to work with Twig syntax instead of Liquid. Much of the underlying parser, printer, and formatting logic still mirrors the upstream Liquid plugin — when investigating behavior or making changes, it can be useful to keep the Liquid origin in mind.

Because of the Liquid heritage, the parser name is still `liquid-html` and many internal types/files retain `liquid` in their names (e.g. `LiquidParserOptions`, `printer-liquid-html.ts`). This is intentional — don't rename them.

For a technical overview of how parsing/printing works, see `HOW_IT_WORKS.md` and `docs/whitespace-handling.md`.

## Package Manager

You must use `pnpm` instead of `npm` for managing dependencies. To install dependencies, run:

```bash
pnpm install
```

You must also use `pnpm` for running scripts defined in `package.json`. For example, to run tests, use:

```bash
pnpm test
```

When testing changes in the CLI, use the `prettier` package.json script instead of using prettier directly. This script wires up the locally-built plugin from `dist/`, so you must run `pnpm build` first after any source change.

## Source layout

- `src/parser/` — Ohm grammar (`grammar/liquid-html.ohm`) → CST (`stage-1-cst.ts`) → AST (`stage-2-ast.ts`).
- `src/printer/` — turns the AST into a Prettier `Doc`. `printer-liquid-html.ts` is the entry point; `print/` holds per-node printers and `preprocess/` holds AST transformations applied before printing.
- `src/index.ts` — Prettier plugin definition (parsers, printers, options).

## Tests

Tests are fixture-based. Each directory under `test/` contains:

- `index.html.twig` — input
- `fixed.html.twig` — expected output after formatting
- `index.spec.ts` — usually a one-liner calling `assertFormattedEqualsFixed(__dirname)` from `test/test-helpers.ts`

A single fixture file can hold multiple test cases separated by a blank line followed by a comment/keyword (see `PARAGRAPH_SPLITTER` in `test-helpers.ts`). The first line of each chunk becomes the test name and supports prefixes:

- `// focus` — run only this case (`it.only`)
- `// debug` — run only this case and trigger the debugger via `debug()`
- `// skip` — skip this case
- Inline options like `// printWidth: 40` are parsed and passed to Prettier for that case.

To add a new test, copy an existing `test/<name>/` directory, rename it, and edit the `.html.twig` files. The spec file rarely needs changes.

Idempotence (running the formatter twice produces the same output) is checked via `pnpm test:idempotence`.

## Build

`pnpm build` runs three steps: `build:shims`, `build:ts` (tsc + tsc-alias), and `build:standalone` (webpack bundle for the browser playground). Run a full `pnpm build` before exercising the `pnpm prettier` script.