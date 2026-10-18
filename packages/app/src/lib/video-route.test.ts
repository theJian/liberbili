import { expect, test } from 'bun:test';
import { videoRouteAction } from './video-route';

test('queue advance follows the new video and waits while old route/detail remain visible', () => {
  const state = {
    focused: true,
    bvid: 'A',
    summaryBvid: 'A',
    openedBvid: 'A',
    previousCurrent: 'A',
    currentBvid: 'B',
  };
  expect(videoRouteAction(state)).toEqual({ type: 'follow', bvid: 'B' });
  expect(
    videoRouteAction({
      ...state,
      openedBvid: 'B',
      previousCurrent: 'B',
      pendingBvid: 'B',
    }),
  ).toEqual({ type: 'wait' });
  expect(
    videoRouteAction({
      ...state,
      bvid: 'B',
      openedBvid: 'B',
      previousCurrent: 'B',
      pendingBvid: 'B',
    }),
  ).toEqual({ type: 'wait' });
});

test('background screens do not navigate or restart their old video', () => {
  expect(
    videoRouteAction({
      focused: false,
      bvid: 'A',
      summaryBvid: 'A',
      openedBvid: 'A',
      previousCurrent: 'A',
      currentBvid: 'B',
    }),
  ).toEqual({ type: 'wait' });
});

test('explicit navigation opens once correct details arrive and rejects stale details', () => {
  const state = {
    focused: true,
    bvid: 'C',
    summaryBvid: 'A',
    openedBvid: 'A',
    previousCurrent: 'A',
    currentBvid: 'A',
  };
  expect(videoRouteAction(state)).toEqual({ type: 'wait' });
  expect(videoRouteAction({ ...state, summaryBvid: 'C' })).toEqual({
    type: 'open',
  });
  expect(
    videoRouteAction({ ...state, summaryBvid: 'C', openedBvid: 'C' }),
  ).toEqual({ type: 'wait' });
});
