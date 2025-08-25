// -------- Unit Conversion System --------
const UnitConverter = {
  // Conversion factors to base units (HP for power, lb-ft for torque, MPH for speed)
  power: {
    'HP': 1.0,
    'BHP': 1.0, // BHP ≈ HP
    'PS': 1.0 / 0.98592, // 1 PS = 0.98592 HP
    'kW': 1.0 / 0.746  // 1 HP = 0.746 kW
  },
  torque: {
    'lb-ft': 1.0,
    'Nm': 1.0 / 1.356, // 1 lb-ft = 1.356 N⋅m
    'kgfm': 1.0 / 9.807 // 1 kgf⋅m = 9.807 N⋅m
  },
  speed: {
    'MPH': 1.0,
    'kmh': 1.0 / 1.609 // 1 MPH = 1.609 km/h
  },
  distance: {
    'ft': 1.0,
    'm': 1.0 / 3.28084 // 1 ft = 0.3048 m
  },
  weight: {
    'lb': 1.0,
    'kg': 1.0 / 2.20462 // 1 lb = 0.453592 kg
  },
  
  // Convert from base unit to target unit
  convertPower: function(value, targetUnit) {
    return value / this.power[targetUnit];
  },
  
  convertTorque: function(value, targetUnit) {
    return value / this.torque[targetUnit];
  },
  
  convertSpeed: function(value, targetUnit) {
    return value / this.speed[targetUnit];
  },
  
  convertDistance: function(value, targetUnit) {
    return value / this.distance[targetUnit];
  },
  
  convertWeight: function(value, targetUnit) {
    return value * this.weight[targetUnit];
  },
  
  // Format values with appropriate precision and unit symbol
  formatPower: function(value, unit) {
    const converted = this.convertPower(value, unit);
    return `${converted.toFixed(1)} ${unit}`;
  },
  
  formatTorque: function(value, unit) {
    const converted = this.convertTorque(value, unit);
    return `${converted.toFixed(1)} ${unit}`;
  },
  
  formatSpeed: function(value, unit) {
    const converted = this.convertSpeed(value, unit);
    return `${converted.toFixed(1)} ${unit}`;
  },
  
  formatDistance: function(value, unit) {
    const converted = this.convertDistance(value, unit);
    return `${converted.toFixed(0)} ${unit}`;
  },
  
  formatWeight: function(value, unit) {
    const converted = this.convertWeight(value, unit);
    return `${converted.toFixed(0)} ${unit}`;
  },
  
  // Get proper unit labels for axes
  getPowerLabel: function(unit) {
    const labels = {
      'HP': 'Horsepower (HP)',
      'BHP': 'Brake Horsepower (BHP)', 
      'PS': 'Pferdestärke (PS)',
      'kW': 'Kilowatts (kW)'
    };
    return labels[unit] || 'Power';
  },
  
  getTorqueLabel: function(unit) {
    const labels = {
      'lb-ft': 'Torque (lb-ft)',
      'Nm': 'Torque (N⋅m)',
      'kgfm': 'Torque (kgf⋅m)'
    };
    return labels[unit] || 'Torque';
  },
  
  getSpeedLabel: function(unit) {
    const labels = {
      'MPH': 'Speed (MPH)',
      'kmh': 'Speed (km/h)'
    };
    return labels[unit] || 'Speed';
  },
  
  getDistanceLabel: function(unit) {
    const labels = {
      'ft': 'Distance (ft)',
      'm': 'Distance (m)'
    };
    return labels[unit] || 'Distance';
  },
  
  // Get the appropriate distance unit based on speed unit
  getDistanceUnit: function(speedUnit) {
    return speedUnit === 'kmh' ? 'm' : 'ft';
  },
  
  getWeightLabel: function(unit) {
    const labels = {
      'lb': 'Weight (lb)',
      'kg': 'Weight (kg)'
    };
    return labels[unit] || 'Weight';
  },
  
  // Get the appropriate weight unit based on speed unit
  getWeightUnit: function(speedUnit) {
    return speedUnit === 'kmh' ? 'kg' : 'lb';
  }
};

