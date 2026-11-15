# Cleartrip Trip planner: interactive concept prototype

A working, responsive prototype of an AI **Trip planner inside Cleartrip** (web and phone layouts). It follows the supplied brief and the 23 reference screens in `reference_pack/`. It is **not** a standalone app and **not** official Cleartrip UI: everything is demo data (`Demo plan · sample prices`), and no real AI, inventory, invitation, booking or payment is involved.

## Run it

No build step and no dependencies. Serve the `planner` folder with any static server. From the project root:

```bash
node serve.js 5180 planner
```

Then open <http://localhost:5180>. (`serve.js` is a tiny static server. Port can be changed. Inter loads from Google Fonts and falls back to the system font offline.)

- Web layout: 1024px and above. Tablet: 768 to 1023px (chat becomes a Chat / Plan switch). Phone: 360 to 767px (back action, Chat / Plan switch, bottom sheets).
- State lives in memory only: **refreshing the page starts a fresh demo** (nothing is restored). **Demo → Reset demo…** resets without a refresh and asks first.
- Testing aid: `?jump=<state>` loads a journey state directly (`setup, chat, building, plan, why, timefix, meals, transport, stay, moved, swapped, shared, approving, approved, checkout, handoff, price, nomatch, error`). It is not shown in the UI.

## Walkthrough (main journey)

1. **Home** shows the Cleartrip shell. Tap **Trip planner** (web tab / phone card) to enter.
2. **Add traveller.** Choose a character, give an optional nickname (blank becomes "Friend 2"), watch the shoulder-joining animation. Click a character to edit or remove. Add Srikant, then Prathmesh (the second friend slot has the ₹10,200 cap).
3. **Invite.** The sheet lists named characters. "Invite" previews what the friend sees; **Join plan** claims the existing character. No invitation is sent. Joining is not approval.
4. **Trip capsules.** Edit destination, dates and budget (validated). **Plan my trip.**
5. **Chat.** Prathmesh says his max is ₹10,200, the AI sets a ₹10,200 planning target, you pick **Heritage & sunrise**.
6. **Build** (about 3.5 s, simulated). Stop planning cancels; errors and retry are in Demo controls.
7. **Review.** The draft is ₹10,500 per person, ₹300 above Prathmesh's cap. Day 2 is overpacked (11 h planned, 8 h 30 m available).
8. Select days on the route. Click Transport, Stay or Meals to edit them in the **one** lower Review & edit panel (phone: a bottom sheet). **Why this plan?** and **Move Anjanadri to Day 3** use the same panel. Preview first; nothing changes until **Apply**; Undo is in the toast and plan history.
9. **Stay compare**: Boulder View saves ₹300 across three nights → ₹10,200 per person, ₹30,600 for three.
10. **Share with group** → status becomes Shared draft. Use **Demo → Act as traveller** to approve as You, Srikant and Prathmesh. Nobody is auto-approved.
11. **Review & book** unlocks only when every traveller has approved the latest version and no cap is breached. The checkout review separates bookable items (₹6,000 per person, ₹18,000 for three) from local estimates (₹4,200 per person). **Continue** opens a handoff screen and a labelled placeholder. **No booking or payment has been made.**

Optional edits: remove Day 2 dinner (₹10,100), scooty on Day 2 (₹9,900), both together (₹9,500). Recovery: **Demo → Trigger price change / no results / connection failure**.

## Demo controls (collapsed under "Demo")

Act as traveller · Main journey reset (undoes optional edits) · Trigger price change · Trigger no results · Trigger connection failure · Reduced motion · Reset demo.

## Structure

```
planner/
  index.html
  css/tokens.css      design tokens: colour, type, spacing, radii, motion values
  css/app.css         component and layout styles
  js/data.js          fixtures: stays, days, meal/transport prices, copy, characters
  js/store.js         single source of truth, ledger, time model, approvals, mock adapters
  js/ui.js            icons, overlay manager (focus trap, Escape, Back), toast, live region
  js/characters.js    layered SVG characters and the join / leave animation
  js/views.js         host shell, home, setup, chat, building
  js/plan.js          route, review panel, editors, approvals, checkout, recovery
  js/overlays.js      dialogs and sheets (add/edit/remove traveller, invite, capsules, confirms)
  js/main.js          render loop, delegated events, actions, demo menu
  assets/img/         photos and illustrations cropped from the reference pack
  screenshots/        desktop (1440px) and phone-layout (500px) captures
```

Rules kept in code, not in the UI: currency is integer rupees; totals are derived from `ledger()`; every material change (itinerary, price, dates, party size, a cap) increments a plan version; approvals are stored per traveller and version; checkout needs no pending edit, all approvals on the latest shared version, no cap breach and no unresolved price change; mock timers are cancelled on navigate, retry and reset.

## Mocked integrations

AI replies, search counts ("Checked 14 stays…"), inventory, prices, invitations and approvals are all scripted adapters in `store.js`. The scooty is a **sample partner** with availability unverified. Meals and local transport are estimates and are never part of checkout.

