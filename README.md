# KDE system settings vicinae extension

search and open KDE system settings modules directly from vicinae.

## installation

```bash
pnpm install
pnpm run build
```

## usage

search for the "search system settings" command in vicinae to search/browse all available KDE settings modules.

to enable it as a fallback command (to use the root search query as the search input):

1. search for "configure fallback commands" in vicinae
2. enable "Search System Settings"
3. now searching for KDE settings modules will be a fallback option in the root search

## development

```bash
pnpm run dev
```
