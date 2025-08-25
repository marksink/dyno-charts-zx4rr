// -------- Main Application Initialization --------

// Main initialization function
async function init() { 
  loadUnitPreferences(); // Load saved preferences
  
  // Load bike data first
  const dataLoaded = await loadBikesData();
  
  if (dataLoaded) {
    // Initialize bikes if data loaded successfully
    const bikesLoaded = initializeBikes();
    if (!bikesLoaded) {
      console.error('Failed to initialize bikes, using defaults');
    }
  } else {
    console.error('Failed to load bike data, using hardcoded defaults');
    // Set fallback bike dropdown
    const bikeSelect = document.getElementById('bikeSelect');
    if (bikeSelect) {
      bikeSelect.innerHTML = '<option value="">No bikes available</option>';
    }
  }
  
  populateHpDropdown(); 
  populateShiftRpmDropdown(); 
  getPlotBounds(); 
  plotTorque(); 
  toggleControlVisibility(); 
  adjustLayout();
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Window resize handler
window.addEventListener('resize', () => {
  adjustLayout();
  setTimeout(() => plotTorque(false), 100); // Small delay to let layout settle
});