## Visual sources and limitations (please read)

- **Logo:** no official Cleartrip logo asset was supplied, so the header uses a plain Inter wordmark as a placeholder. Swap in the official asset.
- **Characters** (`assets/chars3`, all 14 role assets from `Traveller_Group_14_Assets.zip`): `js/looks.js` searches for an arrangement where **no character appears twice** (up to 4 men and 4 women, 8 travellers), the organiser keeps identity 1, nobody raises an arm toward nothing, and every neighbouring pair is joined by a raised arm. Single-arm pairs are preferred; a two-arm pair is used only when the art set needs it. It changes as few existing people as possible (faces first, then order, then poses). Raised arms are hidden behind the neighbour when that neighbour stands in front, with no hand drawn in front (`SHOW_HANDS` in `js/characters.js` switches the front-hand layer back on). Bodies share a baseline and a per-asset scale so shoulder heights match; spacing comes from the palm-on-shoulder point (`js/characters.js`, per-asset geometry in `ASSETS` in `js/data.js`). Add `?debug` to the URL to show shoulder rest points (blue), palms (red) and body centres (green).
- **Asset limits:** only identity 1 has a both-arms-down pose, identity 2 a left-end and identity 4 a right-end pose, identity 3 is middle-only, so a pair of two-arm hugs appears in bigger groups. The 9th traveller is refused (Add is disabled). Joining and leaving can change which arm a person raises (same face, other pose). Middle poses have wide arms, so those figures look more stretched than end poses. No arm bending is animated..- **Photos and illustrations** (destinations, Hampi sights, stays, picks, vehicles) are cropped from the reference PNGs, so they are small and soft. Replace with licensed originals.
- **Day navigator** is a day-by-day route, not a geographic map. The route backdrop is a cropped Hampi panorama, not the exact painted strip.
- **Reference differences normalised** (per the brief): one header, one set of characters, one cost model, a 300–340 px chat column once a plan exists. The reference shows "Bookable" on Day 2 local transport; here local transport is "Estimated" because the brief keeps it outside checkout.
- **Contrast:** `#FF4F17` is kept for rings, graphics and large type. Buttons with white labels use `#D43F0A` (4.65:1) and small orange text uses `#C2410C` (5.2:1).
- **Screenshots** of the phone layout were rendered at 500 px wide (headless Chrome cannot render narrower). 360 px and 390 px were checked in the browser for horizontal overflow, not captured.
- Not verified: screen readers (NVDA, VoiceOver) and real touch devices. Keyboard operation, focus return, Escape, Back-button overlay handling and reduced motion were exercised in Chrome.
- Dates are fixed to 14–17 Nov 2026 and stay usable after they pass. Holidays, trains, payments, sign-in and loyalty are out of scope.

## Group Wishbox and destination reveal (second flow)

Entry: the **Start a group Wishbox** card under the trip composer on the setup screen (or `?jump=wishbox|review|shortlist|reveal|vote`). Code: `js/wishbox.js` (state, rules, actions), `js/wbviews.js` (markup). Art: `assets/wb/*.webp`, resized from `Cleartrip_Clay_Wishbox_Reveal_Assets.zip`.

**Flow A:** budget (numeric field plus slider, validation, cancel, per-member privacy, target = lowest valid cap, "budget missing" is provisional) → box with sticker picker and written wishes (category filter only filters, duplicates join an existing wish, support once and undo, must-have/nice-to-have, edit and remove own wishes only, Undo + history) → ready per member revision ("2 of 3 ready", editing after ready asks again) → coordinator-only review (simulated three-stage AI grouping, cancellable, failure keeps all wishes, minority wishes kept, conflicts and missing inputs listed) → shortlist draft with ₹1,200 / ₹1,600 above-target tags, stretch flag, exclusion with reason, publish as a numbered version (2 to 3 options).
**Flow B:** Reveal (Skip animation, Replay, reduced motion) → Like/Pass per destination with Clear → Submit (tallies hidden until you submit) → coordinator picks, budget conflicts need the affected member's acceptance → Confirm carries destination, dates, caps and wishes back into the existing planner. Publishing a new version invalidates earlier ballots. Nothing is booked or paid.

Asset mapping: stickers `beach, cafe, camping, easy_hike, heritage, local_food, photography, slow_mornings, train_trip, waterfall`; Hampi = heritage, Gokarna = beach, Coorg = coorg; box = one of `box_empty / box_receiving / box_ready` (CSS squash only); `wallet`, `group_caps` (unused), `globe_india`, `pin`, `like`, `pass`, `ai_grouping`. The other three globe keyframes are not used.

**Limitations:** the reveal is a *reveal transition* on one still globe (lift, modest sway, settle, pin drop), not a real Earth rotation or 3D sphere; the pin is projected from approximate coordinates onto the supplied image and is a planning reference only. Collaboration and AI are local simulations; switch member via Demo → Act as traveller (Wishbox testing tools appear there). Screens were checked at 1440 px and 500 px; screen readers and real phones were not tested.