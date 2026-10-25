/*
 * Tests for the FFXIV Gathering Route Planner.
 * Run with:  node --test tests/
 *
 * The time-window logic lives inside index.html (so the app stays a single
 * offline file). These tests extract the marked logic block and the inline
 * JSON data from index.html, so the logic shipped to users is exactly what
 * is tested here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(ROOT, "index.html"), "utf8");

/* ---------- helpers to pull code out of the single-file app ---------- */

const block = html
  .slice(html.indexOf("<script id=\"time-logic\">"), html.indexOf("</script>", html.indexOf("<script id=\"time-logic\">")))
  .replace(/<script id="time-logic">/, "");

assert.ok(block.includes("TIME-LOGIC-BEGIN"), "time-logic block markers must stay in index.html");

// Evaltime: run the extracted block, then pick the export off globalThis.
const T = (() => {
  const sandbox = eval(block);
  return sandbox || globalThis.FFXIVTimeLogic;
})();
assert.ok(T && typeof T.eorzeaClock === "function", "time-logic block must expose FFXIVTimeLogic");

function extractJsonBlock(id) {
  const tag = `<script type="application/json" id="${id}">`;
  const start = html.indexOf(tag) + tag.length;
  const end = html.indexOf("</script>", start);
  return JSON.parse(html.slice(start, end));
}

const EARTH_MS_PER_ET_BELL = 175000;       // 175 real seconds
const EARTH_MS_PER_ET_DAY = 4200 * 1000;  // 70 real minutes

/* ---------- Eorzea time conversion ---------- */

test("ET epoch: zero real time is 00:00:00 Eorzea time", () => {
  assert.deepEqual(T.eorzeaClock(0), { bell: 0, minute: 0, second: 0, hill: 0 });
});

test("175 real seconds equal exactly one Eorzea bell", () => {
  const c = T.eorzeaClock(EARTH_MS_PER_ET_BELL);
  assert.equal(c.bell, 1);
  assert.equal(c.minute, 0);
  assert.equal(c.second, 0);
});

test("each bell boundary rolls over cleanly (24 bells checked)", () => {
  for (let b = 0; b < 24; b++) {
    const c = T.eorzeaClock(b * EARTH_MS_PER_ET_BELL);
    assert.equal(c.bell, b % 24, `bell ${b}`);
    assert.equal(c.minute, 0);
    assert.equal(c.second, 0);
  }
});

test("known mid-bell reading: 1 bell + 87 s later is 01:29:49 ET", () => {
  const c = T.eorzeaClock(EARTH_MS_PER_ET_BELL + 87 * 1000);
  assert.equal(c.bell, 1);
  assert.equal(c.minute, 29);
  assert.equal(c.second, 49);
});

test("one Eorzea day (4200 s) later lands on the same clock time", () => {
  const c = T.eorzeaClock(EARTH_MS_PER_ET_DAY + 5 * EARTH_MS_PER_ET_BELL);
  assert.equal(c.bell, 5);
  assert.equal(c.minute, 0);
  assert.equal(c.second, 0);
});

test("clock stays aligned far from the epoch: 7 ET days + 3 bells later reads 03:00:00", () => {
  const why = 7 * EARTH_MS_PER_ET_DAY + 3 * EARTH_MS_PER_ET_BELL; // ≈ 8.16 real hours
  const c = T.eorzeaClock(why);
  assert.equal(c.bell, 3);
  assert.equal(c.minute, 0);
  assert.equal(c.second, 0);
});

/* ---------- window coverage ---------- */

test("windowCoversHour: window that starts after the slot is not covering", () => {
  // The window starts at 6, so slot 5 (spanning [5,6)) does NOT intersect [6,8).
  assert.equal(T.windowCoversHour(6, 2, 5), false);
});

test("windowCoversHour: edge cases at window boundaries", () => {
  assert.equal(T.windowCoversHour(6, 2, 6), true);   // [6,8) covers [6,7)
  assert.equal(T.windowCoversHour(6, 2, 7), true);   // [6,8) covers [7,8)
  assert.equal(T.windowCoversHour(6, 2, 8), false);  // window closed at 8
  assert.equal(T.windowCoversHour(6, 2, 12), false);
});

test("anyWindowCoversHour handles twice-daily spawns", () => {
  assert.equal(T.anyWindowCoversHour([4, 16], 2, 16), true);
  assert.equal(T.anyWindowCoversHour([4, 16], 2, 5), true);
  assert.equal(T.anyWindowCoversHour([4, 16], 2, 10), false);
});

/* ---------- window state / countdowns ---------- */

