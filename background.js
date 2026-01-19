/**
 * Calendar Auto Categories for Thunderbird
 * 
 * Automatically assigns categories (with colors) to calendar events
 * based on keywords in the event title.
 */

// Default configuration (used if no settings saved yet)
const DEFAULT_CONFIG = {
  categories: {
    "Auslieferung": "#8B0000",
    "Abholung":     "#FF0000",
    "Rückgabe":     "#FFD700",
    "Rücknahme":    "#FFFF00",
    "Ferien":       "#800080",
    "Linth":        "#0000FF",
  },
  daysBack: 1,
  daysForward: 90,
  intervalMinutes: 10,
  fullWidthColors: true,  // Show category colors as full background
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

// Interval timer reference
let scanInterval = null;

/**
 * Load configuration from storage
 */
async function loadConfig() {
  try {
    const stored = await browser.storage.local.get("config");
    if (stored.config) {
      config = { ...DEFAULT_CONFIG, ...stored.config };
    } else {
      // First run: save defaults
      await browser.storage.local.set({ config: DEFAULT_CONFIG });
    }
    console.log("Calendar Auto Categories: Config loaded");
    console.log(`  Categories: ${Object.keys(config.categories).length}`);
    console.log(`  Time range: -${config.daysBack} to +${config.daysForward} days`);
    console.log(`  Interval: ${config.intervalMinutes} minutes`);
  } catch (error) {
    console.error("Error loading config:", error);
  }
}

/**
 * Build rules array from categories config
 */
function buildRules() {
  return Object.keys(config.categories).map(name => ({
    keyword: name,
    category: name
  }));
}

/**
 * Ensure all categories exist with their colors
 */
async function ensureCategories() {
  console.log("Calendar Auto Categories: Ensuring categories exist...");
  
  try {
    const result = await browser.calendarCategories.ensureCategories(
      config.categories
    );
    console.log(`  ${result.created} new, ${result.existing} existing`);
  } catch (error) {
    console.error("Error creating categories:", error);
  }
}

/**
 * Apply or remove full-width color styles
 */
async function applyStyles() {
  try {
    await browser.calendarCategories.injectCalendarStyles(config.fullWidthColors);
    console.log(`Calendar Auto Categories: Full-width colors ${config.fullWidthColors ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error("Error applying styles:", error);
  }
}

/**
 * Apply categories to matching events
 */
async function applyCategories(force = false) {
  console.log(`Calendar Auto Categories: Scanning events...${force ? ' (FORCE MODE)' : ''}`);
  
  const rules = buildRules();
  
  if (rules.length === 0) {
    console.log("  No rules defined, skipping scan");
    return { processed: 0, modified: 0, details: [] };
  }
  
  try {
    const stats = await browser.calendarCategories.applyCategories(
      rules,
      config.daysBack,
      config.daysForward,
      force
    );
    
    console.log(`  ${stats.processed} events checked, ${stats.modified} categorized`);
    
    if (stats.modified > 0) {
      console.log("  Modified events:");
      for (const detail of stats.details) {
        console.log(`    - "${detail.title}" → ${detail.category}`);
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error("Error applying categories:", error);
    throw error;
  }
}

/**
 * Set up recurring scan interval
 */
function setupInterval() {
  // Clear existing interval
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  
  // Set up new interval if > 0
  if (config.intervalMinutes > 0) {
    scanInterval = setInterval(applyCategories, config.intervalMinutes * 60 * 1000);
    console.log(`Calendar Auto Categories: Scan interval set to ${config.intervalMinutes} minutes`);
  } else {
    console.log("Calendar Auto Categories: Interval disabled (0 minutes)");
  }
}

/**
 * Handle messages from options page
 */
browser.runtime.onMessage.addListener(async (message, sender) => {
  console.log("Calendar Auto Categories: Received message:", message.action);
  
  switch (message.action) {
    case "configUpdated":
      // Reload config and restart interval
      await loadConfig();
      await ensureCategories();
      await applyStyles();
      setupInterval();
      return { success: true };
      
    case "scanNow":
      // Run immediate scan
      await ensureCategories();
      const stats = await applyCategories(false);
      return { success: true, stats };
      
    case "forceScan":
      // Run forced scan (re-apply all categories)
      await ensureCategories();
      const forceStats = await applyCategories(true);
      return { success: true, stats: forceStats };
    
    case "resetCategories":
      // Remove all addon-created categories
      const removed = await browser.calendarCategories.removeCategories(message.categoryNames);
      return { success: true, removed };
      
    default:
      return { success: false, error: "Unknown action" };
  }
});

/**
 * Main initialization
 */
async function init() {
  console.log("Calendar Auto Categories: Initializing...");
  
  // Load configuration
  await loadConfig();
  
  // Ensure categories exist
  await ensureCategories();
  
  // Apply full-width color styles
  await applyStyles();
  
  // Apply to existing events
  await applyCategories();
  
  // Set up recurring scan
  setupInterval();
  
  console.log("Calendar Auto Categories: Ready");
}

// Run after short delay to let calendars load
setTimeout(init, 5000);

console.log("Calendar Auto Categories: Add-on loaded");
