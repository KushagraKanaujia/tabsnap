// Popup script for TabSnap settings

const STORAGE_KEYS = {
  STRATEGY: 'strategy',
  REDIRECT_COUNT: 'redirect_count'
};

const STRATEGIES = {
  PROXIMITY: 'proximity',
  LRU: 'lru',
  HYBRID: 'hybrid'
};

// Load and display current settings
async function loadSettings() {
  // Load strategy
  const { strategy = STRATEGIES.HYBRID } = await chrome.storage.sync.get(STORAGE_KEYS.STRATEGY);

  // Set the radio button
  const radioButton = document.querySelector(`input[value="${strategy}"]`);
  if (radioButton) {
    radioButton.checked = true;
  }

  // Load redirect count
  const { redirect_count = 0 } = await chrome.storage.local.get(STORAGE_KEYS.REDIRECT_COUNT);
  document.getElementById('redirect-count').textContent = redirect_count.toLocaleString();
}

// Save strategy when changed
function setupEventListeners() {
  const radioButtons = document.querySelectorAll('input[name="strategy"]');

  radioButtons.forEach(radio => {
    radio.addEventListener('change', async (event) => {
      const selectedStrategy = event.target.value;
      await chrome.storage.sync.set({ [STORAGE_KEYS.STRATEGY]: selectedStrategy });
      console.log('Strategy updated to:', selectedStrategy);
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
});
