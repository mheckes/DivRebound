import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "../src/util/caseProgress.js";

test("parseAmount: deutsche und englische Schreibweisen, Tausenderpunkt", () => {
  assert.equal(parseAmount("40,80"), 40.8);
  assert.equal(parseAmount("40.80"), 40.8);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("1234.5"), 1234.5);
  assert.equal(parseAmount("1.234"), 1234);
  assert.equal(parseAmount("12.345.678"), 12345678);
  assert.equal(parseAmount("40,80 €"), 40.8);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});
