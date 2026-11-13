'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function createApp(type) {
  const timers = new Map();
  const m = { exports: {} };
  let handle = 0;
  vm.runInNewContext(fs.readFileSync(require.resolve('../app'), 'utf8'), {
    module: m,
    require: id => id === 'homey' ? { App: class {} }
      : id === 'node-fetch' ? async () => ({
        ok: true, headers: { get: name => name === 'content-type' ? type : '8' },
        buffer: async () => Buffer.alloc(8)
      }) : {},
    Buffer,
    console: { log() {} },
    global: { gc: () => assert.fail('Playback must not force garbage collection') },
    setTimeout(callback) { const id = ++handle; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const app = new m.exports();
  const played = [];
  app.homey = { audio: {
    playWav: async (id, buffer) => played.push(buffer),
    removeWav: async () => {},
    playMp3: async (id, buffer) => played.push(buffer),
    removeMp3: async () => {}
  } };
  return { app, timers, played };
}

test('WAV and MP3 playback work without requiring or forcing global GC', async () => {
  for (const type of ['audio/wav', 'audio/mpeg']) {
    const { app, played } = createApp(type);
    assert.equal(await app.playUrl('http://example.invalid/audio'), true);
    assert.equal(played.length, 1);
    assert.equal(played[0].length, 8);
  }
});

test('replacing playback and shutdown release queued segments and timers', async () => {
  const { app, timers } = createApp('audio/wav');
  app.segments = [Buffer.alloc(16), Buffer.alloc(16)];
  app.SetTimeout(1000);
  assert.equal(timers.size, 1);
  await app.playUrl('http://example.invalid/replacement');
  assert.equal(timers.size, 0);
  assert.equal(app.segments, null);
  app.segments = [Buffer.alloc(16), Buffer.alloc(16)];
  app.SetTimeout(1000);
  app.onUninit();
  assert.equal(timers.size, 0);
  assert.equal(app.segments, null);
  assert.equal(app.timeout, null);
});
