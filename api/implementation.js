/**
 * Calendar Auto Categories - Experiment API Implementation
 * 
 * Uses getItemsAsArray() API (Thunderbird 96+) for simple array-based access.
 * Includes CSS injection for full-width category colors.
 */

"use strict";

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);

var { cal } = ChromeUtils.importESModule(
  "resource:///modules/calendar/calUtils.sys.mjs"
);

// CSS for full-width category colors
const CALENDAR_STYLES = `
/* Calendar Auto Categories - Full-width category colors */
.calendar-category-box {
  margin: 0 0 0 -400px !important;
  min-width: 400px !important;
  opacity: 0.75 !important;
}
.event-name-label,
.item-time-label,
.alarm-icons-box,
.reminder-icon {
  z-index: 100000 !important;
}
.calendar-item-flex {
  padding: 0 !important;
}
.calendar-month-day-box-list-item {
  margin: 0 !important;
}
.calendar-color-box {
  border: none !important;
}
.event-name-label {
  white-space: break-spaces !important;
}
`;

const STYLE_ID = "calendar-auto-categories-styles";

/**
 * Encode category name for use in pref key
 * Thunderbird encodes special characters as -uxXX- where XX is the hex unicode
 */
function encodeCategoryName(name) {
  let encoded = name.toLowerCase();
  let result = "";
  
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const code = char.charCodeAt(0);
    
    // ASCII letters, numbers, and some safe chars don't need encoding
    if ((code >= 0x61 && code <= 0x7a) || // a-z
        (code >= 0x30 && code <= 0x39) || // 0-9
        char === ' ' || char === '-' || char === '_') {
      result += char;
    } else {
      // Encode as -uxXX- format
      result += `-ux${code.toString(16)}-`;
    }
  }
  
  return result;
}

// Statistics for the last run
let lastStats = {
  processed: 0,
  modified: 0,
  lastRun: null,
  details: []
};

/**
 * Inject CSS into a document
 */
function injectStylesIntoDocument(doc, enabled) {
  if (!doc || !doc.documentElement) return false;
  
  try {
    // Remove existing styles first
    const existing = doc.getElementById(STYLE_ID);
    if (existing) {
      existing.remove();
    }
    
    // Add new styles if enabled
    if (enabled) {
      const style = doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CALENDAR_STYLES;
      doc.documentElement.appendChild(style);
      return true;
    }
  } catch (e) {
    console.error("Calendar Auto Categories: Error injecting styles:", e);
  }
  return false;
}

/**
 * Inject styles into all open windows
 */
function injectStylesIntoAllWindows(enabled) {
  let count = 0;
  const windowEnumerator = Services.wm.getEnumerator(null);
  
  while (windowEnumerator.hasMoreElements()) {
    const win = windowEnumerator.getNext();
    
    try {
      // Inject into main document
      if (injectStylesIntoDocument(win.document, enabled)) {
        count++;
      }
      
      // Also try to inject into any iframes/browsers (calendar might be in one)
      try {
        const frames = win.document.querySelectorAll("browser, iframe, xul\\:browser");
        for (const frame of frames) {
          try {
            if (frame.contentDocument) {
              if (injectStylesIntoDocument(frame.contentDocument, enabled)) {
                count++;
              }
            }
          } catch (frameErr) {
            // Cross-origin or not accessible - ignore
          }
        }
      } catch (e) {
        // querySelectorAll might fail
      }
    } catch (e) {
      console.error("Calendar Auto Categories: Error with window:", e);
    }
  }
  
  return count;
}

/**
 * Remove styles from all windows on shutdown
 */
function removeStylesFromAllWindows() {
  const windowEnumerator = Services.wm.getEnumerator(null);
  
  while (windowEnumerator.hasMoreElements()) {
    const win = windowEnumerator.getNext();
    try {
      const style = win.document.getElementById(STYLE_ID);
      if (style) {
        style.remove();
      }
    } catch (e) {
      // Window might be closing
    }
  }
}

