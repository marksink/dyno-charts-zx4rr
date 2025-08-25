// -------- Physics and Math Calculations --------

// Physical constants
const rho_air = 1.225;
const g_mps2 = 9.80665;
const LB_TO_KG = 0.45359237;
const LBF_FT_TO_NM = 1.3558179483;
const IN_TO_M = 0.0254;
const MPH_TO_MPS = 0.44704;
const MPS_TO_MPH = 2.236936;
const M_TO_FT = 3.28084;

// Vertical label placement for Accel compare markers
const ACCEL_LABEL_BASE = 0.97;
const ACCEL_LABEL_STEP = 0.03;
const ACCEL_SPEED_YMAX = 150;  // mph axis cap for accel_ts

// Fixed axis bounds calculated when bike data loads
let FIXED_AXIS_BOUNDS = null;

// Calculate wheel radius from tire circumference
function getWheelRadius() {
  return (tire_circ_in * IN_TO_M) / (2 * Math.PI);
}

// Utility functions for weight and shift time inputs
function getMassLb() {
  const el = document.getElementById('weightLb');
  const v = el ? parseFloat(el.value) : 580;
  const weightUnit = UnitConverter.getWeightUnit(userPreferences.speed);
  
  if (Number.isFinite(v) && v > 0) {
    // Update base weight when user changes input
    baseWeightLb = weightUnit === 'kg' ? v * 2.20462 : v;
    return baseWeightLb;
  }
  return 580; // Default in lb
}

function getShiftMs() {
  const el = document.getElementById('shiftMs');
  const v = el ? parseFloat(el.value) : 80;
  return Number.isFinite(v) && v >= 0 ? v : 80;
}

// Speed and RPM conversion functions
function speedToRpm(speed_mph, gear_ratio, final_drive) {
  return speed_mph * (primary_drive * gear_ratio * final_drive * 1056) / tire_circ_in;
}

function rpmToSpeed(rpm, gear_ratio, final_drive) {
  return rpm * tire_circ_in / (primary_drive * gear_ratio * final_drive * 1056);
}

function hpToWheelTorqueAt(rpmArr, hpArr, gear_ratio, final_drive) {
  const overall = primary_drive * gear_ratio * final_drive;
  return rpmArr.map((rpm, i) => (hpArr[i] * 5252 / rpm) * overall);
}

// Linear interpolation functions
function lerp(x1, y1, x2, y2, y) { 
  return x1 + (y - y1) * (x2 - x1) / (y2 - y1); 
}

function interp1(xArr, yArr, x) {
  if (x <= xArr[0]) return yArr[0];
  if (x >= xArr[xArr.length - 1]) return yArr[yArr.length - 1];
  let lo = 0, hi = xArr.length - 1;
  while (hi - lo > 1) { 
    const mid = (lo + hi) >> 1; 
    if (xArr[mid] <= x) lo = mid; 
    else hi = mid; 
  }
  const x1 = xArr[lo], x2 = xArr[hi], y1 = yArr[lo], y2 = yArr[hi];
  return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
}

// Shift points calculation - with optional shift RPM override
function computeShiftPoints(hpArr, final_drive, rpmArr, shiftRpmOverride = null) {
  const wt = {}, spd = {};
  for (let g = 1; g <= 6; g++) {
    wt[g]  = hpToWheelTorqueAt(rpmArr, hpArr, gear_ratios[g], final_drive);
    spd[g] = rpmArr.map(rpm => rpmToSpeed(rpm, gear_ratios[g], final_drive));
  }
  
  const shiftRpmSetting = shiftRpmOverride !== null ? shiftRpmOverride : getCurrentShiftRpmSetting();
  const shift_rpm = {}, shift_speed = {};
  
  for (let g = 1; g <= 5; g++) {
    let shiftRPM;
    
    if (shiftRpmSetting === 'optimal' || isNaN(shiftRpmSetting)) {
      // Original optimal shift point calculation
      const ratio  = gear_ratios[g + 1] / gear_ratios[g];
      const diff   = [];
      for (let i = 0; i < rpmArr.length; i++) {
        const rp    = rpmArr[i];
        const curTq = wt[g][i];
        const nxtTq = interp1(rpmArr, wt[g + 1], rp * ratio);
        diff.push(nxtTq - curTq);
      }
      let idx = diff.findIndex(d => d >= 0);
      if (idx === -1) shiftRPM = rpmArr[rpmArr.length - 1];
      else if (idx === 0) shiftRPM = rpmArr[0];
      else shiftRPM = lerp(rpmArr[idx - 1], diff[idx - 1], rpmArr[idx], diff[idx], 0);
    } else {
      // Use custom RPM value
      shiftRPM = parseFloat(shiftRpmSetting);
      // Clamp to valid RPM range
      shiftRPM = Math.max(rpmArr[0], Math.min(rpmArr[rpmArr.length - 1], shiftRPM));
    }
    
    // Ensure shift RPM is valid
    if (isNaN(shiftRPM)) {
      shiftRPM = rpmArr[rpmArr.length - 1]; // Fallback to max RPM
    }
    
    shift_rpm[g]   = shiftRPM;
    shift_speed[g] = rpmToSpeed(shiftRPM, gear_ratios[g], final_drive);
    
    // Ensure shift speed is valid
    if (isNaN(shift_speed[g])) {
      shift_speed[g] = rpmToSpeed(rpmArr[rpmArr.length - 1], gear_ratios[g], final_drive);
    }
  }
  return { wt, spd, shift_rpm, shift_speed };
}

