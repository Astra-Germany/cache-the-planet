# Third-Party Notices

Dieses Dokument ergänzt die [`LICENSE`](LICENSE) für Abhängigkeiten und nicht als Quellcode vorliegende Projektdateien.

## Direkte npm-Abhängigkeit

### esbuild

- Paket: `esbuild`
- Verwendung: Bundling der GitHub-Action aus `src/` nach `dist/`
- Lizenz: MIT
- Quelle: [esbuild](https://github.com/evanw/esbuild)

Die plattformspezifischen optionalen `@esbuild/*`-Pakete werden über `esbuild` installiert und sind ebenfalls MIT-lizenziert. Die exakten Versionen und Integritätswerte stehen in [`package-lock.json`](package-lock.json).

## README-Banner

`docs/assets/cache-the-planet-banner.png` wurde als projektspezifische Grafik generiert und enthält keine übernommenen Logos, Marken oder externen Bildbestandteile. Für die Erstellung wurde ein generatives Bildwerkzeug verwendet. Die Nutzung des Bildes sollte bei einer Weiterverteilung zusätzlich anhand der zum Erstellungszeitpunkt geltenden Nutzungsbedingungen des verwendeten Dienstes geprüft werden.

## Weitere Actions

Die in `.github/workflows/` verwendeten GitHub Actions sind eigenständige Drittanbieter-Software. Ihre Lizenzen und Nutzungsbedingungen gelten unabhängig von der MIT-Lizenz dieses Repositorys und sollten anhand der jeweils referenzierten Action-Version geprüft werden.