// -------- User Preferences --------
let userPreferences = {
  power: 'HP',
  torque: 'lb-ft',
  speed: 'MPH'
};

// Track the base weight in pounds to avoid conversion errors
let baseWeightLb = 580;

// Load preferences from localStorage
function loadUnitPreferences() {
  try {
    const saved = localStorage.getItem('dynoChartUnitPrefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      userPreferences = { ...userPreferences, ...prefs };
    }
  } catch (e) {
    console.warn('Failed to load unit preferences:', e);
  }
  
  // Update UI selectors
  document.getElementById('powerUnit').value = userPreferences.power;
  document.getElementById('torqueUnit').value = userPreferences.torque;
  document.getElementById('speedUnit').value = userPreferences.speed;
  
  // Update weight control to match speed units
  updateWeightControl();
}

// Save preferences to localStorage
function saveUnitPreferences() {
  try {
    localStorage.setItem('dynoChartUnitPrefs', JSON.stringify(userPreferences));
  } catch (e) {
    console.warn('Failed to save unit preferences:', e);
  }
}

// Update preferences from UI
function updateUnitPreferences() {
  userPreferences.power = document.getElementById('powerUnit').value;
  userPreferences.torque = document.getElementById('torqueUnit').value;
  userPreferences.speed = document.getElementById('speedUnit').value;
  
  saveUnitPreferences();
  updateWeightControl(); // Update weight control units
  plotTorque(false); // Re-render with new units
}

// Update weight control based on speed unit preference
function updateWeightControl() {
  const newWeightUnit = UnitConverter.getWeightUnit(userPreferences.speed);
  const oldWeightUnit = UnitConverter.getWeightUnit(userPreferences.speed === 'kmh' ? 'MPH' : 'kmh'); // Get opposite unit
  const weightLabel = document.getElementById('weightLbLabel');
  const weightInput = document.getElementById('weightLb');
  
  if (weightLabel && weightInput) {
    // Only update if the unit actually changed
    const currentLabel = weightLabel.textContent;
    const expectedLabel = UnitConverter.getWeightLabel(newWeightUnit) + ':';
    
    if (currentLabel !== expectedLabel) {
      // Convert from base weight in pounds
      const convertedValue = UnitConverter.convertWeight(baseWeightLb, newWeightUnit);
      
      // Update label and value
      weightLabel.textContent = expectedLabel;
      weightInput.value = Math.round(convertedValue);
    }
  }
}

// Reset to defaults
function resetUnitsToDefault() {
  userPreferences = {
    power: 'HP',
    torque: 'lb-ft',
    speed: 'MPH'
  };
  
  document.getElementById('powerUnit').value = userPreferences.power;
  document.getElementById('torqueUnit').value = userPreferences.torque;
  document.getElementById('speedUnit').value = userPreferences.speed;
  
  // Reset weight to default 580 lb equivalent in preferred units
  baseWeightLb = 580;
  const weightUnit = UnitConverter.getWeightUnit(userPreferences.speed);
  const weightInput = document.getElementById('weightLb');
  const weightLabel = document.getElementById('weightLbLabel');
  
  if (weightInput && weightLabel) {
    const convertedWeight = UnitConverter.convertWeight(baseWeightLb, weightUnit);
    weightInput.value = Math.round(convertedWeight);
    weightLabel.textContent = UnitConverter.getWeightLabel(weightUnit) + ':';
  }
  
  saveUnitPreferences();
  plotTorque(false);
}

// Settings panel functions
function openSettings() {
  document.getElementById('settingsPanel').style.display = 'block';
}

function closeSettings(event) {
  if (!event || event.target.id === 'settingsPanel' || event.target.classList.contains('settings-close')) {
    document.getElementById('settingsPanel').style.display = 'none';
  }
}