var calendarCategories = class extends ExtensionCommon.ExtensionAPI {
  
  onStartup() {
    console.log("Calendar Auto Categories: Add-on started");
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown) return;
    
    // Remove injected styles
    removeStylesFromAllWindows();
    
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }

  getAPI(context) {
    return {
      calendarCategories: {
        
        /**
         * Ensures categories exist with specified colors
         * Also registers them in the category names list
         */
        async ensureCategories(categoryColors) {
          console.log("Calendar Auto Categories: Ensuring categories exist...");
          
          let created = 0;
          let existing = 0;
          
          // First, get the current category names list
          let categoryNames = [];
          try {
            const namesStr = Services.prefs.getStringPref("calendar.categories.names");
            if (namesStr) {
              categoryNames = namesStr.split(",").map(s => s.trim()).filter(s => s);
            }
          } catch (e) {
            // Pref doesn't exist yet
            console.log("  No existing category names list");
          }
          
          let namesChanged = false;
          
          for (const [name, color] of Object.entries(categoryColors)) {
            // Color pref uses encoded lowercase name!
            const encodedName = encodeCategoryName(name);
            const colorPrefKey = `calendar.category.color.${encodedName}`;
            
            // Check current color (if any)
            let currentColor = null;
            try {
              currentColor = Services.prefs.getStringPref(colorPrefKey);
            } catch (e) {
              // Doesn't exist
            }
            
            // Check if name is in the list (keep original case for display)
            const nameInList = categoryNames.includes(name);
            
            const colorMatches = currentColor === color;
            
            if (colorMatches && nameInList) {
              existing++;
              console.log(`  Category exists: ${name} (${encodedName})`);
            } else {
              // Set/update color if different or missing
              if (!colorMatches) {
                Services.prefs.setStringPref(colorPrefKey, color);
                if (currentColor) {
                  console.log(`  Color updated: ${encodedName} = ${color} (was ${currentColor})`);
                } else {
                  console.log(`  Color set: ${encodedName} = ${color}`);
                }
              }
              
              // Add to names list if missing (keep original case)
              if (!nameInList) {
                categoryNames.push(name);
                namesChanged = true;
                console.log(`  Added to names list: ${name}`);
              }
              
              created++;
              console.log(`  Category created/updated: ${name} → ${encodedName}`);
            }
          }
          
          // Save updated names list
          if (namesChanged) {
            const newNamesStr = categoryNames.join(",");
            Services.prefs.setStringPref("calendar.categories.names", newNamesStr);
            console.log(`  Updated category names list`);
          }
          
          console.log(`Calendar Auto Categories: ${created} created, ${existing} already existed`);
          
          return { created, existing, total: Object.keys(categoryColors).length };
        },
        
        /**
         * Inject or remove calendar styles
         */
        async injectCalendarStyles(enabled) {
          console.log(`Calendar Auto Categories: ${enabled ? 'Injecting' : 'Removing'} calendar styles...`);
          
          const count = injectStylesIntoAllWindows(enabled);
          console.log(`Calendar Auto Categories: Styles ${enabled ? 'injected into' : 'removed from'} ${count} document(s)`);
          
          return { success: true, enabled, count };
        },
        
        /**
         * Scans calendar events and applies categories based on rules
         */
        async applyCategories(rules, daysBack = 1, daysForward = 90, force = false) {
          console.log("Calendar Auto Categories: Starting scan...");
          console.log(`  Rules: ${rules.length}`);
          console.log(`  Time range: -${daysBack} to +${daysForward} days`);
          console.log(`  Force mode: ${force}`);
          
          lastStats = {
            processed: 0,
            modified: 0,
            lastRun: new Date().toISOString(),
            details: []
          };
          
          try {
            const calManager = Cc["@mozilla.org/calendar/manager;1"]
              .getService(Ci.calICalendarManager);
            
            const calendars = calManager.getCalendars();
            console.log(`  Found ${calendars.length} calendar(s)`);
            
            // Calculate time range
            const now = new Date();
            
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - daysBack);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + daysForward);
            endDate.setHours(23, 59, 59, 999);
            
            const start = cal.createDateTime();
            start.nativeTime = startDate.getTime() * 1000; // Microseconds
            
            const end = cal.createDateTime();
            end.nativeTime = endDate.getTime() * 1000; // Microseconds
            
            console.log(`  Range: ${start} to ${end}`);
            
            for (const calendar of calendars) {
              if (calendar.readOnly) {
                console.log(`  Skipping read-only: ${calendar.name}`);
                continue;
              }
              
              console.log(`  Calendar: ${calendar.name}`);
              
              try {
                // Use getItemsAsArray - simple and works!
                const items = await calendar.getItemsAsArray(
                  Ci.calICalendar.ITEM_FILTER_TYPE_EVENT |
                  Ci.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES,
                  0, // no limit
                  start,
                  end
                );
                
                console.log(`    ${items.length} events found`);
                
                for (const item of items) {
                  lastStats.processed++;
                  
                  const title = item.title || "";
                  if (!title) continue;
                  
                  const titleLower = title.toLowerCase();
                  
                  for (const rule of rules) {
                    if (titleLower.includes(rule.keyword.toLowerCase())) {
                      const currentCategories = item.getCategories();
                      
                      // In force mode: always re-apply. Normal mode: skip if already set
                      if (force || !currentCategories.includes(rule.category)) {
                        console.log(`    "${title}" → ${rule.category}${force ? ' (forced)' : ''}`);
                        
                        const newItem = item.clone();
                        
                        // In force mode, replace all categories. Normal: add to existing
                        if (force) {
                          newItem.setCategories([rule.category]);
                        } else {
                          newItem.setCategories([...currentCategories, rule.category]);
                        }
                        
                        await calendar.modifyItem(newItem, item);
                        
                        lastStats.modified++;
                        lastStats.details.push({
                          title: title,
                          category: rule.category,
                          calendar: calendar.name
                        });
                      }
                      break; // First rule wins
                    }
                  }
                }
                
              } catch (calErr) {
                console.error(`  Error with calendar ${calendar.name}:`, calErr);
              }
            }
            
            console.log(`Calendar Auto Categories: Done. ${lastStats.processed} processed, ${lastStats.modified} modified.`);
            return lastStats;
            
          } catch (error) {
            console.error("Calendar Auto Categories Error:", error);
            throw error;
          }
        },
        
        async getStats() {
          return lastStats;
        },
        
        /**
         * Remove categories created by this add-on
         */
        async removeCategories(categoryNamesToRemove) {
          console.log("Calendar Auto Categories: Removing categories...");
          
          let removedColors = 0;
          let removedNames = 0;
          
          // Get current category names list
          let categoryNames = [];
          try {
            const namesStr = Services.prefs.getStringPref("calendar.categories.names");
            if (namesStr) {
              categoryNames = namesStr.split(",").map(s => s.trim()).filter(s => s);
            }
          } catch (e) {
            // Pref doesn't exist
          }
          
          for (const name of categoryNamesToRemove) {
            const encodedName = encodeCategoryName(name);
            const colorPrefKey = `calendar.category.color.${encodedName}`;
            
            // Remove color pref
            try {
              Services.prefs.clearUserPref(colorPrefKey);
              removedColors++;
              console.log(`  Removed color pref: ${colorPrefKey}`);
            } catch (e) {
              // Pref didn't exist or couldn't be removed
            }
            
            // Remove from names list
            const idx = categoryNames.indexOf(name);
            if (idx !== -1) {
              categoryNames.splice(idx, 1);
              removedNames++;
              console.log(`  Removed from names list: ${name}`);
            }
          }
          
          // Save updated names list
          if (removedNames > 0) {
            const newNamesStr = categoryNames.join(",");
            Services.prefs.setStringPref("calendar.categories.names", newNamesStr);
            console.log(`  Updated category names list`);
          }
          
          console.log(`Calendar Auto Categories: Removed ${removedColors} colors, ${removedNames} names`);
          
          return { removedColors, removedNames };
        }
      }
    };
  }
};
