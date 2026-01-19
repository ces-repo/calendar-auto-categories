/**
 * Calendar Auto Categories - Options Page Logic
 */

// Default configuration
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
  fullWidthColors: true,
};

// Current configuration (will be loaded from storage)
let config = { ...DEFAULT_CONFIG };

// DOM Elements
const elements = {
  categoriesList: document.getElementById("categories-list"),
  newKeyword: document.getElementById("new-keyword"),
  newColor: document.getElementById("new-color"),
  addCategory: document.getElementById("add-category"),
  daysBack: document.getElementById("days-back"),
  daysForward: document.getElementById("days-forward"),
  interval: document.getElementById("interval"),
  fullWidthColors: document.getElementById("full-width-colors"),
  scanNow: document.getElementById("scan-now"),
  forceScan: document.getElementById("force-scan"),
  resetCategories: document.getElementById("reset-categories"),
  exportConfig: document.getElementById("export-config"),
  importConfig: document.getElementById("import-config"),
  importFile: document.getElementById("import-file"),
  save: document.getElementById("save"),
  saveStatus: document.getElementById("save-status"),
  status: document.getElementById("status"),
};

/**
 * Load configuration from storage
 */
async function loadConfig() {
  try {
    const stored = await browser.storage.local.get("config");
    if (stored.config) {
      config = { ...DEFAULT_CONFIG, ...stored.config };
    }
    renderCategories();
    renderSettings();
  } catch (error) {
    console.error("Error loading config:", error);
    showStatus("Error loading settings", "error");
  }
}

/**
 * Save configuration to storage
 */
async function saveConfig() {
  try {
    await browser.storage.local.set({ config });
    
    // Notify background script to reload
    await browser.runtime.sendMessage({ action: "configUpdated" });
    
    elements.saveStatus.textContent = "✓ Saved";
    setTimeout(() => {
      elements.saveStatus.textContent = "";
    }, 3000);
    
  } catch (error) {
    console.error("Error saving config:", error);
    showStatus("Error saving settings", "error");
  }
}

/**
 * Render categories list
 */
function renderCategories() {
  const list = elements.categoriesList;
  list.innerHTML = "";
  
  const keywords = Object.keys(config.categories);
  
  if (keywords.length === 0) {
    list.innerHTML = '<div class="empty-state">No categories defined. Add one below!</div>';
    return;
  }
  
  for (const keyword of keywords) {
    const color = config.categories[keyword];
    
    const item = document.createElement("div");
    item.className = "category-item";
    
    // Create color input
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "category-color";
    colorInput.value = color;
    colorInput.dataset.keyword = keyword;
    
    // Create keyword span
    const keywordSpan = document.createElement("span");
    keywordSpan.className = "category-keyword";
    keywordSpan.textContent = keyword;
    
    // Create delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "category-delete";
    deleteBtn.dataset.keyword = keyword;
    deleteBtn.title = "Delete";
    deleteBtn.textContent = "×";
    
    item.appendChild(colorInput);
    item.appendChild(keywordSpan);
    item.appendChild(deleteBtn);
    
    list.appendChild(item);
  }
  
  // Add event listeners for color changes
  list.querySelectorAll(".category-color").forEach(input => {
    input.addEventListener("change", (e) => {
      const keyword = e.target.dataset.keyword;
      config.categories[keyword] = e.target.value;
    });
  });
  
  // Add event listeners for delete buttons
  list.querySelectorAll(".category-delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const keyword = e.target.dataset.keyword;
      delete config.categories[keyword];
      renderCategories();
    });
  });
}

/**
 * Render settings fields
 */
function renderSettings() {
  elements.daysBack.value = config.daysBack;
  elements.daysForward.value = config.daysForward;
  elements.interval.value = config.intervalMinutes;
  elements.fullWidthColors.checked = config.fullWidthColors !== false;
}

/**
 * Add a new category
 */
