# FFXIV Gathering Route Planner

Plan your gatherer runs by Eorzea time. Pick a time slot, see which timed
nodes are up, order the stops into a tidy route with travel notes, save your
favorite routes, and watch a live countdown to the next window.

Built the friendly way, like everything at Asdale Dynamics: plain English,
no install, no accounts, no tracking.

- **Single file.** `index.html` is the whole app — pure HTML/CSS/JS, zero
  dependencies, zero network calls.
- **Offline.** Double-click `index.html` and it works on a train with no
  internet.
- **Local-first.** Routes and favorites live in your browser's
  `localStorage`. Nothing is sent anywhere.
- **Editable data.** `nodes.json` is yours to maintain.

## Quick start

1. Open `index.html` in any modern browser. That's it.

2. *(Optional, for live data editing)* Serve the folder so the browser can
   load `nodes.json`:

   ```bash
   python3 -m http.server 8000
   # then visit http://localhost:8000
   ```

   When served over HTTP, `nodes.json` next to `index.html` overrides the
   copy embedded in the file (the header badge shows which data source is
   active). Over plain `file://`, browsers block `fetch`, so the app quietly
   uses the embedded copy — the badge tells you that too.

## How to use it

1. **Pick an Eorzea hour.** The slot grid shows every hour of the Eorzean day
   with a count of nodes up. "Use current ET hour" jumps straight to now.
2. **See what's up.** Each stop card shows the item, gatherer class (MIN/BTN),
   window (e.g. `06:00–08:00 ET`), zone and coordinates, nearest aetheryte,
   and whether it is *open right now*.
3. **Build the route.** "Add to route" collects stops; reorder with the ↑/↓
   buttons. Travel notes are generated for you:
   *Aetheryte: Sinus Lacrimae → walk to (16, 32)*.
4. **Countdown.** Every route stop shows a live countdown — either *opens in*…
   or *open, closes in…* — plus a "next window across your route" summary.
5. **Save favorites.** Name a route, hit Save. Load or delete favorites any
   time; they persist between visits.

Under the hood, Eorzea time is derived from the standard conversion:
one Eorzea bell = 175 real seconds, a full Eorzean day = 70 real minutes,
with the clock locked to the Unix epoch (`eorzeaSeconds = unixSeconds × 3600/175`).

## Maintaining `nodes.json`

The data ships as a starter set of well-known timed nodes. It is meant to be
edited by you — patch content changes and your server state may differ. When
updating, check the values against the in-game gathering log or a gathering
database site.

Each node looks like this:

```json
{
  "id": "rarefied-bismuth-ore",
  "item": "Rarefied Bismuth Ore",
  "job": "MIN",
  "type": "unspoiled",
  "expansion": "Endwalker",
  "starts": [6, 18],
  "duration": 2,
  "zone": "Mare Lamentorum",
  "coords": "16, 32",
  "aetheryte": "Sinus Lacrimae",
  "note": ""
}
```

| Field | Meaning |
| --- | --- |
| `id` | Short, unique slug |
| `item` | In-game item name |
| `job` | `MIN` (Miner) or `BTN` (Botanist) |
| `type` | `unspoiled`, `folklore`, or `collectable` |
| `starts` | Every ET bell the node can spawn in one day (some nodes spawn twice daily) |
| `duration` | How many ET bells the node stays up |
| `zone` / `coords` / `aetheryte` | Where it is and the nearest teleport |
| `note` | Optional extra note (shown on the card) |

If you edit the served `nodes.json`, no rebuild is needed — just refresh.
The embedded copy inside `index.html` exists as the offline fallback; if you
change one, sync the other (a test below keeps them honest).

## Running the tests

Node.js 18+ required, nothing else:

```bash
node --test tests/
```

The suite covers the window logic exactly as shipped inside `index.html`:
Eorzea time conversion (bell boundaries, wrapping), slot coverage,
open/closed countdowns, formatting, plus data-integrity checks on
`nodes.json` (valid windows, unique ids, and that the embedded fallback
matches `nodes.json`).

## Known limits

- **Fisher is out of scope.** Timed fishing spots depend on weather and
  province rules that change more often than gathering windows; only BTN/MIN
  land nodes are covered.
- **Weather-conditional nodes** aren't modeled.
- Starter node data is a curated sample, not a complete database — it is
  expected to be maintained by you.

## Credits and license

Created by **Asdale Dynamics, LLC** — beginner-friendly AI education, books,
and practical tools, explained the way a friend would.

This project is MIT licensed — see [LICENSE](LICENSE). FINAL FANTASY XIV is a
trademark of Square Enix Holdings Co., Ltd. This is an unofficial fan tool and
is not affiliated with or endorsed by Square Enix.
