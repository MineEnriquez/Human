# Licensed fonts (optional)

Neva uses the same typefaces as pratt.edu, in the same roles:

| Role | Typeface | Free stand-in used until you add it |
|---|---|---|
| UI, navigation, headings | **Graphik** (Commercial Type) | Hanken Grotesk |
| Reading text | **Tiempos Text** (Klim Type Foundry) | Source Serif 4 |
| Emphasised words in headlines | **Tiempos Fine**, light italic (Klim) | Newsreader light italic |

Both are commercial fonts and are **not** included here: Pratt's own font files are licensed to Pratt and must not
be copied. To use them on Neva:

1. Buy a **web** licence: Graphik from commercialtype.com, Tiempos Text and Tiempos Fine from klim.co.nz.
2. Put the WOFF2 files in this folder, named as below (any you don't have can be left out):

```
Graphik-Regular.woff2         Graphik-RegularItalic.woff2   Graphik-Medium.woff2
Graphik-Semibold.woff2        Graphik-Bold.woff2            Graphik-BoldItalic.woff2   Graphik-Black.woff2
TiemposText-Regular.woff2     TiemposText-RegularItalic.woff2
TiemposText-Semibold.woff2    TiemposText-SemiboldItalic.woff2
TiemposFine-Light.woff2       TiemposFine-LightItalic.woff2
```

3. Rebuild. `src/lib/fonts.ts` finds the files, bundles them and registers them automatically.

Readers who have Graphik or Tiempos installed on their computer already see them without any files here.
