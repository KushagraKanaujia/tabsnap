# ⚡ TabSnap

**Smart tab focus behavior for Chrome**

TabSnap is a Chrome extension that overrides the default tab focus behavior when you close a tab. Instead of always focusing the right neighbor (Chrome's default), TabSnap intelligently chooses the best tab using configurable strategies.

## Why TabSnap?

Chrome's default behavior when closing a tab is simple but not always ideal—it focuses the tab to the right. This can be frustrating when:

- You've been working with tabs on the left side of your closed tab
- You frequently jump between non-adjacent tabs
- You want to return to your most recently used tab instead

TabSnap gives you control over this behavior with three smart strategies.

## Features

- 🎯 **Three Focus Strategies**: Proximity, LRU, or Hybrid (default)
- 💾 **Persistent Storage**: LRU tracking survives service worker sleep cycles
- ⚡ **Lightweight**: No content scripts, minimal memory footprint
- 🔒 **Privacy-First**: All data stored locally, no external requests
- 📊 **Usage Stats**: Track how many times TabSnap has redirected focus

## Installation

### From Source (Unpacked Extension)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/tabsnap.git
   cd tabsnap
   ```

2. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **Load unpacked**
   - Select the `tabsnap` folder

3. **Done!** The extension icon should appear in your toolbar.

### From Chrome Web Store

*Coming soon!*

## Focus Strategies

TabSnap offers three strategies for choosing which tab to focus when you close a tab:

### 1. Proximity

**Focus the tab with the closest index to the one just closed.**

- Simple and predictable
- Mimics the behavior of closing a file in a text editor
- If the closed tab was at index 3, it focuses whichever remaining tab is closest to that position

**Best for:** Users who organize tabs spatially and want predictable left/right navigation.

### 2. LRU (Least Recently Used)

**Always focus the most recently used tab.**

- Returns you to the tab you were last viewing
- Great for tab-hoppers who jump around frequently
- Ignores tab position entirely

**Best for:** Power users who frequently switch between non-adjacent tabs.

### 3. Hybrid (Default)

**Proximity-based with intelligent LRU fallback.**

This is the sweet spot:

1. **First, find the closest tab by index** (just like Proximity strategy)
2. **If there's a tie**, pick the most recently used among the tied tabs
3. **If the closest tab hasn't been used in over 5 minutes**, fall back to the most recently used tab instead

**Why 5 minutes?** If you haven't touched a tab in 5 minutes, chances are it's not relevant to your current workflow. The Hybrid strategy recognizes this and returns you to your active context instead.

**Best for:** Most users—balances spatial awareness with usage patterns.

## Configuration

Click the TabSnap extension icon to open the settings popup:

- **Select your preferred strategy** (Proximity / LRU / Hybrid)
- **View redirect count** to see how many times TabSnap has changed focus

Settings are synced across Chrome instances using `chrome.storage.sync`.

## Technical Details

- **Manifest Version:** 3
- **Permissions:** `tabs`, `storage`
- **Architecture:** Service worker only (no content scripts)
- **Storage:**
  - `chrome.storage.local`: LRU timestamps and redirect count (persists across service worker cycles)
  - `chrome.storage.sync`: User strategy preference (syncs across devices)

### How It Works

1. **Tab Activation Tracking**: When you switch to a tab, TabSnap records the timestamp in `chrome.storage.local`
2. **Index Caching**: The `onActivated` listener caches each tab's index because `onRemoved` fires after the tab is already deleted
3. **Focus Override**: When a tab closes, TabSnap waits ~50ms (to let Chrome's default focus settle), then applies the selected strategy to choose the best tab
4. **Cleanup**: Removed tabs are purged from LRU storage to prevent memory leaks

### Edge Cases Handled

- ✅ Last tab in window (does nothing)
- ✅ Window closing (skips focus override)
- ✅ Service worker sleep cycles (uses persistent storage)
- ✅ Pinned tabs (treated like normal tabs)
- ✅ Tab groups (treated like normal tabs)
- ✅ Incognito windows (works independently in each context)

## Development

### Project Structure

```
tabsnap/
├── manifest.json       # Extension manifest (V3)
├── background.js       # Service worker with tab focus logic
├── popup.html          # Settings UI
├── popup.js            # Settings logic
├── icons/              # Extension icons (16, 48, 128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── generate_icons.py   # Script to generate placeholder icons
└── README.md
```

### Building Icons

Icons are generated programmatically using Python:

```bash
python3 generate_icons.py
```

### Debugging

1. Open `chrome://extensions`
2. Find TabSnap and click **Inspect views: service worker**
3. Check the console for logs like:
   ```
   TabSnap: Focused tab 123 using hybrid strategy
   ```

### Testing

To test the extension:

1. Open several tabs
2. Switch between them to build LRU history
3. Close a middle tab and observe which tab gets focused
4. Try different strategies in the popup and compare behavior

## Contributing

Contributions are welcome! Here's how you can help:

### Reporting Issues

- Check if the issue already exists in [Issues](https://github.com/yourusername/tabsnap/issues)
- Include Chrome version, OS, and steps to reproduce
- For focus behavior bugs, include the tab layout and which tab was closed

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with clear commit messages
4. Test thoroughly in Chrome
5. Submit a PR with a clear description

### Code Style

- Use clear, descriptive variable names
- Add comments for complex logic
- Keep functions focused and single-purpose
- Follow the existing code style (2-space indents, semicolons)

## Roadmap

Potential future enhancements:

- [ ] Exclude certain tabs from focus (e.g., pinned tabs)
- [ ] Per-window strategy override
- [ ] Customizable LRU timeout
- [ ] Tab groups awareness (stay within group)
- [ ] Export/import settings
- [ ] Dark/light theme toggle for popup

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with frustration after closing the wrong tab one too many times. 😅

---

**Like TabSnap?** Star the repo and share it with fellow tab hoarders!
