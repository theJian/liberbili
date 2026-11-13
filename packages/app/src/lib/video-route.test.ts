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

test('same-video part or time navigation opens once, including while the player changes', () => {
  const state = {
    focused: true,
    bvid: 'A',
    summaryBvid: 'A',
    openedBvid: 'A',
    previousCurrent: 'A',
    currentBvid: 'B',
    routeKey: 'A:2:42',
    openedRoute: 'A:1:0',
  };
  expect(videoRouteAction(state)).toEqual({ type: 'open' });
  expect(
    videoRouteAction({
      ...state,
      currentBvid: 'A',
      openedRoute: state.routeKey,
    }),
  ).toEqual({ type: 'wait' });
});

test('queue navigation follows once and does not replay the previous linked position', () => {
  const state = {
    focused: true,
    bvid: 'A',
    summaryBvid: 'A',
    openedBvid: 'A',
    previousCurrent: 'A',
    currentBvid: 'B',
    routeKey: 'A:2:42',
    openedRoute: 'A:2:42',
  };
  expect(videoRouteAction(state)).toEqual({ type: 'follow', bvid: 'B' });
  expect(
    videoRouteAction({
      ...state,
      bvid: 'B',
      summaryBvid: 'B',
      openedBvid: 'B',
      previousCurrent: 'B',
      routeKey: 'B::',
      openedRoute: 'B::',
      pendingBvid: 'B',
    }),
  ).toEqual({ type: 'wait' });
});
