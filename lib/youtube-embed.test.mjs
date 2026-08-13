import test from "node:test";
import assert from "node:assert/strict";
import { extractYouTubeId, buildYouTubeEmbedHtml, normalizeVideoList } from "./youtube-embed.mjs";

test("extractYouTubeId: watch URL", () => {
  assert.equal(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("extractYouTubeId: youtu.be", () => {
  assert.equal(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("extractYouTubeId: embed URL", () => {
  assert.equal(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("buildYouTubeEmbedHtml üres URL-nél", () => {
  assert.equal(buildYouTubeEmbedHtml(""), "");
});

test("normalizeVideoList mindig 3 elem", () => {
  assert.deepEqual(normalizeVideoList(["a"]), ["a", "", ""]);
});
