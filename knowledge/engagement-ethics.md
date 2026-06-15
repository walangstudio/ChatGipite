# Engagement Ethics — Addiction Psychology & Humane Retention (reference)

Knowledge base for ChatGipite's `engagement-ethicist` agent. Detect when a product abuses addiction psychology, and apply engagement/retention that serves the user. Cited; contested claims flagged. Keep claims defensible — prefer "compulsive/problematic use" over "addiction" (only *gaming disorder* is a recognized diagnosis: WHO ICD-11; DSM-5 lists Internet Gaming Disorder as a research condition only).

## First principles

- **Mechanism ≠ malice.** A variable reward, a streak, a notification is not inherently abusive. The signal of abuse is **asymmetry**: the design benefits the operator at the user's expense, against the user's reflective interest.
- **Effect, not intent.** Regulators judge the interface's effect, not the designer's intention (California CPPA Enforcement Advisory 2024-02).
- **Evidence is uneven.** Lab mechanisms (variable reinforcement, loss aversion, FoMO) are robust. Population-level harm ("infinite scroll causes depression") is correlational and contested — never present it as established fact.

## Core mechanisms (how products hook)

1. **Variable-ratio reinforcement** — unpredictable rewards produce the highest, most persistent response rate (Skinner). The slot machine and the social feed share this engine.
2. **Dopamine anticipation loop** — dopamine encodes *prediction error*; anticipation (not receipt) drives the spike. Inflates "wanting" beyond "liking" — where compulsion lives.
3. **Hook Model (Nir Eyal)** — Trigger → Action → Variable Reward → **Investment**. The investment step (data, content, followers) loads the next trigger and raises switching cost. Weaponized = the full loop with no off-ramp.
4. **Fogg B=MAP** — behavior = Motivation × Ability × Prompt converging. Misused when "reduce friction" becomes "remove every natural stopping point." (Model is value-neutral; ethics live in *what behavior* and *whose goal*.)
5. **Loss aversion (streaks)** — losses weigh ~2× gains; a streak converts engagement into property, then threatens to destroy it on lapse.
6. **Social reciprocity / approval** — likes (variable social reward) + read receipts / "typing…" (obligation to respond).
7. **FoMO** — apprehension that others have rewarding experiences you're missing (Przybylski 2013). Feeds + ephemeral content make the missed stream continuous and perishable.
8. **Zeigarnik effect** — unresolved open loops stay active in memory; a red "3" badge is a manufactured open loop demanding closure.
9. **Attention economy** — ad/attention business models structurally require maximizing time-on-device, aligning the operator against the user's interest in stopping (Wu, *The Attention Merchants*; Schüll's "machine zone" / "time on device", *Addiction by Design*).

## Abuse pattern catalog (detect these)

| Pattern | Mechanism | The tell (detect) | Severity |
|---|---|---|---|
| Infinite scroll | no stopping cue + variable reward | feed auto-loads forever; no "you're caught up", no pagination | High |
| Autoplay / auto-advance | friction removal; default opt-in | next item plays without consent; autoplay defaults ON | High |
| Pull-to-refresh | variable-ratio (slot spin) | manual refresh gesture + spinner gating fresh content | Med |
| Intermittent push | variable reward + Zeigarnik | vague teaser copy ("Someone reacted…"); pings after *inactivity* | High |
| Notification badges | Zeigarnik open loop; FoMO | persistent red counts incl. non-actionable; hard to disable | Med |
| Streaks + loss guilt | loss aversion; sunk cost | counter resets on lapse; "streak about to end" alerts | High |
| Social/mutual streaks | loss aversion + peer pressure | shared streak punishing *both* parties (esp. minors) | High |
| Fake urgency / countdown | scarcity heuristic | **timer resets on reload** = the fakeness tell | Med–High |
| Ephemeral FoMO content | FoMO; perishability | disappearing content, "active now", "live now" interrupts | Med |
| Read receipts / typing | reciprocity norm | always-on "seen"/"typing…" with no opt-out | Med |
| Loot boxes / gacha | variable-ratio + gambling | randomized *paid* rewards; near-miss animations | High |
| Hard to cancel (roach motel) | obstruction; asymmetry | 1-click signup, multi-step/phone-only cancel | High |
| Confirmshaming | guilt | decline worded to shame ("No, I don't want to save money") | Med |
| Nagging | persistent interruption | repeated modals for the same ask after dismissal | Med |
| Default opt-in to engagement | preselection; status-quo bias | notifications/data/autoplay ON by default; pre-checked boxes | Med–High |
| Engagement-max feed | attention economy | ranks by predicted retention; outrage amplified; no chronological/off option | High |

**Detection heuristics (fast scan).** No natural stopping point (infinite scroll / autoplay-on / no session cues) · slot-machine reward (pull-to-refresh, randomized/paid rewards, near-miss) · open-loop pressure (teaser notifications, inactivity pings, persistent badges) · loss-aversion coercion (streaks, surfaced sunk investment) · social/FoMO pressure (always-on receipts, ephemeral content) · fake scarcity (**reload test the timer**) · choice asymmetry (defaults ON, roach-motel cancel, confirmshaming, nagging) · algorithmic maximization (no chronological option). **Raise severity for minors** (streaks, loot boxes, parasocial-character upsells are direct FTC/DSA concerns). Clustering across multiple categories = a weaponized Hook loop, not isolated choices.

## The line: engagement vs manipulation (litmus tests)

