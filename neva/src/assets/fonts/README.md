# Licensed fonts (optional)

Neva uses one sans-serif for all text: **Graphik** (Commercial Type) if available, otherwise the free stand-in
Hanken Grotesk. Graphik is a commercial font and is **not** included here (pratt.edu's own font files are licensed
to Pratt and must not be copied). To use it on Neva:

1. Buy a **web** licence for Graphik from commercialtype.com.
2. Put the WOFF2 files in this folder, named as below (any you don't have can be left out):

```
Graphik-Regular.woff2         Graphik-RegularItalic.woff2   Graphik-Medium.woff2
Graphik-Semibold.woff2        Graphik-Bold.woff2            Graphik-BoldItalic.woff2   Graphik-Black.woff2
```

3. Rebuild. `src/lib/fonts.ts` finds the files, bundles them and registers them automatically.

Readers who have Graphik installed on their computer already see it without any files here.