// Acceleration simulation with trapezoidal distance and shift time
function simulateAccel(hpArr, rpmArr, final_drive, dt = 0.02, mass_lb_param = getMassLb(), shift_ms = getShiftMs(), shiftRpmOverride = null) {
  const wheel_radius_m = getWheelRadius();
  
  function wheelTorqueAtSpeed(speed_mps, gear) {
    const speed_mph = speed_mps * MPS_TO_MPH;
    const rpm = Math.max(rpmArr[0], Math.min(rpmArr[rpmArr.length - 1], speedToRpm(speed_mph, gear_ratios[gear], final_drive)));
    const hp = interp1(rpmArr, hpArr, rpm);
    const tq_lbft = (hp * 5252) / rpm;
    const overall = primary_drive * gear_ratios[gear] * final_drive;
    const tq_wheel_Nm = tq_lbft * overall * LBF_FT_TO_NM;
    return tq_wheel_Nm / wheel_radius_m;
  }

  const mass_kg = mass_lb_param * LB_TO_KG;
  const max_rpm = rpmArr[rpmArr.length - 1];
  const { shift_speed } = computeShiftPoints(hpArr, final_drive, rpmArr, shiftRpmOverride);

  let g = 1, t = 0, v = 0, s = 0;
  let shiftCooldown = 0, pendingGear = null;
  const cooldownSteps = Math.max(0, Math.round((shift_ms / 1000) / dt));

  const T = [0], V = [0], A = [0], S = [0], G = [g], shiftMarkers = [];

  for (let step = 0; step < 20000; step++) {
    if (shiftCooldown === 0 && pendingGear === null && g <= 5) {
      const v_shift_mph = shift_speed[g];
      if (v_shift_mph !== undefined && v * MPS_TO_MPH >= v_shift_mph) {
        shiftMarkers.push({ t, v_mph: v * MPS_TO_MPH, gear: g });
        pendingGear = g + 1;
        shiftCooldown = cooldownSteps;
      }
    }

    let F_trac;
    if (shiftCooldown > 0) {
      F_trac = 0;
      shiftCooldown -= 1;
      if (shiftCooldown === 0 && pendingGear !== null) {
        g = pendingGear;
        pendingGear = null;
      }
    } else {
      F_trac = wheelTorqueAtSpeed(v, g);
    }

    const rpm_now = speedToRpm(v * MPS_TO_MPH, gear_ratios[g], final_drive);
    // Only terminate at redline if we've reached at least 35 seconds
    if (t >= 35 && g === 6 && rpm_now >= max_rpm) break;

    const F_roll = Crr * mass_kg * g_mps2;
    const F_aero = 0.5 * rho_air * CdA * v * v;
    const F_net = Math.max(0, F_trac - F_roll - F_aero);
    const a = F_net / mass_kg;

    // Trapezoid integration for distance over this step
    s += v * dt + 0.5 * a * dt * dt;
    v += a * dt;
    t += dt;

    T.push(t);
    V.push(v * MPS_TO_MPH);
    A.push(a);
    S.push(s * M_TO_FT);
    G.push(g);

    // Only allow early termination if we've reached at least 35 seconds
    if (t >= 35 && a < 0.01 && v > 60 * MPH_TO_MPS) {
      if (T.length > 200 && Math.abs(V[V.length - 1] - V[V.length - 200]) < 0.1) break;
    }
  }
  return { T, V, A, S, G, shiftMarkers };
}

