"use strict";
/* =================================================================
   FINANCE RUN: the curriculum.
   Money amounts here are in dollars; the engine converts to cents.

   Choice effects (all optional):
     wallet   +/- dollars in your wallet (negative = it costs that much)
     toSave   move dollars from wallet into savings
     saveIn   dollars that go straight into savings (a gift you save)
     saveOut  move dollars from savings back to the wallet
     saveHalf move half of your wallet into savings
     invest   move dollars from wallet into investments
     risk     "low" (index fund) or "high" (one company) for new investments
     investPct grow/shrink investments by this fraction right now
     rebound  investments recover +30% at the next payday (only if you hold)
     sellAll  sell every investment into savings
     debt     dollars you now owe (borrowing)
     payDebt  pay this many dollars of debt from your wallet ("max" = all you can)
     rate     savings interest per payday (only ever goes up)
     income   permanent change to income every payday
     joy      +/- joy (0..100)
     gave     dollars given to others (for the Big Heart badge)
     shield   +1 emergency-fund shield
     hearts   +/- hearts
   A choice is locked when its cost is more than you have. Every card keeps
   at least one free choice so a broke player is never stuck.
   ================================================================= */

const GOALS = [
  { id: "bike",    emoji: "🚲", name: "New Bike",     price: 120, blurb: "A starter goal. Very doable." },
  { id: "puppy",   emoji: "🐶", name: "Puppy Fund",   price: 200, blurb: "Takes a real saving plan." },
  { id: "console", emoji: "🎮", name: "Game Console", price: 300, blurb: "Hard mode. Save hard, run smart." }
];

const RUNNERS = [
  { id: "penny",  name: "Penny",  body: "#ff6fb5", trim: "#ffd84d", skin: "#ffd9b8", hair: "#5a2d0c" },
  { id: "nico",   name: "Nico",   body: "#34d1bf", trim: "#ffffff", skin: "#c98b5e", hair: "#1b1035" },
  { id: "buck",   name: "Buck",   body: "#ff9f1c", trim: "#2b2d42", skin: "#8d5b3c", hair: "#0d0d0d" }
];

