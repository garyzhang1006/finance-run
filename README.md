# Finance Run: Money Quest

A free browser runner that teaches kids (around ages 8 to 12) how money works. You dash through four worlds grabbing coins, jump over BUY NOW carts, dodge scam pop-ups, run through the right lane at quiz gates, and make a real money choice at every payday while saving up for a goal you picked. Every world ends in a final rush: a faster stretch with gold coins in one lane and that world's traps in the others.

## Play

No install or build step. Open `index.html` in a modern browser, or serve the folder with any static host (GitHub Pages works as is).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Switch lanes | Up / Down or W / S | Swipe up or down, or the ▲ ▼ buttons |
| Jump | Space | Tap the track, or the JUMP button |
| Pick a choice | 1, 2, 3 | Tap |
| Pause | P or Esc | ⏸ button |
| Mute | M | Pause menu |

The game pauses itself when the tab or window loses focus.

## What it teaches

Each world has its own money rule, five payday decisions, and ten quiz-gate questions. Two quiz gates stand on the road before every payday, so most of the money questions get answered while running.

| World | Money rule | Topics |
| --- | --- | --- |
| 🏡 Allowance Alley | Needs first. Pay yourself first. | Needs vs. wants, impulse buys, wait-a-week rule, spend/save/give, where to keep savings |
| 🍋 Hustle Harbor | Profit = money in minus money out. | Pricing, profit, income, reinvesting, opportunity cost, "guaranteed" deals |
| 🌴 Interest Island | Saved money grows. Time makes it grow faster. | Interest, compound interest, inflation, stocks vs. index funds, staying calm in a market drop |
| 🌃 Future City | Borrowing costs money. Protect what you have. | Borrowing and interest, debt payoff, budgeting, taxes, online scams |

The mechanics carry the lessons too:

- **Compound streak.** Every 5 coins in a row, coins are worth 10% more (25¢, then 28¢, then 30¢, up to about double). Missing a coin in your lane or hitting a trap resets it, the same way pulling money out stops it from compounding.
- **Final rush.** Each world's last payday stretch ends with waves of its traps and 50¢ gold coins in the one safe lane. Rush traps cost money but never hearts, and a rush with no hits pays a $5 bonus.
- **Wallet vs. savings.** Coins land in your wallet, where impulse carts and scams can take a bite (the more you carry, the bigger the bite). Savings are safe.
- **Saving plan.** At the start of each world you choose 10%, 25%, or 50% of everything you earn to move into savings automatically at payday.
- **Interest.** Open a bank account in World 1 and your savings earn interest every payday, compounding as you go. Game rates are super-sized (3% to 5% per payday) so kids can watch it work, and the game says so.
- **Investments and debt.** Investments swing up and down each payday, more for one company than an index fund. Borrowed money grows 10% per payday until you pay it back.
- **Joy.** Fun fades a little every payday, so saving every cent has a cost and the best grades go to balanced players.
- **Shop.** Between worlds, every item shows its opportunity cost: what that money would grow to if you saved it instead.

At the end, a report card grades your goal progress, joy, quiz score, hearts, and debt, and lists the money rules you practiced. Thirteen badges (Scam Spotter, Compound Champ, Debt Free, Rush Master, and more) stay unlocked between runs.

## Technical notes

Plain HTML, CSS, and JavaScript with no dependencies or build step.

```
index.html        screens and HUD markup
css/style.css     all styling
js/content.js     the curriculum: worlds, decision cards, quiz gates, shop, badges
js/sfx.js         sound effects and music, synthesized with WebAudio (no audio files)
js/game.js        game state, rules, spawning, collisions, paydays, grading
js/render.js      canvas drawing
js/ui.js          panels, HUD updates, input, and the main loop
tests/index.html  regression tests (see below)
```

To add or edit lessons, change `js/content.js`; the comment at the top lists every effect a choice can have. Each decision card keeps at least one free choice so a player with an empty wallet is never stuck.

Money is stored in whole cents so interest never drifts. Game speed is frame-rate independent and scales with screen width so phones get the same reaction time as laptops. Best score, badges, and settings live in `localStorage` (wrapped so a blocked storage never crashes the game); nothing is sent to a server. Fonts load from Google Fonts with system fallbacks, and the game respects the reduced-motion setting.

## Tests

`tests/index.html` runs 36 regression checks against the real game in an iframe: money math at payday, debt and borrowing, every decision card's money adding up, frame-rate independence, blocked storage, lane alignment, pause, both quiz gates in each stretch, traps, the shop, the coin streak, the final rush layout and bonus, keyboard keys, swipes and touch buttons, the title and pause menus, every world's drawing, screen shake after a game over, sound in a hidden tab, and a full 4-world run. One check is a seeded random-input fuzz run through menus, the shop, pause, and four full runs that fails on any negative or fractional balance, impossible hearts or joy, or a panel left open mid-run. Browsers block file-to-file iframe access, so serve the folder first:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/tests/` and read the summary line at the top.

## License

[MIT](LICENSE)
