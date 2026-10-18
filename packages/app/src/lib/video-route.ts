type RouteState = {
  focused: boolean;
  bvid: string;
  summaryBvid?: string;
  currentBvid?: string;
  previousCurrent?: string;
  openedBvid?: string;
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
