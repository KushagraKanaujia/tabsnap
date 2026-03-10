// TabSnap - Smart tab focus behavior for Chrome
// Uses a hybrid strategy: proximity-based with LRU fallback

const STORAGE_KEYS = {
  LRU_DATA: 'lru_data',
  STRATEGY: 'strategy',
  REDIRECT_COUNT: 'redirect_count'
};

const STRATEGIES = {
  PROXIMITY: 'proximity',
  LRU: 'lru',
  HYBRID: 'hybrid'
};

const LRU_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const FOCUS_DELAY_MS = 50; // Delay to let Chrome's default focus settle

// Cache of tab indices (since onRemoved fires after tab is deleted)
const tabIndexCache = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('TabSnap installed');

  // Set default strategy if not already set
  const { strategy } = await chrome.storage.sync.get(STORAGE_KEYS.STRATEGY);
  if (!strategy) {
    await chrome.storage.sync.set({ [STORAGE_KEYS.STRATEGY]: STRATEGIES.HYBRID });
  }

  // Initialize redirect count
  const { redirect_count } = await chrome.storage.local.get(STORAGE_KEYS.REDIRECT_COUNT);
  if (redirect_count === undefined) {
    await chrome.storage.local.set({ [STORAGE_KEYS.REDIRECT_COUNT]: 0 });
  }

  // Initialize LRU data for existing tabs
  await initializeLRUData();
});

// Initialize LRU tracking data for all existing tabs
async function initializeLRUData() {
  const tabs = await chrome.tabs.query({});
  const lruData = {};
  const now = Date.now();

  for (const tab of tabs) {
    lruData[tab.id] = now;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.LRU_DATA]: lruData });
}

// Update LRU timestamp when tab is activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId, windowId } = activeInfo;

  // Cache the tab's index for when it might be closed
  try {
    const tab = await chrome.tabs.get(tabId);
    tabIndexCache.set(tabId, tab.index);
  } catch (error) {
    // Tab might have been closed already
    console.warn('Could not cache tab index:', error);
  }

  // Update LRU timestamp
  const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);
  lru_data[tabId] = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEYS.LRU_DATA]: lru_data });
});

// Clean up when tab is created (add to LRU tracking)
chrome.tabs.onCreated.addListener(async (tab) => {
  const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);
  lru_data[tab.id] = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEYS.LRU_DATA]: lru_data });
});

// Main logic: Handle tab removal
chrome.tabs.onRemoved.addListener(async (removedTabId, removeInfo) => {
  const { windowId, isWindowClosing } = removeInfo;

  // Don't do anything if the whole window is closing
  if (isWindowClosing) {
    await cleanupTabData(removedTabId);
    return;
  }

  try {
    // Get current strategy
    const { strategy = STRATEGIES.HYBRID } = await chrome.storage.sync.get(STORAGE_KEYS.STRATEGY);

    // Get the cached index of the removed tab
    const removedTabIndex = tabIndexCache.get(removedTabId);
    tabIndexCache.delete(removedTabId);

    // Get all tabs in the window
    const tabs = await chrome.tabs.query({ windowId });

    // If no tabs, nothing to do
    if (tabs.length === 0) {
      await cleanupTabData(removedTabId);
      return;
    }

    // If only one tab left, make sure it's focused
    if (tabs.length === 1) {
      await sleep(FOCUS_DELAY_MS);
      await chrome.tabs.update(tabs[0].id, { active: true });

      // Increment redirect count
      const { redirect_count = 0 } = await chrome.storage.local.get(STORAGE_KEYS.REDIRECT_COUNT);
      await chrome.storage.local.set({ [STORAGE_KEYS.REDIRECT_COUNT]: redirect_count + 1 });

      await cleanupTabData(removedTabId);
      return;
    }

    // Small delay to let Chrome's default focus happen first
    await sleep(FOCUS_DELAY_MS);

    // Find the best tab to focus based on strategy
    let targetTab = null;

    if (strategy === STRATEGIES.PROXIMITY) {
      targetTab = await findProximityTab(tabs, removedTabIndex);
    } else if (strategy === STRATEGIES.LRU) {
      targetTab = await findLRUTab(tabs);
    } else {
      // HYBRID strategy
      targetTab = await findHybridTab(tabs, removedTabIndex);
    }

    if (targetTab) {
      // Focus the selected tab
      await chrome.tabs.update(targetTab.id, { active: true });

      // Increment redirect count
      const { redirect_count = 0 } = await chrome.storage.local.get(STORAGE_KEYS.REDIRECT_COUNT);
      await chrome.storage.local.set({ [STORAGE_KEYS.REDIRECT_COUNT]: redirect_count + 1 });

      console.log(`TabSnap: Focused tab ${targetTab.id} using ${strategy} strategy`);
    }

    // Clean up storage for removed tab
    await cleanupTabData(removedTabId);

  } catch (error) {
    console.error('TabSnap error:', error);
    await cleanupTabData(removedTabId);
  }
});

// Find tab using proximity strategy
async function findProximityTab(tabs, removedTabIndex) {
  if (removedTabIndex === undefined) {
    // Fallback to first tab if we don't have the index
    return tabs[0];
  }

  // Find closest tab by index
  let closestTab = null;
  let minDistance = Infinity;

  for (const tab of tabs) {
    const distance = Math.abs(tab.index - removedTabIndex);
    if (distance < minDistance) {
      minDistance = distance;
      closestTab = tab;
    }
  }

  return closestTab;
}

// Find tab using LRU strategy
async function findLRUTab(tabs) {
  const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);

  let lruTab = null;
  let latestTimestamp = 0;

  for (const tab of tabs) {
    const timestamp = lru_data[tab.id] || 0;
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      lruTab = tab;
    }
  }

  return lruTab || tabs[0]; // Fallback to first tab
}

// Find tab using hybrid strategy (proximity + LRU fallback)
async function findHybridTab(tabs, removedTabIndex) {
  const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);
  const now = Date.now();

  if (removedTabIndex === undefined) {
    // If we don't have the index, fall back to LRU
    return await findLRUTab(tabs);
  }

  // Find all tabs at minimum distance
  let minDistance = Infinity;
  const candidateTabs = [];

  for (const tab of tabs) {
    const distance = Math.abs(tab.index - removedTabIndex);
    if (distance < minDistance) {
      minDistance = distance;
      candidateTabs.length = 0; // Clear previous candidates
      candidateTabs.push(tab);
    } else if (distance === minDistance) {
      candidateTabs.push(tab);
    }
  }

  // If only one candidate, check if it's stale (>5 minutes)
  if (candidateTabs.length === 1) {
    const tab = candidateTabs[0];
    const lastUsed = lru_data[tab.id] || 0;
    const timeSinceUse = now - lastUsed;

    if (timeSinceUse > LRU_TIMEOUT_MS) {
      // Tab is stale, fall back to LRU
      return await findLRUTab(tabs);
    }

    return tab;
  }

  // Multiple candidates at same distance - pick most recently used
  let bestTab = candidateTabs[0];
  let latestTimestamp = lru_data[bestTab.id] || 0;

  for (const tab of candidateTabs) {
    const timestamp = lru_data[tab.id] || 0;
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      bestTab = tab;
    }
  }

  return bestTab;
}

// Clean up storage for removed tab
async function cleanupTabData(tabId) {
  const { lru_data = {} } = await chrome.storage.local.get(STORAGE_KEYS.LRU_DATA);
  delete lru_data[tabId];
  await chrome.storage.local.set({ [STORAGE_KEYS.LRU_DATA]: lru_data });
}

// Utility: sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