// Calculate axis bounds for all chart types
function calculateAxisBounds() {
  if (!hp_data_sets || !gear_ratios) return;
  
  // Find max HP across all datasets
  let maxHpValue = 0;
  let maxHpDataset = null;
  Object.entries(hp_data_sets).forEach(([key, data]) => {
    data.forEach(([rpm, hp]) => {
      if (hp > maxHpValue) {
        maxHpValue = hp;
        maxHpDataset = key;
      }
    });
  });
  
  // Use extreme sprocket combination (smallest front, largest rear) for accel sim
  const minFront = 12, maxRear = 53;
  const extremeFinalDrive = maxRear / minFront;
  
  // Use sprocket combination for wheel torque bounds that gives ~800 ft-lbs (13/50)
  const wheelTorqueFinalDrive = 50 / 13;
  
  // Get the max HP dataset
  const maxHpData = hp_data_sets[maxHpDataset];
  const rpmArrRaw = maxHpData.map(([r, hp]) => r);
  const hpArrRaw = maxHpData.map(([r, hp]) => hp);
  
  let maxWheelSpeed = 0, maxWheelTorque = 0, maxDynoHP = 0, maxDynoTorque = 0;
  
  // Calculate bounds for wheel torque graph using sprocket combo for ~800 ft-lbs
  for (const gear of Object.values(gear_ratios)) {
    for (let i = 0; i < rpmArrRaw.length; i++) {
      const rpm = rpmArrRaw[i], hp = hpArrRaw[i];
      const speed = rpmToSpeed(rpm, gear, wheelTorqueFinalDrive);
      const wheelTq = (hp * 5252 / rpm) * (primary_drive * gear * wheelTorqueFinalDrive);
      const engineTq = (hp * 5252) / rpm;
      
      if (speed > maxWheelSpeed) maxWheelSpeed = speed;
      if (wheelTq > maxWheelTorque) maxWheelTorque = wheelTq;
      if (hp > maxDynoHP) maxDynoHP = hp;
      if (engineTq > maxDynoTorque) maxDynoTorque = engineTq;
    }
  }
  
  // Calculate accel bounds using worst case scenario (max weight, max HP)
  const maxWeightLb = 1000; // Max from weight input
  const maxShiftTime = 300; // Max from shift time input
  const rpmDenseMax = rpmDense;
  const hpDenseMax = hpDenseSets[maxHpDataset];
  
  // Run accel sim with extreme parameters
  const accelSim = simulateAccel(hpDenseMax, rpmDenseMax, extremeFinalDrive, 0.02, maxWeightLb, maxShiftTime);
  const maxAccelTime = Math.max(...accelSim.T);
  const maxAccelSpeed = Math.max(...accelSim.V);
  const maxAccelDistance = Math.max(...accelSim.S);
  const maxAccelG = Math.max(...accelSim.A) / g_mps2;
  
  // Use full simulation distance to ensure Y-axis shows all data beyond 35 seconds
  const effectiveMaxDistance = maxAccelDistance;
  
  FIXED_AXIS_BOUNDS = {
    // Convert to user units on demand
    wheel: {
      maxSpeed: Math.max(160, Math.ceil(maxWheelSpeed * 1.1 / 10) * 10), // At least 160 MPH for speed axis
      maxTorque: Math.ceil(maxWheelTorque * 1.05 / 100) * 100 // Reduced margin from 10% to 5%
    },
    dyno: {
      maxHP: Math.ceil(maxDynoHP * 1.1 / 10) * 10,
      maxTorque: Math.ceil(maxDynoTorque * 1.1 / 10) * 10,
      minRPM: rpmArrRaw[0],
      maxRPM: rpmArrRaw[rpmArrRaw.length - 1]
    },
    accel: {
      maxTime: Math.max(35, Math.ceil(maxAccelTime * 1.1)), // At least 35 seconds
      maxSpeed: Math.max(160, Math.ceil(maxAccelSpeed * 1.1 / 10) * 10), // At least 160 MPH
      maxDistance: Math.ceil(effectiveMaxDistance * 2.0 / 100) * 100, // Use full distance with 100% extra margin to ensure visibility at 35s
      maxG: 1.0 // Always 1G max for G-force charts
    }
  };
}

// Legacy function for compatibility
function getPlotBounds() {
  // Legacy function - bounds are now pre-calculated in FIXED_AXIS_BOUNDS
  if (FIXED_AXIS_BOUNDS && FIXED_AXIS_BOUNDS.wheel) {
    maxX = FIXED_AXIS_BOUNDS.wheel.maxSpeed;
    maxY = FIXED_AXIS_BOUNDS.wheel.maxTorque;
  }
}