const WORLDS = [
 {
  id: "allowance", name: "Allowance Alley", emoji: "🏡",
  rule: "Needs first. Pay yourself first.",
  intro: "You get an allowance every payday. Grab coins, dodge the BUY NOW carts, and decide where your money goes.",
  income: 10,
  cards: [
   { emoji: "💵", t: "Bonus cash!",
     b: "You earned an extra $10 for helping clean the garage. The candy shop is right there, glowing.",
     c: [
      { l: "Spend all $10 on candy", e: { joy: 6 }, tag: "Needs vs. wants",
        x: "Candy is a *want*. Spending everything right away leaves $0 for your goal. Fun is fine, it just works better with a plan." },
      { l: "Save $5, spend $5", e: { saveIn: 5, joy: 4 }, tag: "Pay yourself first",
        x: "That's *pay yourself first*: you saved BEFORE you shopped, and you still got a treat." },
      { l: "Put all $10 in savings", e: { saveIn: 10, joy: -2 }, tag: "Saving",
        x: "Super saver! A little fun money keeps saving from feeling like a punishment, so don't forget to enjoy some of it later." }
     ] },
   { emoji: "🏦", t: "Where should savings live?",
     b: "You have money to keep safe. Where does it go?",
     c: [
      { l: "In a sock under my bed", e: { joy: 1 }, tag: "Keeping money safe",
        x: "Hidden cash can get lost or chewed by the dog, and it *never grows*. Money sitting in a sock stays the same size forever." },
      { l: "In my piggy bank", e: {}, tag: "Keeping money safe",
        x: "Safe and easy to see! But a piggy bank pays *zero interest*, so your money stays the same size." },
      { l: "A kids' savings account at a bank", e: { rate: 0.03 }, tag: "Interest",
        x: "Banks *pay you extra* for keeping money there. That extra is called *interest*. Game interest is super-sized (3% every payday) so you can watch it work. Real banks pay about 1% to 5% a YEAR." }
     ] },
   { emoji: "🤖", t: "The toy aisle trap",
     b: "A light-up robot costs $18. You didn't want it five minutes ago. Now you NEED it. Or do you?",
     c: [
      { l: "Buy it right now!", e: { wallet: -18, joy: 3 }, tag: "Impulse buying",
        x: "That's an *impulse buy*: buying on a sudden feeling, not a plan. The excitement usually fades in a few days, but the money stays gone." },
      { l: "Wait a week, then decide", e: { joy: 1 }, tag: "Delayed gratification",
        x: "The *wait-a-week rule*! If you still want it in a week, plan for it. Most of the time the wanting just fades away." },
      { l: "Make it a goal and save $5 toward it", e: { toSave: 5, joy: 2 }, tag: "Goal setting",
        x: "Turning a want into a *goal* is a pro move. Getting something you saved up for feels way better than grabbing it." }
     ] },
   { emoji: "🎂", t: "Birthday money from Grandma",
     b: "Grandma's card has $20 inside! How do you split it?",
     c: [
      { l: "Spend all $20 on a new game", e: { joy: 6 }, tag: "Spend, save, give",
        x: "Spending a gift is allowed! A *spend, save, give* split just makes gifts go further." },
      { l: "Spend $10, save $8, give $2", e: { saveIn: 8, gave: 2, joy: 6 }, tag: "Spend, save, give",
        x: "Three jars! *Spend* for fun now, *save* for later, *give* to help someone else. Every dollar got a job." },
      { l: "Save all $20", e: { saveIn: 20, joy: 1 }, tag: "Saving",
        x: "Your goal just jumped $20 closer. Gifts are the easiest money to save because you weren't counting on them." }
     ] },
   { emoji: "👟", t: "Shoes or a game skin?",
     b: "Your sneakers have a giant hole. New ones cost $15. A cool game skin also costs $15. You can only pick one.",
     c: [
      { l: "The skin, obviously", e: { wallet: -15, joy: -1 }, tag: "Needs vs. wants",
        x: "Soggy socks all week! Shoes are a *need* and a skin is a *want*. Needs come first, then wants." },
      { l: "New shoes", e: { wallet: -15, joy: 3 }, tag: "Needs vs. wants",
        x: "*Needs first.* Taking care of what you need stops small problems from turning into big ones." },
      { l: "Tape the hole, buy nothing", e: { joy: -3 }, tag: "Needs vs. wants",
        x: "Saving is great, but skipping real needs can cost more later. *Needs are worth paying for.*" }
     ] }
  ],
  quiz: [
   { q: "Which one is a NEED?", a: ["Water", "Toy car", "Candy"], why: "You can't live without water. Toys and candy are wants." },
   { q: "Which one is a WANT?", a: ["Video game", "Food", "Warm coat"], why: "Games are fun, but you can live without one." },
   { q: "Pay yourself first means...", a: ["Save first", "Shop first", "Borrow first"], why: "Move money to savings BEFORE you spend the rest." },
   { q: "Best place to keep savings?", a: ["A bank", "The couch", "Your pocket"], why: "Banks keep money safe and pay you interest." },
   { q: "An impulse buy has...", a: ["No plan", "A budget", "A goal"], why: "Impulse buys happen on a sudden feeling, without a plan." },
   { q: "Which one is a NEED?", a: ["Shoes", "Stickers", "Slime"], why: "Shoes protect your feet. Stickers and slime are wants." },
   { q: "$10 minus $4 spent leaves...", a: ["$6", "$14", "$4"], why: "Knowing what's left is the heart of budgeting." },
   { q: "A savings goal needs...", a: ["A price", "A wish", "Luck"], why: "A real goal has a price, a plan, and a deadline." }
  ]
 },
 {
  id: "hustle", name: "Hustle Harbor", emoji: "🍋",
  rule: "Profit = money in minus money out.",
  intro: "Time to earn! You run a lemonade stand by the docks. Smart business choices can raise your income for the rest of the run.",
  income: 10,
  cards: [
   { emoji: "🍋", t: "Lemonade stand: set your price",
     b: "Lemons, sugar, and cups cost $8. Mom pays for them and you pay her back from sales. What do you charge per cup?",
     c: [
      { l: "$5 a cup. Big money!", e: { wallet: 2, joy: -1 }, tag: "Pricing",
        x: "Only 2 people bought. *Sales $10 minus costs $8 = $2 profit.* Price too high and customers walk away." },
      { l: "$1 a cup", e: { wallet: 12, joy: 3 }, tag: "Profit",
        x: "20 cups sold! *Sales $20 minus costs $8 = $12 profit.* A fair price brought lots of customers." },
      { l: "10 cents a cup", e: { joy: -2 }, tag: "Pricing",
        x: "30 cups sold, but sales were only $3, so Mom covered the rest and you made *zero*. A price has to at least *cover your costs*." }
     ] },
   { emoji: "🐕", t: "A dog-walking job",
     b: "Your neighbor will pay you to walk their dog, Biscuit, every week.",
     c: [
      { l: "Yes! +$3 every payday", e: { income: 3, joy: 2 }, tag: "Income",
        x: "Steady *income* is powerful. $3 every payday adds up to way more than one lucky find." },
      { l: "Only if they pay $20 a walk", e: { joy: -1 }, tag: "Pricing",
        x: "They hired someone else. Asking way too much can mean *no job at all*." },
      { l: "Nah, I'd rather play", e: { joy: 3 }, tag: "Opportunity cost",
        x: "Free time matters too! Every choice gives something up. Here you traded money for play. That trade is called *opportunity cost*." }
     ] },
   { emoji: "📣", t: "Your stand needs customers",
     b: "A poster kit costs $6. Or you could make signs yourself.",
     c: [
      { l: "Buy posters ($6): +$2 every payday", e: { wallet: -6, income: 2 }, tag: "Reinvesting",
        x: "Spending money to *make* money is *investing in your business*. $6 now, $2 back every payday. It pays for itself in 3 paydays." },
      { l: "Draw signs myself for free", e: { income: 1, joy: 2 }, tag: "Reinvesting",
        x: "Creative and free! Smart owners find cheap ways to grow. *+$1 every payday.*" },
      { l: "No ads. People will find me.", e: {}, tag: "Business",
        x: "Customers can't buy from you if they *don't know you exist*." }
     ] },
   { emoji: "🍪", t: "A 'guaranteed' deal",
     b: "A kid with a cookie stand says: give me $10 today and I'll give you $30 tomorrow. Guaranteed!",
     c: [
      { l: "Deal! Free money!", e: { wallet: -10, joy: -3 }, tag: "Scams",
        x: "He never showed up. When someone promises *big money, fast, guaranteed*, it's almost always a scam." },
      { l: "No thanks, too good to be true", e: { joy: 1 }, tag: "Scams",
        x: "Exactly right. *If it sounds too good to be true, it probably is.*" },
      { l: "Team up: lemonade AND cookies", e: { income: 1, joy: 3 }, tag: "Business",
        x: "Partnering can grow both businesses. Good deals are *fair and clear* for both sides, with nothing 'guaranteed'. *+$1 every payday.*" }
     ] },
   { emoji: "🌅", t: "Summer's over. Now what?",
     b: "Your stand made money all summer. What do you do with your wallet?",
     c: [
      { l: "Pizza party for the crew ($12)", e: { wallet: -12, joy: 6, gave: 4 }, tag: "Balance",
        x: "Celebrating and sharing is great! Just make sure *some* profit gets saved too." },
      { l: "Save half of my wallet", e: { saveHalf: true, joy: 1 }, tag: "Saving",
        x: "Half saved, half free. Saving part of every win is how *profit turns into wealth*." },
      { l: "Better juicer ($8): +$2 every payday", e: { wallet: -8, income: 2 }, tag: "Reinvesting",
        x: "Better tools, more lemonade, more *income every payday*. Reinvesting grows a business." }
     ] }
  ],
  quiz: [
   { q: "Profit is money in minus...", a: ["Costs", "Fun", "Coins"], why: "Profit is what's left after you pay your costs." },
   { q: "Money you earn from work is...", a: ["Income", "Interest", "Luck"], why: "Income is money you earn, like pay or allowance." },
   { q: "5 cups at $2 each = ?", a: ["$10", "$7", "$3"], why: "5 times $2 is $10. That's your sales, before costs." },
   { q: "Sales $10, costs $4. Profit?", a: ["$6", "$14", "$10"], why: "$10 in minus $4 out leaves $6 profit." },
   { q: "A good price should...", a: ["Cover costs", "Be $100", "Be free"], why: "If your price doesn't cover costs, you lose money." },
   { q: "Someone who starts a business", a: ["Entrepreneur", "Customer", "Banker"], why: "An entrepreneur starts and runs a business." },
   { q: "Giving up one thing for another", a: ["Opportunity cost", "Discount", "Refund"], why: "Opportunity cost is what you give up when you choose." },
   { q: "Spending to grow your business", a: ["Reinvesting", "Wasting", "Gambling"], why: "Reinvesting puts profit back in to earn more later." }
  ]
 },
 {
  id: "island", name: "Interest Island", emoji: "🌴",
  rule: "Saved money grows. Time makes it grow faster.",
  intro: "On this island, money grows on trees. Well, kind of. Learn how interest and investing make money bigger while you sleep.",
  income: 10,
  cards: [
   { emoji: "🏦", t: "The island bank's offer",
     b: "Island Bank offers a savings account that pays 5% every payday. Compare that with what your savings earn now.",
     c: [
      { l: "Switch to the 5% account", e: { rate: 0.05 }, tag: "Comparing rates",
        x: "More interest means faster growth. *Comparing rates* is one of the easiest money wins there is." },
      { l: "Keep things how they are", e: {}, tag: "Comparing rates",
        x: "That's allowed, but you might be leaving growth behind. *Always check where your money earns the most.*" },
      { l: "Take $10 out for ice cream", e: { saveOut: 10, wallet: -10, joy: 4 }, tag: "Saving",
        x: "Yum. But money pulled out of savings *stops growing*. Savings work best when you leave them alone." }
     ] },
   { emoji: "⏰", t: "Save now or save later?",
     b: "You can put $10 into savings today. Your cousin says to wait, because there's always next time.",
     c: [
      { l: "Put $10 in right now", e: { toSave: 10, joy: 1 }, tag: "Compound interest",
        x: "Starting early lets interest earn interest on itself. That's *compound interest*, and *time* is its secret ingredient." },
      { l: "Wait and save later", e: { joy: 1 }, tag: "Compound interest",
        x: "Every payday you wait is a payday of growth your money misses. *The earlier you start, the less you need to save.*" },
      { l: "Forget it, buy a snorkel ($10)", e: { wallet: -10, joy: 4 }, tag: "Opportunity cost",
        x: "Fun! Just know that a dollar spent today can't grow into more dollars tomorrow." }
     ] },
   { emoji: "🍫", t: "Why does candy cost more?",
     b: "Your favorite chocolate bar cost $1.00 last year. Now it's $1.10. What happened?",
     c: [
      { l: "The store is being mean", e: {}, tag: "Inflation",
        x: "It's not just one store. When prices of lots of things rise over time, it's called *inflation*. Money that sits still slowly buys less." },
      { l: "Prices rise over time (inflation)", e: { wallet: 3, joy: 1 }, tag: "Inflation",
        x: "You won the class trivia prize: $3! *Inflation* means prices creep up each year. Earning interest helps your money keep up." },
      { l: "Buy 20 bars now before it gets worse ($20)", e: { wallet: -20, joy: 2 }, tag: "Inflation",
        x: "A mountain of chocolate that might melt first! Stocking up isn't the fix. *Letting savings grow* is the better way to beat inflation." }
     ] },
   { emoji: "📈", t: "Own a piece of a company",
     b: "You can buy a tiny piece of ONE company (a stock), or an index fund that owns a little bit of hundreds of companies.",
     c: [
      { l: "$10 on one trendy company", e: { invest: 10, risk: "high" }, tag: "Risk",
        x: "One company can soar or crash. Putting *all your eggs in one basket* is risky! Watch your 📈 number swing at each payday." },
      { l: "$10 in an index fund", e: { invest: 10, risk: "low" }, tag: "Diversification",
        x: "That's *diversification*: owning lots of companies so one bad one can't sink you. Investments can drop for a while, but over many years they have usually grown." },
      { l: "Not yet, keep it in savings", e: {}, tag: "Risk",
        x: "Totally fine. *Invest only money you won't need for a long time.*" }
     ] },
   { emoji: "📉", t: "The market just dropped!",
     b: "Breaking news: stocks fell 20% today! If you own investments, they just shrank. Everyone online is panicking.",
     c: [
      { l: "SELL everything before it drops more!", e: { investPct: -0.2, sellAll: true, joy: -2 }, tag: "Patience",
        x: "Selling after a drop *locks in the loss*. Markets have always bounced back eventually, but only for people who stayed in." },
      { l: "Stay calm and hold", e: { investPct: -0.2, rebound: true, joy: 1 }, tag: "Patience",
        x: "That's what long-term investors do. *Drops are normal.* Watch what happens at the next payday." },
      { l: "Buy $5 more while it's on sale", e: { investPct: -0.2, invest: 5, rebound: true }, tag: "Patience",
        x: "Brave! Buying when prices are low can pay off for *long-term* investors. Only invest money you won't need soon." }
     ] }
  ],
  quiz: [
   { q: "Money a bank pays YOU", a: ["Interest", "A fee", "A tax"], why: "Interest is money the bank pays you for saving with them." },
   { q: "Interest on your interest", a: ["Compound", "Simple", "Magic"], why: "Compound interest grows on top of earlier interest." },
   { q: "Prices rising over time", a: ["Inflation", "Donation", "Profit"], why: "Inflation slowly makes things cost more." },
   { q: "Owning many investments", a: ["Diversify", "Gamble", "Panic"], why: "Diversifying spreads out your risk." },
   { q: "A tiny piece of a company", a: ["Stock", "Coupon", "Receipt"], why: "A share of stock means you own a tiny bit of a company." },
   { q: "Compound interest's best friend", a: ["Time", "Luck", "Hype"], why: "The longer money grows, the faster it grows." },
   { q: "$100 at 10% interest earns...", a: ["$10", "$1", "$100"], why: "10% of $100 is $10." },
   { q: "Market drops. Investors should...", a: ["Stay calm", "Sell all", "Hide"], why: "Long-term investors ride out the drops." }
  ]
 },
 {
  id: "future", name: "Future City", emoji: "🌃",
  rule: "Borrowing costs money. Protect what you have.",
  intro: "A sneak peek at grown-up money: borrowing, budgets, taxes, and the trickiest scams yet. Final world, fastest traps!",
  income: 10,
  cards: [
   { emoji: "🙋", t: "Borrow from your big sister?",
     b: "You want a $20 game right now. Your sister will lend you the money, but you have to pay her back $25.",
     c: [
      { l: "Borrow it! Pay her later.", e: { debt: 25, joy: 4 }, tag: "Borrowing",
        x: "You got the game, but now you *owe $25 for a $20 game*. The extra $5 is *interest*, the price of borrowing. And unpaid debt grows every payday!" },
      { l: "Save up for two paydays instead", e: { joy: -1 }, tag: "Borrowing",
        x: "Waiting means the game costs $20, not $25. *Saving first is cheaper than borrowing.*" },
      { l: "Pay with my own $20", e: { wallet: -20, joy: 4 }, tag: "Borrowing",
        x: "Your own money means *no debt and no interest*. That's the cheapest way to buy anything." }
     ] },
   { emoji: "🎡", t: "A budget for the fair",
     b: "Your parents give you $30 for the fair: rides, food, and games. How do you plan the day?",
     c: [
      { l: "Spend it all on the first 3 rides", e: { joy: 1 }, tag: "Budgeting",
        x: "Out of money by noon and still hungry! A *budget* gives every dollar a job BEFORE you spend it." },
      { l: "Plan it: $12 rides, $10 food, $8 games", e: { joy: 7 }, tag: "Budgeting",
        x: "That's a *budget*! Planning ahead made the money last all day." },
      { l: "Plan it AND bring $5 home to save", e: { saveIn: 5, joy: 5 }, tag: "Budgeting",
        x: "Budget master! You had a great day *and* had money left to save." }
     ] },
   { emoji: "🧾", t: "Debt check!",
     b: "Any money you owe has been growing with interest every payday. What's your plan?",
     c: [
      { l: "Pay off as much as I can", e: { payDebt: "max" }, tag: "Paying off debt",
        x: "Paying debt fast *stops interest from piling up*. Getting to $0 owed is a huge win.",
        x0: "You don't owe anyone anything, so there's nothing to pay! *Being debt-free* means all your money works for you." },
      { l: "Pay $5 and keep the rest", e: { payDebt: 5 }, tag: "Paying off debt",
        x: "Small payments help, but *interest keeps growing* on whatever is left.",
        x0: "No debt to pay, so your $5 stays put. Debt-free is the best kind of free." },
      { l: "Ignore it. It'll go away.", e: {}, tag: "Paying off debt",
        x: "Debt never disappears on its own. *Interest makes it bigger* every payday you wait.",
        x0: "You have no debt, so ignoring it works this time! For people who do owe money, ignoring it makes it bigger." }
     ] },
   { emoji: "🏫", t: "Where do taxes go?",
     b: "Your aunt's paycheck says some money went to 'taxes'. Where does it go?",
     c: [
      { l: "The government just keeps it", e: {}, tag: "Taxes",
        x: "Taxes pay for things we share: *schools, roads, parks, libraries, and firefighters*." },
      { l: "Schools, roads, parks, firefighters", e: { wallet: 3, joy: 1 }, tag: "Taxes",
        x: "Correct, and you won $3 at trivia night! *Taxes* are how a community pays for things everyone uses." },
      { l: "Nowhere. It's a mistake.", e: {}, tag: "Taxes",
        x: "It's on purpose! Taxes pay for *schools, roads, parks, libraries, and firefighters*." }
     ] },
   { emoji: "🎁", t: "FINAL BOSS: FREE GEMS!!!",
     b: "A pop-up flashes: 'YOU WON 10,000 FREE GEMS! Type your parent's password and card number in 60 seconds to claim!'",
     c: [
      { l: "Type it in! FREE GEMS!", e: { wallet: -15, hearts: -1, joy: -4 }, tag: "Online safety",
        x: "That was a *scam*. Real companies never ask for passwords or card numbers in a pop-up. Scammers use FREE and HURRY to rush you." },
      { l: "Close it and tell a grown-up", e: { joy: 2, shield: 1 }, tag: "Online safety",
        x: "Perfect. When something online asks for passwords or money, *stop and ask a trusted adult*. You earned a shield!" },
      { l: "Ask a friend if they got gems too", e: { joy: -1 }, tag: "Online safety",
        x: "Checking is smart, but this one is fake either way. *Anything asking for passwords or card numbers is a scam.*" }
     ] }
  ],
  quiz: [
   { q: "The extra cost of borrowing", a: ["Interest", "Allowance", "A bonus"], why: "Lenders charge interest for letting you borrow." },
   { q: "Money you owe someone", a: ["Debt", "Savings", "Profit"], why: "Debt is money you have to pay back." },
   { q: "A plan for your money", a: ["Budget", "Bubble", "Bonus"], why: "A budget tells every dollar where to go." },
   { q: "Taxes help pay for...", a: ["Schools", "Candy", "Skins"], why: "Taxes fund schools, roads, parks and more." },
   { q: "A pop-up wants a password", a: ["Close it", "Type it", "Share it"], why: "Never type passwords into pop-ups. Close it and tell an adult." },
   { q: "Pays when bad stuff happens", a: ["Insurance", "Interest", "Inflation"], why: "You pay insurance a little at a time so one accident can't wipe you out." },
   { q: "Money saved for surprises", a: ["Emergency $", "Candy $", "Party $"], why: "An emergency fund covers surprises like a broken phone." },
   { q: "Credit card bills: pay...", a: ["In full", "Never", "Half"], why: "Pay the whole bill on time and you pay zero interest." }
  ]
 }
];