- **Regret test (Eyal):** if a fully-informed user would regret the action, don't ship it.
- **Transparency test:** if it only works because the user doesn't understand it, it's manipulation.
- **Exit test (Octalysis Black/White Hat):** if the user can't leave cleanly the moment they want to, it's a trap, not engagement.
- **Metric test (IEEE EAD):** make delivered value / well-being a primary success criterion, not engagement-time.
- **Manipulation Matrix (Eyal):** "Would I use it myself?" × "Does it materially improve lives?" → Facilitator (yes/yes, ethical) · Peddler (no/yes) · Entertainer (yes/no) · Dealer (no/no, exploitation).
- **Habit-forming vs addictive:** a habit the user is glad to have vs self-destructive compulsion that extracts value at the user's expense.
- ⚠️ *Contested:* critics (Axbom, J. Williams) argue Eyal's "use it yourself" fails for vulnerable users and offloads responsibility to willpower; CHT frames the root cause as misaligned incentives ("show me the incentive, I'll show you the outcome"). Hold both: designer accountability AND user agency.

## Ethical engagement & retention (apply these)

Format: principle → ethical implementation → guardrail.

1. **Onboarding to "aha"/activation** → shorten time-to-value; guide to the one action tied to retention (strong 7-day activation ~correlates with 3-month retention) → the aha must be *real value*, not a commitment hook.
2. **Value-based notifications** → opt-in, relevant, **batched/digested**, quiet hours, granular frequency → ask "would I want to be interrupted for this?"; measure relevance satisfaction, not open rate.
3. **Healthy habit formation (Fogg Tiny Habits)** → raise *Ability* (make the valuable action trivial) on user-chosen behaviors → passes the regret test.
4. **Endowed progress / mastery (honest)** → give a head start *with a stated reason* (welcome bonus) — the effect needs the honest reason to work → progress must reflect real advancement; never fake or reset the finish line.
5. **White-Hat gamification** → meaning, accomplishment, autonomy → use Black-Hat (urgency/scarcity) only briefly toward the user's *own* goal, with a clean exit.
6. **Social connection (not pressure)** → enable real interaction/reciprocity → never weaponize obligation/guilt (shame streaks, "your friend is waiting").
7. **Earned scarcity** → state true limits only → fake scarcity/urgency are deceptive patterns.
8. **Transparent pricing** → total cost up front; opt-*in* add-ons → no hidden costs/sneaking/hidden subscription.
9. **Easy cancellation (click-to-cancel)** → cancel as easily as signup → roach motel is the violation (FTC Negative Option / Click-to-Cancel direction; rule vacated 2025 on procedure but enforcement + state law continue).
10. **Stopping cues** → "you're all caught up", Load More, pagination, "1–50 of 2,340" → give a dignified moment to stop satisfied.
11. **User control / digital wellbeing** → frequency caps, quiet hours, usage dashboards, tune-the-algorithm, opt-outs → must be real and easy to find (burying them is Obstruction).
12. **Reciprocity via real value** → give first (useful free tier, real support) → triggered by actual value, not manufactured obligation.

**Retention truth:** durable retention comes from *value delivered* (solve the core job, reduce time-to-value, good support), not loops. Distinguish value-driven retention (users *want* to stay → word of mouth) from lock-in retention (users *can't* leave → fragile, increasingly illegal). Don't let an output metric mask value rot (Reforge).

## Make-it-ethical rewrite playbook

| Abusive pattern | Ethical rewrite (still engaging) |
|---|---|
| Infinite scroll | "You're all caught up" end-state + Load More + count context |
| Punishing streak | streak freezes/repairs/forgiveness; tie to real learning, not app-opens; optional |
| Notification spam / red dots | opt-in + relevant + batched + quiet hours; interrupt only for wanted things |
| Roach-motel cancel | click-to-cancel in the same channel/effort as signup |
| Fake scarcity/urgency | state true constraints only |
| Confirmshaming | neutral, symmetric Accept/Decline of equal prominence |
| Hidden costs / preselected add-ons | total price up front; opt-in add-ons |
| All-Black-Hat gamification | lead White-Hat; Black-Hat briefly toward user's own goal, clean exit |

## Regulatory exposure (warn on these)

- **FTC, *Bringing Dark Patterns to Light* (2022)** — 4 categories: induce false beliefs · hide/delay material info (drip pricing) · unauthorized charges (free-trial auto-enroll, kids' in-app) · subvert privacy choices. Enforcement-relevant.
- **EU Digital Services Act Art. 25** (since Feb 2024) — first EU law naming dark patterns; bans interfaces that deceive/manipulate or impair free decisions; cites hard-to-cancel subs and fake urgency.
- **California CPPA Advisory 2024-02** — consent via dark patterns is invalid; tests = clear language + symmetry of choice; **effect, not intent**; penalties up to $2,500/$7,500 (willful).
- **Loot boxes** — banned as gambling in Belgium (2018), ruled gambling in the Netherlands (later narrowed on appeal); expenditure correlates with problem-gambling severity.
- **Clinical** — WHO ICD-11 *gaming disorder* recognized; no formal "social media addiction" diagnosis.

## Key sources

Eyal, *Hooked* (2014) + *Indistractable* (2019) + "Morality of Manipulation" / Regret Test · Brignull, deceptive.design/types (16 deceptive patterns) · FTC *Bringing Dark Patterns to Light* (2022) · Mathur et al., *Dark Patterns at Scale* (2019) + *What Makes a Dark Pattern Dark?* (2021: asymmetric / covert / deceptive / hides-info / restrictive) · Schüll, *Addiction by Design* (2012) · Center for Humane Technology / Time Well Spent (Harris, Raskin) · Humane by Design (humanebydesign.com: Empowering/Finite/Inclusive/Resilient/Respectful/Intentional/Transparent) · IEEE Ethically Aligned Design · Yu-kai Chou, Octalysis White-Hat/Black-Hat · Przybylski et al., FoMO (2013) · Wu, *The Attention Merchants* · EU DSA Art. 25 · California CPPA Advisory 2024-02.
