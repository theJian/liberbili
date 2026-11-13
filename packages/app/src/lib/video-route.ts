/**
 * Decides how VideoScreen synchronizes its route with the shared player.
 * videoRouteAction returns `follow` for a queue change, `open` for a new route
 * with matching details, or `wait`. The screen performs navigation/playback and
 * maintains the remembered IDs below; this helper only decides the next action.
 */
type RouteState = {
  focused: boolean;
  bvid: string;
  summaryBvid?: string;
  currentBvid?: string;
  /** Player BV ID remembered from the screen's last processed synchronization. */
  previousCurrent?: string;
  /** Last route BV ID handled by opening it or following a queue change. */
  openedBvid?: string;
  /** BV ID requested through setParams, until the route reports that ID. */
  pendingBvid?: string;
};
type RouteAction =
  | { type: 'follow'; bvid: string }
  | { type: 'open' }
  | { type: 'wait' };

export function videoRouteAction(state: RouteState): RouteAction {
  if (!state.focused || (state.pendingBvid && state.pendingBvid !== state.bvid))
    return { type: 'wait' };
  if (
    state.openedBvid === state.bvid &&
    state.currentBvid &&
    state.previousCurrent === state.openedBvid &&
    state.currentBvid !== state.openedBvid
  )
    return { type: 'follow', bvid: state.currentBvid };
  if (state.summaryBvid === state.bvid && state.openedBvid !== state.bvid)
    return { type: 'open' };
  return { type: 'wait' };
}
