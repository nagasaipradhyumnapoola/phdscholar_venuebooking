import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignFromSearch,
  captureCampaign,
  readPreferences,
  savePreferences,
  campaignKey,
  preferenceKey,
} from "../public/preferences.js";
const memory = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};
test("campaign attribution keeps only the five UTM fields and bounds untrusted values", () => {
  const result = campaignFromSearch(
    "?utm_source=Department%00&utm_campaign=" +
      "a".repeat(400) +
      "&email=private@example.com&token=secret&redirect=https://example.com",
  );
  assert.deepEqual(Object.keys(result), ["utm_source", "utm_campaign"]);
  assert.equal(result.utm_source, "Department");
  assert.equal(result.utm_campaign.length, 120);
});
test("no campaign record is persisted without consent; withdrawal erases an earlier record", () => {
  const storage = memory();
  assert.equal(captureCampaign("?utm_source=research", false, storage), null);
  assert.equal(storage.getItem(campaignKey), null);
  assert.ok(captureCampaign("?utm_source=research", true, storage));
  assert.equal(captureCampaign("?utm_source=research", false, storage), null);
  assert.equal(storage.getItem(campaignKey), null);
});
test("consented attribution retains the first campaign in a tab and creates no empty record", () => {
  const storage = memory();
  assert.equal(
    captureCampaign("?email=private@example.com", true, storage),
    null,
  );
  const first = captureCampaign(
    "?utm_source=first",
    true,
    storage,
    "2026-10-21T00:00:00.000Z",
  );
  assert.deepEqual(captureCampaign("?utm_source=later", true, storage), first);
  assert.equal(first.parameters.utm_source, "first");
});
test("malformed preferences and unavailable browser storage do not enable tracking or break the page", () => {
  const storage = memory();
  for (const value of [
    "malformed",
    "null",
    '{"version":1,"campaignTracking":"yes"}',
    '{"version":2,"campaignTracking":true}',
  ]) {
    storage.setItem(preferenceKey, value);
    assert.equal(readPreferences(storage), null);
  }
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  assert.equal(readPreferences(blocked), null);
  assert.equal(captureCampaign("?utm_source=research", true, blocked), null);
  assert.deepEqual(savePreferences(blocked, false), {
    version: 1,
    campaignTracking: false,
  });
});
test("a saved explicit choice is read back without unrelated stored properties", () => {
  const storage = memory();
  savePreferences(storage, true);
  assert.deepEqual(readPreferences(storage), {
    version: 1,
    campaignTracking: true,
  });
  savePreferences(storage, false);
  assert.deepEqual(readPreferences(storage), {
    version: 1,
    campaignTracking: false,
  });
});
