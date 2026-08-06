# Finance Run

A browser-based financial-literacy runner. Dodge bills and scams, collect cash and investments, then make a money decision at every payday. Survive three years without overdrafting.

## Play

No install or build step required. Open `index.html` in a modern browser.

## Controls

- **Up / Down arrows** or **W / S**: switch lanes
- **Tap upper or lower half of the game**: switch lanes on touch devices
- **P**: pause or resume
- **1, 2, 3**: choose a payday decision

## What it teaches

The game uses 36 payday decisions across three stages:

- **Year 1: First Job** — build a starter budget and credit habits.
- **Year 2: Moved Out** — manage rent, recurring costs, and larger financial choices.
- **Year 3: Big Money Era** — balance investing, lifestyle, and long-term goals.

Choices affect cash, investments, debt, credit score, and vibes. Every decision ends with a short explanation of the financial principle behind it. At the end of a run, the receipt grades net worth, credit, and quality of life.

## Technical notes

Finance Run is a dependency-free single-page app. All HTML, CSS, and JavaScript live in `index.html`. High scores are stored only in the browser with `localStorage` under `fr-hiscore`; no data is sent to a server. The UI respects the browser's reduced-motion preference.

## License

[MIT](LICENSE)
