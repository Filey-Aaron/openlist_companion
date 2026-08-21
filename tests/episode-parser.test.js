const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const loadParser = () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "body.js"), "utf8");
  const hooks = {};
  const noOp = () => {};
  const window = {
    __OPENLIST_TMDB_TEST_HOOKS__: hooks,
    OPENLIST_CONFIG: {},
    addEventListener: noOp,
    clearTimeout: noOp,
    dispatchEvent: noOp,
    setTimeout: () => 1,
  };
  const document = {
    body: {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const localStorage = {
    getItem: () => null,
    setItem: noOp,
  };
  class MutationObserver {
    disconnect() {}
    observe() {}
  }

  vm.runInNewContext(source, {
    Event: class Event {},
    MutationObserver,
    console,
    document,
    history: { pushState: noOp, replaceState: noOp },
    localStorage,
    location: { origin: "https://example.test", pathname: "/" },
    window,
  });
  return hooks;
};

const files = (...names) => names.map((name) => ({ is_dir: false, name }));
const plain = (value) => value && JSON.parse(JSON.stringify(value));
const parser = loadParser();

test("recognizes a directory of bare numeric episode names", () => {
  const context = parser.buildEpisodeParseContext(files("23.mkv", "24.mkv"), "/Show");

  assert.equal(context.allowBareNumber, true);
  assert.deepEqual(plain(parser.parseEpisodeName("23.mkv", context)), {
    season: 1,
    episode: 23,
    title: "",
  });
  assert.deepEqual(plain(parser.parseEpisodeName("24.mkv", context)), {
    season: 1,
    episode: 24,
    title: "",
  });
  assert.equal(parser.inferMode(files("23.mkv", "24.mkv"), "/Show"), "tv");
});

test("uses an explicit season directory as the default season", () => {
  for (const directory of ["Season 2", "S02", "第2季"]) {
    const context = parser.buildEpisodeParseContext(files("24.mkv"), `/Show/${directory}`);
    assert.equal(context.allowBareNumber, true);
    assert.deepEqual(plain(parser.parseEpisodeName("24.mkv", context)), {
      season: 2,
      episode: 24,
      title: "",
    });
  }

  const seasonOne = parser.buildEpisodeParseContext(files("24.mkv"), "/Show/Season 1");
  assert.equal(seasonOne.allowBareNumber, true);
  assert.equal(parser.parseEpisodeName("24.mkv", seasonOne).season, 1);
});

test("allows a single numeric episode only in TV context", () => {
  const automatic = parser.buildEpisodeParseContext(files("24.mkv"), "/Show");
  const tvMode = parser.buildEpisodeParseContext(files("24.mkv"), "/Show", true);

  assert.equal(parser.parseEpisodeName("24.mkv", automatic), null);
  assert.equal(parser.parseEpisodeName("24.mkv", tvMode).episode, 24);
});

test("rejects ambiguous or decorated numeric basenames", () => {
  const context = parser.buildEpisodeParseContext(files("24.mkv"), "/Show", true);

  for (const name of ["000.mkv", "2024.mkv", "1080.mkv", "24.sample.mkv"]) {
    assert.equal(parser.parseEpisodeName(name, context), null, name);
  }
  assert.equal(parser.parseEpisodeName("001.mkv", context).episode, 1);
  assert.equal(parser.parseEpisodeName("123.mkv", context).episode, 123);
});

test("explicit file season overrides directory inference", () => {
  const context = parser.buildEpisodeParseContext(files("Show.S03E04.mkv"), "/Show/Season 2");

  assert.deepEqual(plain(parser.parseEpisodeName("Show.S03E04.mkv", context)), {
    season: 3,
    episode: 4,
    title: "Show",
  });
  assert.equal(parser.parseEpisodeName("第24集.mkv", context).season, 2);
});

test("batch season override preserves parsed episode numbers and row order", () => {
  const rows = [
    { season: 1, episode: 24, episodeDetails: { id: 24 }, error: "old", result: "old" },
    { season: 1, episode: 23, episodeDetails: { id: 23 }, error: "old", result: "old" },
  ];

  assert.equal(parser.applyBatchSeasonOverride(2, rows), true);
  assert.deepEqual(rows.map(({ season, episode }) => ({ season, episode })), [
    { season: 2, episode: 24 },
    { season: 2, episode: 23 },
  ]);
  assert.equal(rows.every((row) => row.episodeDetails === null && !row.error && !row.result), true);
});

test("naturalCompare sorts numeric filenames in natural order", () => {
  const names = ["10.strm", "2.strm", "1.strm", "3.strm", "11.strm"];
  const sorted = [...names].sort(parser.naturalCompare);
  assert.deepEqual(sorted, ["1.strm", "2.strm", "3.strm", "10.strm", "11.strm"]);
});

test("naturalCompare keeps non-numeric segments case-insensitive", () => {
  const names = ["MovieB.mkv", "movieA.mkv", "MovieA.mkv"];
  const sorted = [...names].sort(parser.naturalCompare);
  assert.deepEqual(sorted, ["movieA.mkv", "MovieA.mkv", "MovieB.mkv"]);
});

test("cleanSearchQuery extracts pure Chinese or English without mixing", () => {
  assert.equal(parser.cleanSearchQuery("黑客帝国 The Matrix 1999"), "黑客帝国");
  assert.equal(parser.cleanSearchQuery("The Matrix Reloaded 2003"), "The Matrix Reloaded");
  assert.equal(parser.cleanSearchQuery("黑客帝国"), "黑客帝国");
  assert.equal(parser.cleanSearchQuery("Show.Name.1080p.WEB-DL"), "Show Name");
});

test("cleanSearchQuery removes season and year markers from directory titles", () => {
  assert.equal(parser.cleanSearchQuery("Show Name Season 1"), "Show Name");
  assert.equal(parser.cleanSearchQuery("第2季 Show Name"), "Show Name");
  assert.equal(parser.cleanSearchQuery("Show Name (2024)"), "Show Name");
  assert.equal(parser.cleanSearchQuery("Show Name [2024]"), "Show Name");
});
