// TabSnap - Smart tab focus behavior for Chrome
// Decides which tab to focus when you close the ACTIVE tab.
// The strategy logic itself lives in strategies.js (pure, unit-tested).

importScripts('strategies.js');
const { STRATEGIES, pickTab } = self.TabSnapStrategies;

const STORAGE_KEYS = {
  LRU_DATA: 'lru_data',
  STRATEGY: 'strategy',
  REDIRECT_COUNT: 'redirect_count'
};

const FOCUS_DELAY_MS = 50; // Delay to let Chrome's default focus settle

// Per-window record of the active tab and its index, kept in session storage
// so it survives the service worker going to sleep. We need it because
// onRemoved fires after the tab is gone (no index, no "was it active?").
const activeKey = (windowId) => `active_${windowId}`;

async function rememberActiveTab(windowId) {
  try {
    const [tab] = await chrome.tabs.query({ windowId, active: true });
    if (tab) {
      await chrome.storage.session.set({ [activeKey(windowId)]: { tabId: tab.id, index: tab.index } });
    }
  } catch (error) {
    // Window may be gone already
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('TabSnap installed');

  const { strategy } = await chrome.storage.sync.get(STORAGE_KEYS.STRATEGY);
  if (!strategy) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.STRATEGY]: STRATEGIES.HYBRID });
  }

  const { redirect_count } = await chrome.storage.local.get(STORAGE_KEYS.REDIRECT_COUNT);
  if (redirect_count === undefined) {
    await chrome.storage.local.set({ [STORAGE_KEYS.REDIRECT_COUNT]: 0 });
  }

  await initializeState();
});

chrome.runtime.onStartup.addListener(initializeState);

// Seed LRU data and the active-tab record for all existing windows
async function initializeState() {
  const tabs = await chrome.tabs.query({});
  const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);
  const fresh = {};
  const now = Date.now();
  for (const tab of tabs) {
    fresh[tab.id] = lru_data[tab.id] || now;
    if (tab.active) {
      await chrome.storage.session.set({ [activeKey(tab.windowId)]: { tabId: tab.id, index: tab.index } });
    }
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.LRU_DATA]: fresh });
}

// LRU data is read-modify-written from several listeners; run those updates
// one at a time so they can't overwrite each other.
let lruQueue = Promise.resolve();
function updateLRU(mutate) {
  lruQueue = lruQueue.then(async () => {
    const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);
    mutate(lru_data);
    await chrome.storage.local.set({ [STORAGE_KEYS.LRU_DATA]: lru_data });
  }).catch((error) => console.warn('TabSnap: LRU update failed', error));
  return lruQueue;
}

// Update LRU timestamp and active-tab record when a tab is activated
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  await Promise.all([
    rememberActiveTab(windowId),
    updateLRU((lru) => { lru[tabId] = Date.now(); })
  ]);
});

// New tabs join LRU tracking
chrome.tabs.onCreated.addListener(async (tab) => {
  await Promise.all([
    rememberActiveTab(tab.windowId),
    updateLRU((lru) => { lru[tab.id] = Date.now(); })
  ]);
});

// Tab positions can shift without an activation; keep the active index fresh
chrome.tabs.onMoved.addListener((tabId, { windowId }) => rememberActiveTab(windowId));
chrome.tabs.onAttached.addListener((tabId, { newWindowId }) => rememberActiveTab(newWindowId));
chrome.tabs.onDetached.addListener((tabId, { oldWindowId }) => rememberActiveTab(oldWindowId));

// Main logic: Handle tab removal
chrome.tabs.onRemoved.addListener(async (removedTabId, removeInfo) => {
  const { windowId, isWindowClosing } = removeInfo;

  // Snapshot state first: Chrome activates its own pick right after this
  // event, and that activation must not count as "most recently used".
  const key = activeKey(windowId);
  const [{ [key]: active }, { lru_data = {} }, { strategy = STRATEGIES.HYBRID }] = await Promise.all([
    chrome.storage.session.get(key),
    chrome.storage.local.get(STORAGE_KEYS.LRU_DATA),
    chrome.storage.sync.get(STORAGE_KEYS.STRATEGY)
  ]);

  if (isWindowClosing) {
    await chrome.storage.session.remove(key);
    await cleanupTabData(removedTabId);
    return;
  }

  try {
    // Only step in when the tab you were looking at was closed.
    // Closing a background tab never changes which tab you're on.
    if (!active || active.tabId !== removedTabId) {
      return; // finally{} refreshes the active index, which may have shifted
    }

    const tabs = await chrome.tabs.query({ windowId });
    if (tabs.length <= 1) return;

    // Small delay to let Chrome's default focus happen first
    await sleep(FOCUS_DELAY_MS);

    const targetTab = pickTab(strategy, tabs, active.index, lru_data, Date.now());

    if (targetTab) {
      const [current] = await chrome.tabs.query({ windowId, active: true });
      if (!current || current.id !== targetTab.id) {
        await chrome.tabs.update(targetTab.id, { active: true });

        const { redirect_count = 0 } = await chrome.storage.local.get(STORAGE_KEYS.REDIRECT_COUNT);
        await chrome.storage.local.set({ [STORAGE_KEYS.REDIRECT_COUNT]: redirect_count + 1 });

        console.log(`TabSnap: Focused tab ${targetTab.id} using ${strategy} strategy`);
      }
    }
  } catch (error) {
    console.error('TabSnap error:', error);
  } finally {
    await cleanupTabData(removedTabId);
    await rememberActiveTab(windowId);
  }
});

// Clean up storage for removed tab
function cleanupTabData(tabId) {
  return updateLRU((lru) => { delete lru[tabId]; });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
