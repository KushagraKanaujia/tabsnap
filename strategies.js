// TabSnap focus strategies — pure functions, no chrome.* calls.
// Shared by the service worker (via importScripts), the unit tests (Node)
// and the interactive demo on the landing page.
//
// Inputs:
//   tabs           remaining tabs in the window AFTER the close: [{ id, index }]
//   removedIndex   index the closed tab had BEFORE it was removed (or undefined)
//   lru            map of tabId -> last-used timestamp (ms)
//   now            current time (ms)
(function (root) {
  const STRATEGIES = { PROXIMITY: 'proximity', LRU: 'lru', HYBRID: 'hybrid' };
  const LRU_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // After a close, every tab to the right of the closed one shifts left by 1.
  // Map a tab back to the position it had before the close, so both neighbours
  // are at distance 1 (left = removedIndex - 1, right = removedIndex + 1).
  function distance(tab, removedIndex) {
    const originalIndex = tab.index >= removedIndex ? tab.index + 1 : tab.index;
    return Math.abs(originalIndex - removedIndex);
  }

  function closestTabs(tabs, removedIndex) {
    let min = Infinity;
    let out = [];
    for (const tab of tabs) {
      const d = distance(tab, removedIndex);
      if (d < min) { min = d; out = [tab]; } else if (d === min) { out.push(tab); }
    }
    return out;
  }

  function mostRecent(tabs, lru) {
    let best = null;
    let latest = -1;
    for (const tab of tabs) {
      const t = lru[tab.id] || 0;
      if (t > latest) { latest = t; best = tab; }
    }
    return best;
  }

  function proximity(tabs, removedIndex, lru) {
    if (!tabs.length) return null;
    if (removedIndex === undefined) return tabs[0];
    // Tie between left and right neighbour: prefer the one used more recently.
    return mostRecent(closestTabs(tabs, removedIndex), lru || {});
  }

  function lruStrategy(tabs, lru) {
    if (!tabs.length) return null;
    return mostRecent(tabs, lru || {}) || tabs[0];
  }

  function hybrid(tabs, removedIndex, lru, now) {
    if (!tabs.length) return null;
    lru = lru || {};
    if (removedIndex === undefined) return lruStrategy(tabs, lru);
    const best = mostRecent(closestTabs(tabs, removedIndex), lru);
    // If even the best nearby tab is stale, go back to what you were doing.
    if ((now - (lru[best.id] || 0)) > LRU_TIMEOUT_MS) return lruStrategy(tabs, lru);
    return best;
  }

  function pickTab(strategy, tabs, removedIndex, lru, now) {
    if (strategy === STRATEGIES.PROXIMITY) return proximity(tabs, removedIndex, lru);
    if (strategy === STRATEGIES.LRU) return lruStrategy(tabs, lru);
    return hybrid(tabs, removedIndex, lru, now);
  }

  const api = { STRATEGIES, LRU_TIMEOUT_MS, pickTab, proximity, lru: lruStrategy, hybrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TabSnapStrategies = api;
})(typeof self !== 'undefined' ? self : globalThis);