/* between-world shop: wants, needs, protection, and giving */
const SHOP = [
  { id: "shield", emoji: "🛡️", name: "Emergency Fund", price: 8, kind: "Protection",
    note: "Start the next world with a shield that blocks one trap." },
  { id: "heart",  emoji: "❤️", name: "Health Checkup", price: 6, kind: "Need",
    note: "+1 heart (max 3). Taking care of yourself is a need." },
  { id: "shades", emoji: "😎", name: "Cool Shades", price: 5, kind: "Want", hat: "shades",
    note: "Pure style. +3 joy." },
  { id: "crown",  emoji: "👑", name: "Golden Crown", price: 15, kind: "Want", hat: "crown",
    note: "Very fancy. Very want. +6 joy." },
  { id: "donate", emoji: "🐾", name: "Donate to the Shelter", price: 3, kind: "Give",
    note: "Helps rescue animals. +3 joy." }
];

const BADGES = [
  { id: "spotter",  emoji: "🕵️", name: "Scam Spotter",   how: "Dodge 15 scam pop-ups in one run" },
  { id: "saver",    emoji: "🐷", name: "Super Saver",    how: "Finish with savings worth your whole goal" },
  { id: "whiz",     emoji: "🧠", name: "Quiz Whiz",      how: "Get 18 of 20 quiz gates right" },
  { id: "compound", emoji: "✨", name: "Compound Champ", how: "Earn $15 in interest" },
  { id: "heart",    emoji: "💝", name: "Big Heart",      how: "Give $10 to others" },
  { id: "streak",   emoji: "🔥", name: "On Fire",        how: "Grab 40 coins in a row" },
  { id: "debtfree", emoji: "🧾", name: "Debt Free",      how: "Finish all 4 worlds owing $0" },
  { id: "boss",     emoji: "🍋", name: "Business Boss",  how: "Raise your income to $16 a payday" },
  { id: "investor", emoji: "📈", name: "Investor",       how: "Finish holding investments" },
  { id: "untouch",  emoji: "🦸", name: "Untouchable",    how: "Finish all 4 worlds with 3 hearts" },
  { id: "goal",     emoji: "🏆", name: "Goal Getter",    how: "Reach your savings goal" },
  { id: "balance",  emoji: "😊", name: "Happy & Wealthy", how: "Reach your goal with joy at 70+" }
];

const TIPS = [
  "Kids who save a little every week build the habit that grown-ups wish they had started early.",
  "If $1 earns 10% a year, it doubles in about 7 years. That's compound interest.",
  "Real banks pay about 1% to 5% interest per year. This game super-sizes it so you can see it.",
  "Ads are built to make you want things. Ask: do I need it, or do I want it right now?",
  "A budget is a plan for your money before you spend it.",
  "Scammers love the words FREE, WINNER, and HURRY.",
  "Borrowing costs money. That cost is called interest.",
  "Giving can be part of every money plan: spend, save, and give.",
  "An index fund owns tiny pieces of hundreds of companies at once.",
  "The wait-a-week rule stops most impulse buys."
];
