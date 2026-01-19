# Calendar Auto Categories

A Thunderbird add-on that automatically assigns categories (with colors) to calendar events based on keywords in the event title.

## Features

- **Automatic categorization**: Scans calendar events and assigns categories based on configurable keyword rules
- **Full-width category colors**: Optional CSS injection to display category colors as full event background (instead of tiny color bar)
- **Configurable rules**: Add, edit, and remove keyword-to-category mappings via settings UI
- **Color management**: Automatically creates categories with specified colors in Thunderbird
- **Time range settings**: Configure how far back and forward to scan
- **Periodic scanning**: Set automatic scan interval (or disable for manual-only)
- **Force re-scan**: Re-apply categories even if already set
- **Export/Import**: Backup and restore your configuration
- **Reset function**: Remove all add-on created categories cleanly

## Installation

### From Thunderbird Add-ons (ATN)
1. In Thunderbird, go to **Tools → Add-ons and Themes**
2. Search for "Calendar Auto Categories"
3. Click **Add to Thunderbird**

### Manual Installation
1. Download the `.xpi` file from [Releases](../../releases)
2. In Thunderbird, go to **Tools → Add-ons and Themes**
3. Click the gear icon ⚙️ → **Install Add-on From File...**
4. Select the downloaded `.xpi` file

## Configuration

After installation, configure the add-on:

1. Go to **Tools → Add-ons and Themes**
2. Find "Calendar Auto Categories" and click **Preferences**

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Categories | Keyword-to-color mappings | 6 default categories |
| Days Back | How many days in the past to scan | 1 |
| Days Forward | How many days in the future to scan | 90 |
| Interval | Minutes between automatic scans (0 = disabled) | 10 |
| Full-width colors | Show category colors as full background | Enabled |

### Default Categories

| Keyword | Color |
|---------|-------|
| Auslieferung | Dark Red (#8B0000) |
| Abholung | Red (#FF0000) |
| Rückgabe | Gold (#FFD700) |
| Rücknahme | Yellow (#FFFF00) |
| Ferien | Purple (#800080) |
| Linth | Blue (#0000FF) |

## Usage

### Adding a Category
1. Open add-on preferences
2. Enter a keyword in "New keyword"
3. Select a color
4. Click **+ Add**
5. Click **Save**

### Changing a Color
1. Click the color swatch next to any category
2. Select new color
3. Click **Save**
4. Restart Thunderbird for changes to take effect

### Removing a Category
1. Click the **×** next to the category
2. Click **Save**

### Action Buttons

| Button | Function |
|--------|----------|
| 🔍 Scan Now | Run a normal scan (only adds missing categories) |
| 🔄 Force Re-Scan | Re-apply all categories (overwrites existing) |
| 🗑️ Reset Categories | Remove all add-on created categories from Thunderbird |
| 📤 Export | Download configuration as JSON file |
| 📥 Import | Load configuration from JSON file |

## How It Works

1. The add-on scans all writable calendars for events within the configured time range
2. For each event, it checks if the title contains any configured keyword (case-insensitive)
3. If a match is found and the category isn't already assigned, it adds the category
4. First matching keyword wins (order matters)
5. Categories are created in Thunderbird with the specified colors

## Compatibility

- **Thunderbird**: 115.0 and later (tested on 128.x)
- **Calendar types**: Works with local calendars, CalDAV, and Google Calendar (via Provider for Google Calendar)

### Note on Google Calendar

Google Calendar doesn't sync the `CATEGORIES` property. However, Thunderbird caches categories locally, so colors will persist as long as you don't clear the calendar cache.

## Permissions

This add-on requires an Experiment API to access Thunderbird's internal calendar APIs. This is necessary because:

- WebExtension APIs don't provide calendar category management
- Preferences must be set for category colors
- CSS injection requires privileged access

## Troubleshooting

### Colors not showing
1. Restart Thunderbird after changing colors
2. Use "Force Re-Scan" to re-apply categories
3. Check about:config for `calendar.category.color.*` prefs

### Categories not created
1. Check the error console (Ctrl+Shift+J) for errors
2. Verify the category appears in `calendar.categories.names` in about:config

### Reset everything
1. Click "Reset Categories" in add-on preferences
2. Restart Thunderbird
3. Re-save your configuration

## Building from Source

```bash
# Clone repository
git clone https://github.com/akirschten/calendar-auto-categories.git
cd calendar-auto-categories

# Create XPI
zip -r calendar-auto-categories.xpi manifest.json background.js api/ options/ icons/
```

## License

MIT License - see [LICENSE](LICENSE) file.

## Contributing

Contributions welcome! Please open an issue or pull request.

## Author

Andreas Kirschten - C|E|S Catering & Event Services GmbH

## Changelog

### 1.4.0
- Added: Color update support (changing colors now works)
- Added: Reset Categories button to remove all add-on categories
- Fixed: Proper encoding for special characters (umlauts) in category names

### 1.3.5
- Fixed: Umlaut encoding for category pref names (ü → -uxfc-)

### 1.3.4
- Fixed: Category color prefs now use lowercase names

### 1.3.2
- Fixed: Categories now properly registered in names list

### 1.3.0
- Added: Full-width category colors via CSS injection
- Added: Toggle for full-width colors in settings

### 1.2.0
- Added: Settings UI for category management
- Added: Export/Import configuration
- Added: Force Re-Scan option

### 1.0.0
- Initial release
