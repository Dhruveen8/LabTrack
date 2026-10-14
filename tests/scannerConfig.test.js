import test from 'node:test';
import assert from 'node:assert/strict';
import { getScanBox } from '../src/utils/scannerConfig.js';

test('ID card scan area fits wide Code 128 barcodes on phone and desktop cameras', () => {
  for (const [width, height] of [[320, 240], [640, 480], [360, 640], [1280, 720]]) {
    const box = getScanBox(width, height, 'id');
    assert.ok(box.width <= width && box.height <= height);
    assert.ok(box.width / box.height >= 3);
    assert.ok(box.width >= width * 0.9 || box.width === 500);
  }
});

test('equipment scan area stays square and fits narrow camera viewports', () => {
  assert.deepEqual(getScanBox(640, 480, 'equipment'), { width: 250, height: 250 });
  assert.deepEqual(getScanBox(240, 320, 'equipment'), { width: 180, height: 180 });
});