function addCategory() {
  const keyword = elements.newKeyword.value.trim();
  const color = elements.newColor.value;
  
  if (!keyword) {
    showStatus("Please enter a keyword", "error");
    return;
  }
  
  if (config.categories[keyword]) {
    showStatus("Keyword already exists", "error");
    return;
  }
  
  config.categories[keyword] = color;
  elements.newKeyword.value = "";
  renderCategories();
  showStatus(`Added "${keyword}"`, "success");
}

/**
 * Update settings from form
 */
function updateSettings() {
  config.daysBack = parseInt(elements.daysBack.value) || 1;
  config.daysForward = parseInt(elements.daysForward.value) || 90;
  config.intervalMinutes = parseInt(elements.interval.value) || 10;
  config.fullWidthColors = elements.fullWidthColors.checked;
}

/**
 * Trigger immediate scan
 */
async function scanNow(force = false) {
  try {
    showStatus(force ? "Force re-scanning all events..." : "Scanning...", "info");
    const result = await browser.runtime.sendMessage({ action: force ? "forceScan" : "scanNow" });
    
    if (result && result.stats) {
      showStatus(
        `Scan complete: ${result.stats.processed} events checked, ${result.stats.modified} categorized`,
        "success"
      );
    } else {
      showStatus("Scan complete", "success");
    }
  } catch (error) {
    console.error("Scan error:", error);
    showStatus("Error during scan: " + error.message, "error");
  }
}

/**
 * Reset all addon-created categories
 */
async function resetCategories() {
  const categoryNames = Object.keys(config.categories);
  
  if (categoryNames.length === 0) {
    showStatus("No categories to reset", "info");
    return;
  }
  
  const confirmed = confirm(
    `This will remove ${categoryNames.length} categories from Thunderbird:\n\n` +
    categoryNames.join(", ") +
    "\n\nThe categories will be removed from the system. " +
    "Events will keep their category assignment but won't show colors.\n\n" +
    "Continue?"
  );
  
  if (!confirmed) {
    return;
  }
  
  try {
    showStatus("Removing categories...", "info");
    const result = await browser.runtime.sendMessage({ 
      action: "resetCategories",
      categoryNames: categoryNames
    });
    
    if (result && result.success) {
      showStatus(
        `Reset complete: ${result.removed.removedColors} colors, ${result.removed.removedNames} names removed. Restart Thunderbird to see changes.`,
        "success"
      );
    } else {
      showStatus("Reset complete", "success");
    }
  } catch (error) {
    console.error("Reset error:", error);
    showStatus("Error during reset: " + error.message, "error");
  }
}

/**
 * Export configuration to JSON file
 */
function exportConfiguration() {
  const dataStr = JSON.stringify(config, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "calendar-auto-categories-config.json";
  a.click();
  
  URL.revokeObjectURL(url);
  showStatus("Configuration exported", "success");
}

/**
 * Import configuration from JSON file
 */
function importConfiguration(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      
      // Validate structure
      if (typeof imported.categories !== "object") {
        throw new Error("Invalid config: missing categories");
      }
      
      config = { ...DEFAULT_CONFIG, ...imported };
      renderCategories();
      renderSettings();
      showStatus("Configuration imported. Click Save to apply.", "success");
      
    } catch (error) {
      showStatus("Error importing: " + error.message, "error");
    }
  };
  
  reader.readAsText(file);
}

/**
 * Show status message
 */
function showStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.className = "status " + type;
  
  if (type === "success" || type === "info") {
    setTimeout(() => {
      elements.status.className = "status";
    }, 5000);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners
elements.addCategory.addEventListener("click", addCategory);

elements.newKeyword.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addCategory();
  }
});

elements.save.addEventListener("click", () => {
  updateSettings();
  saveConfig();
});

elements.scanNow.addEventListener("click", () => scanNow(false));

elements.forceScan.addEventListener("click", () => scanNow(true));

elements.resetCategories.addEventListener("click", resetCategories);

elements.exportConfig.addEventListener("click", exportConfiguration);

elements.importConfig.addEventListener("click", () => {
  elements.importFile.click();
});

elements.importFile.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    importConfiguration(e.target.files[0]);
  }
});

// Initialize
loadConfig();
