// -------- Bike Data Management --------

// Global variables for bike specifications (will be loaded from bike data files)
let primary_drive = 2.029;
let tire_circ_in = 77.15;
let gear_ratios = {1:2.92, 2:2.05, 3:1.62, 4:1.33, 5:1.15, 6:1.03};
let Crr = 0.015;
let CdA = 0.35;
let hp_data_sets = {};
let currentBikeData = null;

// Global bikes data
let BIKES_DATA = null;

// Constants for dense point calculation
const densePoints = 750;
let rpm_data_raw = [];
let rpmDense = [];
let hpDenseSets = {};

// Simple bike data loader
async function loadBikesData() {
  const response = await fetch('bikes-data.json');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  BIKES_DATA = await response.json();
  console.log('Bikes data loaded:', Object.keys(BIKES_DATA));
  return true;
}

// Initialize HP data for current bike
function initializeHPData(hp_data_sets) {
  rpm_data_raw = hp_data_sets[Object.keys(hp_data_sets)[0]].map(([r, _]) => r);
  const arr = [];
  const minR = rpm_data_raw[0];
  const maxR = rpm_data_raw[rpm_data_raw.length - 1];
  for (let i = 0; i <= densePoints; i++) arr.push(minR + (maxR - minR) * (i / densePoints));
  rpmDense = arr;
  
  hpDenseSets = {};
  for (const key in hp_data_sets) {
    const rpmArrRaw = hp_data_sets[key].map(([r, hp]) => r);
    const hpArrRaw = hp_data_sets[key].map(([r, hp]) => hp);
    hpDenseSets[key] = rpmDense.map(r => interp1(rpmArrRaw, hpArrRaw, r));
  }
}

// Helper function to create bike-specific data sets
function createBikeDataSets(bikeData) {
  const hp_data = bikeData.hp_data_sets;
  const rpm_raw = hp_data[Object.keys(hp_data)[0]].map(([r, _]) => r);
  
  const arr = [];
  const minR = rpm_raw[0];
  const maxR = rpm_raw[rpm_raw.length - 1];
  for (let i = 0; i <= densePoints; i++) arr.push(minR + (maxR - minR) * (i / densePoints));
  const rpmDense = arr;
  
  const hpDenseSets = {};
  for (const key in hp_data) {
    const rpmArrRaw = hp_data[key].map(([r, hp]) => r);
    const hpArrRaw = hp_data[key].map(([r, hp]) => hp);
    hpDenseSets[key] = rpmDense.map(r => interp1(rpmArrRaw, hpArrRaw, r));
  }
  
  return {
    rpmDense,
    hpDenseSets,
    hp_data_sets: hp_data,
    specifications: bikeData.specifications
  };
}

// Helper function to get bike-specific data by bike ID
function getBikeDataSets(bikeId) {
  if (!BIKES_DATA || !BIKES_DATA[bikeId]) {
    console.error(`Bike data not found for ID: ${bikeId}`);
    return null;
  }
  return createBikeDataSets(BIKES_DATA[bikeId]);
}

// Bike management functions
function initializeBikes() {
  if (!BIKES_DATA) {
    console.error('No bike data available');
    return false;
  }
  
  try {
    // Load default bike
    currentBikeData = BIKES_DATA['kawasaki-zx4rr'];
    
    // Update global variables with bike data
    loadBikeData();
    
    // Populate bike selection dropdown
    populateBikeDropdown();
    
    
    console.log('Bikes initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize bikes:', error);
    return false;
  }
}

function loadBikeData() {
  if (!currentBikeData) return;
  
  const specs = currentBikeData.specifications;
  
  // Load bike specifications into global variables
  primary_drive = specs.primary_drive;
  tire_circ_in = specs.tire_circ_in;
  gear_ratios = specs.gear_ratios;
  Crr = specs.Crr;
  CdA = specs.CdA;
  hp_data_sets = currentBikeData.hp_data_sets;
  
  // Initialize HP interpolation data
  initializeHPData(hp_data_sets);
  
  // Calculate axis bounds for plots
  calculateAxisBounds();
  
  // Update sprocket controls with bike-specific defaults
  const frontInput = document.getElementById('front');
  const rearInput = document.getElementById('rear');
  
  if (frontInput) {
    frontInput.value = specs.sprockets.front;
  }
  
  if (rearInput) {
    rearInput.value = specs.sprockets.rear;
  }
  
  // Update weight default
  const weightInput = document.getElementById('weightLb');
  if (weightInput) {
    weightInput.value = specs.default_weight_lb;
  }
}

function populateBikeDropdown() {
  const bikeSelect = document.getElementById('bikeSelect');
  if (!bikeSelect || !BIKES_DATA) return;
  
  bikeSelect.innerHTML = ''; // Clear existing options
  
  // Populate from bikes data
  Object.keys(BIKES_DATA).forEach(bikeId => {
    const bike = BIKES_DATA[bikeId];
    const option = document.createElement('option');
    option.value = bikeId;
    option.textContent = bike.name;
    option.selected = bikeId === 'kawasaki-zx4rr'; // Default selection
    bikeSelect.appendChild(option);
  });
}


function changeBike() {
  const bikeSelect = document.getElementById('bikeSelect');
  if (!bikeSelect || !bikeSelect.value || !BIKES_DATA) return;
  
  try {
    currentBikeData = BIKES_DATA[bikeSelect.value];
    if (!currentBikeData) {
      throw new Error(`Bike ${bikeSelect.value} not found`);
    }
    
    loadBikeData();
    
    // Refresh the UI
    populateHpDropdown();
    plotTorque(true);
    
    console.log('Switched to bike:', currentBikeData.name);
  } catch (error) {
    console.error('Failed to load bike:', error);
  }
}