const closeTo = (actual, expected, tol = 1) => assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected}±${tol}, got ${actual}`);

test("open window reports time remaining until it closes", () => {
  const st = T.windowState(6.5, [6], 2);
  assert.equal(st.open, true);
  closeTo(st.msToEvent, 1.5 * EARTH_MS_PER_ET_BELL); // 0.5 bell left
});

test("closed window reports time until the next opening", () => {
  const st = T.windowState(5.0, [6], 2);
  assert.equal(st.open, false);
  closeTo(st.msToEvent, 1 * EARTH_MS_PER_ET_BELL);
});

test("next opening wraps to the next Eorzea day", () => {
  const st = T.windowState(20.0, [16], 2); // last window (16-18) already over
  assert.equal(st.open, false);
  // Next opening: the same window reopens at bell 16 of the next day = 20 bells away.
  closeTo(st.msToEvent, 20 * EARTH_MS_PER_ET_BELL);
});

test("twice-daily node picks the soonest of its windows", () => {
  const st = T.windowState(6.5, [4, 16], 2); // first window (4-6) just closed
  assert.equal(st.open, false);
  closeTo(st.msToEvent, 9.5 * EARTH_MS_PER_ET_BELL); // next opening at bell 16
});

test("twice-daily node that just closed still finds the later window", () => {
  const st = T.windowState(18.5, [4, 16], 2);
  assert.equal(st.open, false);
  // Both of today's windows are over; tomorrow's bell 4 is 9.5 bells away.
  closeTo(st.msToEvent, 9.5 * EARTH_MS_PER_ET_BELL);
});

test("open window shortens as time passes", () => {
  const early = T.windowState(6.0, [6], 2);
  const late = T.windowState(6.9, [6], 2);
  assert.equal(late.msToEvent < early.msToEvent, true);
});

/* ---------- formatting ---------- */

test("formatCountdown renders human-friendly strings", () => {
  assert.equal(T.formatCountdown(1 * 3600 * 1000 + 2 * 60 * 1000 + 3 * 1000), "1h 02m 03s");
  assert.equal(T.formatCountdown(2 * 60 * 1000 + 5 * 1000), "2m 05s");
  assert.equal(T.formatCountdown(45 * 1000), "45s");
  assert.equal(T.formatCountdown(-1000), "0s");
});

test("formatBell pads hours", () => {
  assert.equal(T.formatBell(0), "00:00");
  assert.equal(T.formatBell(9), "09:00");
  assert.equal(T.formatBell(13), "13:00");
});

/* ---------- node data integrity: nodes.json and embedded copy ---------- */

function validateNode(node, i) {
  assert.equal(typeof node.id, "string", `node ${i}: id must be a string`);
  assert.ok(/^[a-z0-9-]+$/.test(node.id), `node ${i}: id should be a slug (${node.id})`);
  assert.equal(typeof node.item, "string", `node ${i}: item required`);
  assert.equal(node.item.length > 0, true, `node ${i}: item required`);
  assert.ok(["MIN", "BTN"].includes(node.job), `node ${i}: job must be MIN or BTN`);
  assert.ok(["unspoiled", "folklore", "collectable"].includes(node.type), `node ${i}: bad type`);
  assert.ok(Array.isArray(node.starts) && node.starts.length > 0, `node ${i}: starts required`);
  for (const s of node.starts) {
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 23, `node ${i}: start ${s} must be an integer bell 0-23`);
  }
  assert.ok(Number.isInteger(node.duration) && node.duration >= 1 && node.duration <= 4, `node ${i}: duration must be 1-4 bells`);
  for (const key of ["zone", "coords", "aetheryte"]) {
    assert.equal(typeof node[key], "string", `node ${i}: ${key} required`);
    assert.ok(node[key].trim().length > 0, `node ${i}: ${key} required`);
  }
}

const nodesJson = JSON.parse(readFileSync(path.join(ROOT, "nodes.json"), "utf8"));
const embedded = extractJsonBlock("default-nodes");

test("nodes.json parses and every node is well-formed", () => {
  assert.ok(Array.isArray(nodesJson.nodes) && nodesJson.nodes.length > 0, "nodes.json needs a nodes array");
  nodesJson.nodes.forEach(validateNode);
});

test("node ids in nodes.json are unique", () => {
  const ids = nodesJson.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate node id found");
});

test("embedded fallback data in index.html mirrors nodes.json", () => {
  const a = JSON.stringify([...nodesJson.nodes].sort((x, y) => x.id.localeCompare(y.id)));
  const b = JSON.stringify([...embedded.nodes].sort((x, y) => x.id.localeCompare(y.id)));
  assert.equal(a, b, "embedded <script id='default-nodes'> should be a copy of nodes.json (keep them in sync)");
});

/* ---------- app script sanity ---------- */

test("all inline application scripts parse without syntax errors", () => {
  const scriptBodies = [...html.matchAll(/<script(?![^>]*type)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  assert.ok(scriptBodies.length >= 2, "expected time-logic and app scripts");
  for (const body of scriptBodies) {
    // Writing a function wrapper does not execute anything; it only compiles.
    new Function(body);
  }
});

test("safe: HTML contains no network references or secrets", () => {
  assert.equal(/(api[_-]?key|secret|token|password)/i.test(html.replace(/(placeholder|aria-label)="[^"]*"/g, "")), false, "possible secret-looking string in index.html");
  const urls = html.match(/https?:\/\/[^"'<>\s]+/g) || [];
  assert.equal(urls.length, 0, "single-file offline app should not reference remote URLs");
});
