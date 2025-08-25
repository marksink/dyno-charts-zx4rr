// -------- UI Controls and Event Handlers --------

// Helper function to get current shift RPM setting
function getCurrentShiftRpmSetting() {
  const hiddenSelect = document.getElementById('shiftRpmSelect');
  if (!hiddenSelect) return 'optimal';
  
  const value = hiddenSelect.value;
  
  // If it's a number, return it as-is (custom RPM)
  if (value && !isNaN(parseFloat(value)) && value !== 'optimal' && value !== 'custom') {
    return parseFloat(value);
  }
  
  // Otherwise return 'optimal'
  return 'optimal';
}

// Populate dropdowns with bike data
function populateHpDropdown() {
  const sel = document.getElementById('hpData');
  sel.innerHTML = '';
  const keys = Object.keys(hp_data_sets);
  keys.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = k; sel.appendChild(opt);
  });
  if (keys.includes('Stock')) sel.value = 'Stock'; else if (keys.length) sel.value = keys[0];
}

function populateShiftRpmDropdown() {
  const sel = document.getElementById('shiftRpmSelect');
  sel.innerHTML = '';
  
  // Add 'Optimal' as first option
  const optimalOpt = document.createElement('option');
  optimalOpt.value = 'optimal'; optimalOpt.textContent = 'Optimal'; sel.appendChild(optimalOpt);
  
  // Add 'Custom' option
  const customOpt = document.createElement('option');
  customOpt.value = 'custom'; customOpt.textContent = 'Custom'; sel.appendChild(customOpt);
  
  // Set default to 'Optimal'
  sel.value = 'optimal';
  
  // Make sure display shows 'Optimal'
  const displayText = document.getElementById('shiftRpmDisplayText');
  if (displayText) {
    displayText.textContent = 'Optimal';
  }
}

// Custom shift RPM dropdown functions
function toggleShiftRpmDropdown() {
  const options = document.getElementById('shiftRpmOptions');
  const arrow = document.querySelector('.dropdown-arrow');
  const isVisible = options.style.display !== 'none';
  
  if (isVisible) {
    options.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  } else {
    options.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
    // Focus the input if it exists
    const customInput = document.getElementById('customShiftRpm');
    if (customInput) {
      setTimeout(() => customInput.focus(), 100);
    }
  }
}

function selectShiftRpm(value) {
  const displayText = document.getElementById('shiftRpmDisplayText');
  const hiddenSelect = document.getElementById('shiftRpmSelect');
  const options = document.getElementById('shiftRpmOptions');
  const arrow = document.querySelector('.dropdown-arrow');
  
  if (value === 'optimal') {
    displayText.textContent = 'Optimal';
    hiddenSelect.value = 'optimal';
  }
  
  // Close dropdown
  options.style.display = 'none';
  arrow.style.transform = 'rotate(0deg)';
  
  // Trigger plot update
  plotTorque(true);
}

function handleCustomRpmKeypress(event) {
  if (event.key === 'Enter') {
    const input = event.target;
    const value = parseInt(input.value);
    
    if (value && value >= 3400 && value <= 16000) {
      const displayText = document.getElementById('shiftRpmDisplayText');
      const hiddenSelect = document.getElementById('shiftRpmSelect');
      const options = document.getElementById('shiftRpmOptions');
      const arrow = document.querySelector('.dropdown-arrow');
      
      // Add the custom RPM as an option to the hidden select
      const existingCustom = hiddenSelect.querySelector(`option[value="${value}"]`);
      if (!existingCustom) {
        const customOption = document.createElement('option');
        customOption.value = value;
        customOption.textContent = `${value} RPM`;
        hiddenSelect.appendChild(customOption);
      }
      
      displayText.textContent = `${value} RPM`;
      hiddenSelect.value = value;
      
      // Close dropdown
      options.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
      
      // Clear the input for next time
      input.value = '';
      
      // Trigger plot update
      plotTorque(true);
    } else {
      alert('Please enter an RPM value between 3400 and 16000');
    }
  }
}

function handleCustomRpmBlur() {
  // Close dropdown when input loses focus
  setTimeout(() => {
    const options = document.getElementById('shiftRpmOptions');
    const arrow = document.querySelector('.dropdown-arrow');
    options.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }, 200);
}

function handleShiftRpmChange() {
  // This function handles the hidden select changes
  plotTorque(true);
}

// Freeze/Compare functionality
function freezeCurrentTraces() {
  // Store current configuration instead of generating traces
  const bikeId = document.getElementById('bikeSelect').value;
  const front = parseInt(document.getElementById('front').value);
  const rear = parseInt(document.getElementById('rear').value);
  const hpKey = document.getElementById('hpData').value;
  const weightLb = getMassLb();
  const shiftMs = getShiftMs();
  const shiftRpmSetting = getCurrentShiftRpmSetting();
  
  // Add configuration to frozen configurations array including bike ID
  frozenConfigurations.push({ bikeId, front, rear, hpKey, weightLb, shiftMs, shiftRpmSetting });
  freezeCount++;
  
  // Regenerate all frozen traces for current view
  regenerateFrozenTraces();
  
  const notif = document.getElementById('freezeNotification');
  notif.style.display = 'block'; 
  setTimeout(() => { notif.style.display='none'; }, 2000);
  plotTorque(false); // Redraw the plot after freezing traces
}

function clearFrozenTraces() {
  // Reset to bike-specific defaults
  const specs = currentBikeData?.specifications;
  if (specs) {
    document.getElementById("front").value = specs.sprockets.front;
    document.getElementById("rear").value = specs.sprockets.rear;
  } else {
    // Fallback to hardcoded defaults if no bike data
    document.getElementById("front").value = "14";
    document.getElementById("rear").value = "48";
  }
  document.getElementById("hpData").value = "Stock";
  document.getElementById("shiftRpmSelect").value = "optimal";
  document.getElementById("shiftRpmDisplayText").textContent = "Optimal";
  document.getElementById("truncateCross").checked = false;
  frozenConfigurations = []; 
  frozenTraces = []; 
  freezeCount = 0; 
  frozenConnectorTraces = [];
  plotTorque();
}

// Global event handlers
document.addEventListener('DOMContentLoaded', function() {
  // Close dropdown when clicking outside
  document.addEventListener('click', function(event) {
    const dropdown = document.querySelector('.custom-shift-dropdown');
    const options = document.getElementById('shiftRpmOptions');
    const arrow = document.querySelector('.dropdown-arrow');
    
    if (dropdown && !dropdown.contains(event.target)) {
      if (options) options.style.display = 'none';
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
  });
});