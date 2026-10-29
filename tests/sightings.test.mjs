import test from "node:test";
import assert from "node:assert/strict";
import { recordSightings, readHistory } from "../lib/sightings.ts";
const plane = {
  hex: "abc123",
  flight: "AAL123 ",
  t: "B738",
  r: "N123AA",
  alt_baro: 2300,
};
test("polls update one pass while a return after five minutes creates another", () => {
  let h = recordSightings([], "north", [plane], 1000);
  h = recordSightings(h, "north", [plane], 11000);
  assert.equal(h.length, 1);
  assert.equal(h[0].firstSeen, 1000);
  assert.equal(h[0].lastSeen, 11000);
  h = recordSightings(h, "north", [plane], 311001);
  assert.equal(h.length, 2);
  assert.equal(h[0].lastSeen, 11000);
});
test("one aircraft is recorded independently for each view and callsign", () => {
  let h = recordSightings([], "north", [plane], 1000);
  h = recordSightings(h, "south", [plane], 1000);
  h = recordSightings(h, "north", [{ ...plane, flight: "AAL456" }], 2000);
  assert.equal(h.length, 3);
  assert.equal(new Set(h.map((s) => s.id)).size, 3);
});
test("unknown types can be resolved without duplicating a pass", () => {
  let h = recordSightings([], "north", [{ ...plane, t: undefined }], 1000);
  assert.equal(h[0].type, "UNKNOWN");
  h = recordSightings(h, "north", [plane], 2000);
  assert.equal(h.length, 1);
  assert.equal(h[0].type, "B738");
  assert.equal(h[0].flight, "AAL123");
});
test("stored history survives serialization and malformed storage is ignored", () => {
  const h = recordSightings([], "north", [plane], 1000);
  assert.deepEqual(readHistory(JSON.stringify(h)), h);
  for (const value of [null, "{bad", "{}", '[null, {}, {"id":"x"}]'])
    assert.deepEqual(readHistory(value), []);
});
