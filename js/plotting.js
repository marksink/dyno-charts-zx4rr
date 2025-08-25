// -------- Chart Generation and Plotting Functions --------

// Chart display constants
const gear_colors = ['#FF0000', '#00FFFF', '#00FF00', '#FFFF00', '#F012BE', '#FFFFFF'];
const freezeDashStyles = ['dot', 'dash', 'longdash', 'dashdot', 'solid'];

// Global plotting state
let freezeCount = 0;
let frozenConfigurations = []; // Store configurations instead of traces
let frozenTraces = [];
let frozenConnectorTraces = [];
let previousTraces = [];
let maxX = 0, maxY = 0;
let lastFamily = null;

// Utility function to categorize view types
function viewFamily(v) { 
  return v === 'wheel' ? 'wheel' : (v === 'dyno' ? 'dyno' : (v.startsWith('accel') ? 'accel' : v)); 
}

// Control visibility based on view type
function toggleControlVisibility() {
  const view = document.getElementById('viewSelect').value;
  const accel = view.startsWith('accel');
  ['weightLbLabel','weightLb','shiftMsLabel','shiftMs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = accel ? 'inline-block' : 'none';
  });
  const clipEl = document.getElementById('clipControl');
  if (clipEl) clipEl.style.display = (view === 'wheel') ? 'inline-block' : 'none';
  
  // Adjust layout after visibility changes
  setTimeout(() => adjustLayout(), 50);
}

// Generate frozen traces from stored configurations for current view
function regenerateFrozenTraces() {
  frozenTraces = [];
  frozenConnectorTraces = [];
  
  const currentView = document.getElementById('viewSelect').value;
  const currentFamily = viewFamily(currentView);
  
  // Store current global bike variables so we can restore them later
  const originalGlobals = {
    primary_drive,
    tire_circ_in, 
    Crr,
    CdA,
    gear_ratios
  };
  
  frozenConfigurations.forEach((config, configIndex) => {
    const dashStyle = (currentFamily === 'wheel') ? freezeDashStyles[configIndex % freezeDashStyles.length] : 'solid';
    const { bikeId, front, rear, hpKey, weightLb, shiftMs, shiftRpmSetting } = config;
    
    // Get bike-specific data for this frozen configuration
    const bikeData = getBikeDataSets(bikeId);
    if (!bikeData) {
      console.error(`Cannot regenerate frozen trace: bike data not found for ${bikeId}`);
      return;
    }
    
    // Temporarily set global bike variables to this frozen config's bike data
    const bikeSpecs = bikeData.specifications;
    primary_drive = bikeSpecs.primary_drive;
    tire_circ_in = bikeSpecs.tire_circ_in;
    Crr = bikeSpecs.Crr;
    CdA = bikeSpecs.CdA;
    gear_ratios = bikeSpecs.gear_ratios;
    
    const fd = rear / front;
    const rpmArr = bikeData.rpmDense;
    const hpArr = bikeData.hpDenseSets[hpKey];
    
    // Add spacer for legend grouping
    frozenTraces.push({ x:[null], y:[null], mode:'lines', name:'\u00A0', showlegend:true, hoverinfo:'skip', line:{color:'rgba(0,0,0,0)', width:0} });
    
    if (currentFamily === 'dyno') {
      const hpArrRaw = bikeData.hp_data_sets[hpKey].map(([r, hp]) => hp);
      const rpmArrRaw = bikeData.hp_data_sets[hpKey].map(([r, hp]) => r);
      const engTq = bikeData.hp_data_sets[hpKey].map(([rpm, hp]) => (hp * 5252) / rpm);
      
      // Convert to user's preferred units
      const hpConverted = hpArrRaw.map(hp => UnitConverter.convertPower(hp, userPreferences.power));
      const tqConverted = engTq.map(tq => UnitConverter.convertTorque(tq, userPreferences.torque));
      
      const lineColor = gear_colors[configIndex % gear_colors.length];
      frozenTraces.push({ x:rpmArrRaw, y:tqConverted, mode:'lines', showlegend:false, hoverinfo:'x+y', hovertemplate:`RPM: %{x} RPM<br>Torque: %{y:.1f} ${userPreferences.torque}<extra></extra>`, line:{ color: lineColor, shape:'spline', width:2 }, opacity:0.7 });
      frozenTraces.push({ x:rpmArrRaw, y:hpConverted, mode:'lines', showlegend:false, hoverinfo:'x+y', hovertemplate:`RPM: %{x} RPM<br>Power: %{y:.1f} ${userPreferences.power}<extra></extra>`, line:{ color: lineColor, shape:'spline', width:2 }, opacity:0.7 });
      const maxHP = Math.max(...hpConverted), maxTQ = Math.max(...tqConverted);
      const bikeName = BIKES_DATA[bikeId]?.name || bikeId;
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:bikeName, showlegend:true, hoverinfo:'skip', line:{ color:lineColor, shape:'spline', width:3 } });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:hpKey, showlegend:true, hoverinfo:'skip', line:{ color:lineColor, shape:'spline', width:2 } });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:`Max ${userPreferences.power}: ${maxHP.toFixed(1)}`, showlegend:true, hoverinfo:'skip', line:{ color:lineColor, shape:'spline', width:2 } });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:`Max ${userPreferences.torque}: ${maxTQ.toFixed(1)}`, showlegend:true, hoverinfo:'skip', line:{ color:lineColor, shape:'spline', width:2 } });
    }
    else if (currentFamily === 'accel') {
      const sim = simulateAccel(hpArr, rpmArr, fd, 0.02, weightLb, shiftMs, shiftRpmSetting);
      let xData, yData, showShift = false;
      
      // Convert speed data to user's preferred units  
      const speedConverted = sim.V.map(mph => UnitConverter.convertSpeed(mph, userPreferences.speed));
      
      // Convert distance data based on speed unit preference
      const distanceUnit = UnitConverter.getDistanceUnit(userPreferences.speed);
      const distanceConverted = sim.S.map(ft => UnitConverter.convertDistance(ft, distanceUnit));
      
      if (currentView === 'accel_ts') { xData = sim.T; yData = speedConverted; showShift = true; }
      else if (currentView === 'accel_td') { xData = sim.T; yData = distanceConverted; }
      else if (currentView === 'accel_tg') { xData = sim.T; yData = sim.A.map(a=>a/g_mps2); }
      else if (currentView === 'accel_sg') { xData = speedConverted; yData = sim.A.map(a=>a/g_mps2); }
      else { xData = sim.T; yData = speedConverted; }
      
      const lineColor = gear_colors[configIndex % gear_colors.length];
      const weightUnit = UnitConverter.getWeightUnit(userPreferences.speed);
      const displayWeight = UnitConverter.convertWeight(weightLb, weightUnit);
      const bikeName = BIKES_DATA[bikeId]?.name || bikeId;
      
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:bikeName, showlegend:true, hoverinfo:'skip', line:{color:lineColor, width:3, shape:'spline'} });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:`(F${front}/R${rear} ${hpKey})`, showlegend:true, hoverinfo:'skip', line:{color:lineColor, width:2, shape:'spline'} });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:`Weight: ${Math.round(displayWeight)} ${weightUnit}`, showlegend:true, hoverinfo:'skip', line:{color:lineColor, width:2, shape:'spline'} });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:`Shift Time: ${shiftMs} ms`, showlegend:true, hoverinfo:'skip', line:{color:lineColor, width:2, shape:'spline'} });
      
      // Create proper hover template for frozen traces with additional data
      let hoverTemplate, customData;
      if (currentView === 'accel_ts') {
        // Time vs Speed - add distance info
        customData = distanceConverted;
        const distanceUnit = UnitConverter.getDistanceUnit(userPreferences.speed);
        hoverTemplate = `Time: %{x:.2f}s<br>Speed: %{y:.1f} ${userPreferences.speed}<br>Distance: %{customdata:.0f} ${distanceUnit}<extra></extra>`;
      } else if (currentView === 'accel_td') {
        // Time vs Distance - add speed info
        customData = speedConverted;
        const distanceUnit = UnitConverter.getDistanceUnit(userPreferences.speed);
        hoverTemplate = `Time: %{x:.2f}s<br>Distance: %{y:.0f} ${distanceUnit}<br>Speed: %{customdata:.1f} ${userPreferences.speed}<extra></extra>`;
      } else if (currentView === 'accel_tg') {
        hoverTemplate = `Time: %{x:.2f}s<br>Accel: %{y:.2f} g<extra></extra>`;
      } else if (currentView === 'accel_sg') {
        hoverTemplate = `Speed: %{x:.1f} ${userPreferences.speed}<br>Accel: %{y:.2f} g<extra></extra>`;
      } else {
        hoverTemplate = `Time: %{x:.2f}s<br>Speed: %{y:.1f} ${userPreferences.speed}<extra></extra>`;
      }
      
      // Don't smooth G-force graphs
      const lineShape = (currentView === 'accel_tg' || currentView === 'accel_sg') ? 'linear' : 'spline';
      const traceData = { x:xData, y:yData, mode:'lines', showlegend:false, hoverinfo:'x+y', hovertemplate: hoverTemplate, line:{ color: lineColor, width:2, shape: lineShape }, opacity:0.7 };
      if (customData) traceData.customdata = customData;
      frozenTraces.push(traceData);
      
      if (showShift) {
        sim.shiftMarkers.forEach(m => {
          const yLabelPos = Math.max(0, (ACCEL_LABEL_BASE - configIndex * ACCEL_LABEL_STEP) * ACCEL_SPEED_YMAX);
          // Vertical lines disabled for frozen traces to reduce clutter
        });
      }
    }
    else if (currentFamily === 'wheel') {
      const { wt, shift_speed, shift_rpm } = computeShiftPoints(hpArr, fd, rpmArr, shiftRpmSetting);
      const truncate = document.getElementById("truncateCross").checked;
      const lineColor = gear_colors[configIndex % gear_colors.length];
      const bikeName = BIKES_DATA[bikeId]?.name || bikeId;
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:bikeName, showlegend:true, hoverinfo:'skip', line:{ color:lineColor, shape:'spline', width:3 } });
      frozenTraces.push({ x:[null], y:[null], mode:'lines', name:`(F${front}/R${rear} ${hpKey})`, showlegend:true, hoverinfo:'skip', line:{ color: gear_colors[0], width: 2, dash: dashStyle, shape: 'spline' } });
      
      // Add gear traces (applying clip lines setting)
      for (let g = 1; g <= 6; g++) {
        const speeds = rpmArr.map(r => rpmToSpeed(r, bikeSpecs.gear_ratios[g], fd));
        const torques = hpToWheelTorqueAt(rpmArr, hpArr, bikeSpecs.gear_ratios[g], fd);
        let xPts = [], yPts = [], rpmPts = [];
        for (let i = 0; i < rpmArr.length; i++) {
          const sp = speeds[i], tq = torques[i], rp = rpmArr[i];
          const inRange = !truncate || ((g > 1 ? sp >= shift_speed[g-1] : true) && (g < 6 ? sp <= shift_speed[g] : true));
          if (inRange) { 
            xPts.push(UnitConverter.convertSpeed(sp, userPreferences.speed)); 
            yPts.push(UnitConverter.convertTorque(tq, userPreferences.torque));
            rpmPts.push(rp);
          }
        }
        if (xPts.length) {
          let label = `Gear ${g}`;
          if (g < 6 && shift_rpm[g] != null) {
            const convertedShiftSpeed = UnitConverter.convertSpeed(shift_speed[g], userPreferences.speed);
            label += ` (${Math.round(shift_rpm[g])} RPM / ${convertedShiftSpeed.toFixed(1)} ${userPreferences.speed})`;
          }
          else if (g === 6) { 
            const red = rpmArr[rpmArr.length - 1]; 
            const sp = rpmToSpeed(red, bikeSpecs.gear_ratios[g], fd);
            const convertedSp = UnitConverter.convertSpeed(sp, userPreferences.speed);
            label += ` (${Math.round(red)} RPM / ${convertedSp.toFixed(1)} ${userPreferences.speed})`; 
          }
          frozenTraces.push({ x: xPts, y: yPts, customdata: rpmPts, mode: 'lines', name: label, showlegend: true, hovertemplate: `Speed: %{x:.1f} ${userPreferences.speed}<br>RPM: %{customdata:.0f} RPM<br>Torque: %{y:.1f} ${userPreferences.torque}<extra></extra>`, line: { color: gear_colors[g-1], dash: dashStyle, width: 2, shape: 'spline', opacity: 0.3 } });
        }
      }
      
      // Add shift point connectors
      const maxYConverted = UnitConverter.convertTorque(maxY, userPreferences.torque);
      for (let g = 1; g <= 5; g++) {
        const xShift = shift_speed[g];
        if (xShift != null) {
          const yLabel = Math.max(0, (0.97 - configIndex * 0.03)) * maxYConverted;
          const speedsNext = rpmArr.map(r => rpmToSpeed(r, gear_ratios[g + 1], fd));
          const idxNext = speedsNext.findIndex(s => s >= xShift);
          const torqueNext = idxNext !== -1 ? UnitConverter.convertTorque(wt[g + 1][idxNext], userPreferences.torque) : 0;
          const xShiftConverted = UnitConverter.convertSpeed(xShift, userPreferences.speed);
          frozenConnectorTraces.push({
            x: [xShiftConverted, xShiftConverted], y: [yLabel, torqueNext], mode: 'lines',
            line: { color: gear_colors[g - 1], width: 1, dash: dashStyle },
            showlegend: false, hoverinfo: 'skip'
          });
          frozenConnectorTraces.push({
            x: [xShiftConverted], y: [yLabel], mode: 'text', text: [`${xShiftConverted.toFixed(1)} ${userPreferences.speed}`],
            textposition: 'top center', textfont: { color: gear_colors[g - 1] },
            showlegend: false, hoverinfo: 'skip', cliponaxis: false
          });
        }
      }
    }
  });
  
  // Restore original global bike variables
  primary_drive = originalGlobals.primary_drive;
  tire_circ_in = originalGlobals.tire_circ_in;
  Crr = originalGlobals.Crr;
  CdA = originalGlobals.CdA;
  gear_ratios = originalGlobals.gear_ratios;
}

// Main plotting function
function plotTorque(animate = true) {
  const view = document.getElementById('viewSelect').value;
  const fam = viewFamily(view);
  toggleControlVisibility();

  // Remember the last view for comparison
  const lastView = window.lastPlotView;
  window.lastPlotView = view;
  
  // Regenerate frozen traces when view changes (only if we have configurations)
  if ((lastFamily !== null && fam !== lastFamily) || (lastView && lastView !== view)) {
    if (frozenConfigurations.length > 0) {
      regenerateFrozenTraces();
    }
  }
  lastFamily = fam;
  
  // Also regenerate if we have configurations but no traces (initial load)
  if (frozenConfigurations.length > 0 && frozenTraces.length === 0) {
    regenerateFrozenTraces();
  }
  
  // Always regenerate frozen traces if we have configurations (to respect current settings)
  if (frozenConfigurations.length > 0) {
    regenerateFrozenTraces();
  }

  const front = parseInt(document.getElementById("front").value);
  const rear  = parseInt(document.getElementById("rear").value);
  const hpKey = document.getElementById("hpData").value;
  const rpmArr = rpmDense;
  const hpArr  = hpDenseSets[hpKey];
  const fd = rear / front;
  const activeDash = (fam === 'wheel' && freezeCount > 1 && animate) ? freezeDashStyles[(freezeCount - 1) % freezeDashStyles.length] : null;

  if (view === 'dyno') {
    const hpArrRaw = hp_data_sets[hpKey].map(([r, hp]) => hp);
    const rpmArrRaw = hp_data_sets[hpKey].map(([r, hp]) => r);
    const engTq = hp_data_sets[hpKey].map(([rpm, hp]) => (hp * 5252) / rpm);
    
    // Convert to user's preferred units
    const hpConverted = hpArrRaw.map(hp => UnitConverter.convertPower(hp, userPreferences.power));
    const tqConverted = engTq.map(tq => UnitConverter.convertTorque(tq, userPreferences.torque));
    
    const currentColor = gear_colors[freezeCount % gear_colors.length];
    const dynoTraces = [
      { x: rpmArrRaw, y: tqConverted, mode:'lines', showlegend:false, hoverinfo:'x+y', hovertemplate:`RPM: %{x} RPM<br>Torque: %{y:.1f} ${userPreferences.torque}<extra></extra>`, line:{ color: currentColor, shape:'spline', width:2 } },
      { x: rpmArrRaw, y: hpConverted, mode:'lines', showlegend:false, hoverinfo:'x+y', hovertemplate:`RPM: %{x} RPM<br>Power: %{y:.1f} ${userPreferences.power}<extra></extra>`, line:{ color: currentColor, shape:'spline', width:2 } }
    ];
    const maxHP = Math.max(...hpConverted), maxTQ = Math.max(...tqConverted);
    const legendTraces = [
      { x:[null], y:[null], mode:'lines', name:currentBikeData.name, showlegend:true, hoverinfo:'skip', line:{ color:currentColor, shape:'spline', width:3 } },
      { x:[null], y:[null], mode:'lines', name:hpKey, showlegend:true, hoverinfo:'skip', line:{ color:currentColor, shape:'spline', width:2 } },
      { x:[null], y:[null], mode:'lines', name:`Max ${userPreferences.power}: ${maxHP.toFixed(1)}`, showlegend:true, hoverinfo:'skip', line:{ color:currentColor, shape:'spline', width:2 } },
      { x:[null], y:[null], mode:'lines', name:`Max ${userPreferences.torque}: ${maxTQ.toFixed(1)}`, showlegend:true, hoverinfo:'skip', line:{ color:currentColor, shape:'spline', width:2 } }
    ];
    const viewTitle = document.getElementById('viewSelect').options[document.getElementById('viewSelect').selectedIndex].text;
    
    // Calculate dynamic bounds to show all data including frozen traces
    let allXData = [...rpmArrRaw];
    let allYData = [...hpConverted, ...tqConverted];
    
    // Include data from frozen traces
    frozenTraces.forEach(trace => {
      if (trace.x && trace.y && Array.isArray(trace.x) && Array.isArray(trace.y)) {
        // Filter out null/undefined values
        const validX = trace.x.filter(x => x !== null && x !== undefined && !isNaN(x));
        const validY = trace.y.filter(y => y !== null && y !== undefined && !isNaN(y));
        allXData = allXData.concat(validX);
        allYData = allYData.concat(validY);
      }
    });
    
    // Calculate bounds with some padding
    const minRPM = Math.min(...allXData);
    const maxRPM = Math.max(...allXData);
    const maxY = Math.max(...allYData);
    const xPadding = (maxRPM - minRPM) * 0.05; // 5% padding
    const yPadding = maxY * 0.1; // 10% padding
    
    const dynoLayout = { 
      title: viewTitle, 
      xaxis:{ 
        title:'RPM', 
        color:'white', 
        autorange:false, 
        range:[Math.max(0, minRPM - xPadding), maxRPM + xPadding] 
      }, 
      yaxis:{ 
        title:`${UnitConverter.getPowerLabel(userPreferences.power)} / ${UnitConverter.getTorqueLabel(userPreferences.torque)}`, 
        color:'white', 
        autorange:false, 
        range:[0, maxY + yPadding] 
      }, 
      plot_bgcolor:'#111', 
      paper_bgcolor:'#111', 
      font:{ color:'white' }, 
      transition:{ duration:1000, easing:'cubic-in-out' }, 
      hovermode:'closest', 
      hoverdistance:10 
    };
    
    const allDynoTraces = [...dynoTraces, ...legendTraces, ...frozenTraces];
    if (animate) Plotly.react('plot', allDynoTraces, dynoLayout, {responsive:true});
    else { const staticLayout = { ...dynoLayout }; delete staticLayout.transition; Plotly.newPlot('plot', allDynoTraces, staticLayout, {responsive:true}); }
    Plotly.Plots.resize(document.getElementById('plot'));
    previousTraces = []; return;
  }

  if (fam === 'accel') {
    const sim = simulateAccel(hpArr, rpmArr, fd, 0.02);
    let xData, yData, xTitle, yTitle, showShift=false;
    
    // Convert speed data to user's preferred units
    const speedConverted = sim.V.map(mph => UnitConverter.convertSpeed(mph, userPreferences.speed));
    
    // Convert distance data based on speed unit preference
    const distanceUnit = UnitConverter.getDistanceUnit(userPreferences.speed);
    const distanceConverted = sim.S.map(ft => UnitConverter.convertDistance(ft, distanceUnit));
    
    // Use fixed bounds for all acceleration charts
    const accelMaxSpeed = UnitConverter.convertSpeed(FIXED_AXIS_BOUNDS.accel.maxSpeed, userPreferences.speed);
    const accelMaxDistance = UnitConverter.convertDistance(FIXED_AXIS_BOUNDS.accel.maxDistance, distanceUnit);
    
    if (view === 'accel_ts') { 
      xData = sim.T; 
      yData = speedConverted; 
      xTitle='Time (s)'; 
      yTitle=UnitConverter.getSpeedLabel(userPreferences.speed); 
      showShift=true; 
    }
    else if (view === 'accel_td') { 
      xData = sim.T; 
      yData = distanceConverted; 
      xTitle='Time (s)'; 
      yTitle=UnitConverter.getDistanceLabel(distanceUnit); 
    }
    else if (view === 'accel_tg') { xData = sim.T; yData = sim.A.map(a=>a/g_mps2); xTitle='Time (s)'; yTitle='Acceleration (g)'; }
    else if (view === 'accel_sg') { 
      xData = speedConverted; 
      yData = sim.A.map(a=>a/g_mps2); 
      xTitle=UnitConverter.getSpeedLabel(userPreferences.speed); 
      yTitle='Acceleration (g)'; 
    }
    else { xData = sim.T; yData = speedConverted; xTitle='Time (s)'; yTitle=UnitConverter.getSpeedLabel(userPreferences.speed); }

    const traces = [];
    const currentColor = gear_colors[freezeCount % gear_colors.length];
    const weightLb = getMassLb();
    const shiftMs = getShiftMs();
    
    // Add legend entries with configuration details
    const weightUnit = UnitConverter.getWeightUnit(userPreferences.speed);
    const displayWeight = UnitConverter.convertWeight(weightLb, weightUnit);
    
    traces.push({ x:[null], y:[null], mode:'lines', name:currentBikeData.name, showlegend:true, hoverinfo:'skip', line:{ color: currentColor, width:3, shape:'spline' } });
    traces.push({ x:[null], y:[null], mode:'lines', name:`(F${front}/R${rear} ${hpKey})`, showlegend:true, hoverinfo:'skip', line:{ color: currentColor, width:2, shape:'spline' } });
    traces.push({ x:[null], y:[null], mode:'lines', name:`Weight: ${Math.round(displayWeight)} ${weightUnit}`, showlegend:true, hoverinfo:'skip', line:{ color: currentColor, width:2, shape:'spline' } });
    traces.push({ x:[null], y:[null], mode:'lines', name:`Shift Time: ${shiftMs} ms`, showlegend:true, hoverinfo:'skip', line:{ color: currentColor, width:2, shape:'spline' } });
    
    // Create enhanced hover template with additional data for main traces
    let mainHoverTemplate, mainCustomData;
    if (view === 'accel_ts') {
      // Time vs Speed - add distance info
      mainCustomData = distanceConverted;
      mainHoverTemplate = `Time: %{x:.2f}s<br>Speed: %{y:.1f} ${userPreferences.speed}<br>Distance: %{customdata:.0f} ${distanceUnit}<extra></extra>`;
    } else if (view === 'accel_td') {
      // Time vs Distance - add speed info  
      mainCustomData = speedConverted;
      mainHoverTemplate = `Time: %{x:.2f}s<br>Distance: %{y:.0f} ${distanceUnit}<br>Speed: %{customdata:.1f} ${userPreferences.speed}<extra></extra>`;
    } else {
      // Keep original hover template for other views
      mainHoverTemplate = (xTitle.startsWith('Time') ? `Time: %{x:.2f}s` : `Speed: %{x:.1f} ${userPreferences.speed}`) + '<br>' +
        (yTitle.includes('Speed') ? `Speed: %{y:.1f} ${userPreferences.speed}` : 
         yTitle.includes('Distance') ? `Distance: %{y:.0f} ${yTitle.includes('(m)') ? 'm' : 'ft'}` : 
         `Accel: %{y:.2f} g`) +
        '<extra></extra>';
    }

    // Don't smooth G-force graphs
    const mainLineShape = (view === 'accel_tg' || view === 'accel_sg') ? 'linear' : 'spline';
    const mainTrace = { x:xData, y:yData, mode:'lines', name:'Acceleration View', showlegend:false, hoverinfo:'x+y',
      hovertemplate: mainHoverTemplate, line:{ color: currentColor, width:2, shape: mainLineShape } };
    if (mainCustomData) mainTrace.customdata = mainCustomData;
    traces.push(mainTrace);

    const connectorTraces = [];
    if (showShift) {
      sim.shiftMarkers.forEach(m => {
        const yLabelPos = Math.max(0, (ACCEL_LABEL_BASE - freezeCount * ACCEL_LABEL_STEP) * ACCEL_SPEED_YMAX);
        const shiftColor = gear_colors[Math.max(0, m.gear-1)];
        // Vertical lines and labels disabled for cleaner look
      });
    }

    const viewTitle = document.getElementById('viewSelect').options[document.getElementById('viewSelect').selectedIndex].text;
    
    // Set fixed axis ranges based on chart type
    let xRange, yRange;
    if (view === 'accel_ts') {
      xRange = [0, FIXED_AXIS_BOUNDS.accel.maxTime];
      yRange = [0, accelMaxSpeed];
    } else if (view === 'accel_td') {
      xRange = [0, FIXED_AXIS_BOUNDS.accel.maxTime];
      yRange = [0, accelMaxDistance];
    } else if (view === 'accel_tg') {
      xRange = [0, FIXED_AXIS_BOUNDS.accel.maxTime];
      yRange = [0, FIXED_AXIS_BOUNDS.accel.maxG];
    } else if (view === 'accel_sg') {
      xRange = [0, accelMaxSpeed];
      yRange = [0, FIXED_AXIS_BOUNDS.accel.maxG];
    } else {
      xRange = [0, FIXED_AXIS_BOUNDS.accel.maxTime];
      yRange = [0, accelMaxSpeed];
    }
    
    const layout = {
      title: viewTitle,
      xaxis: { title:xTitle, color:'white', range:xRange },
      yaxis: { title:yTitle, color:'white', range:yRange },
      plot_bgcolor:'#111', paper_bgcolor:'#111', font:{ color:'white' },
      hovermode:'closest', hoverdistance:10, transition:{ duration:1000, easing:'cubic-in-out' }
    };

    const allTraces = [...traces, ...connectorTraces, ...frozenTraces, ...frozenConnectorTraces];
    if (animate) Plotly.react('plot', allTraces, layout, { responsive:true });
    else { const staticLayout = { ...layout }; delete staticLayout.transition; Plotly.newPlot('plot', allTraces, staticLayout, { responsive:true }); }
    previousTraces = [...traces, ...connectorTraces];
    Plotly.Plots.resize(document.getElementById('plot'));
    return;
  }

  // Wheel TQ
  const { wt, spd, shift_rpm, shift_speed } = computeShiftPoints(hpArr, fd, rpmArr);
  const truncate = document.getElementById("truncateCross").checked;
  const traces = [];
  const groupLabel = `(F${front}/R${rear} ${hpKey})`;
  traces.push({ x:[null], y:[null], mode:'lines', name:currentBikeData.name, showlegend:true, hoverinfo:'skip', line:{ color: gear_colors[0], width:3, shape:'spline' } });
  traces.push({ x:[null], y:[null], mode:'lines', name:groupLabel, showlegend:true, hoverinfo:'skip', line:{ color: gear_colors[0], width:2, shape:'spline' } });

  for (let g = 1; g <= 6; g++) {
    const speeds = rpmArr.map(r => rpmToSpeed(r, gear_ratios[g], fd));
    const torques = hpToWheelTorqueAt(rpmArr, hpArr, gear_ratios[g], fd);
    let xPts = [], yPts = [], rpmPts = [];
    for (let i = 0; i < rpmArr.length; i++) {
      const sp = speeds[i], tq = torques[i], rp = rpmArr[i];
      const inRange = !truncate || ((g > 1 ? sp >= shift_speed[g-1] : true) && (g < 6 ? sp <= shift_speed[g] : true));
      if (inRange) { 
        xPts.push(UnitConverter.convertSpeed(sp, userPreferences.speed)); 
        yPts.push(UnitConverter.convertTorque(tq, userPreferences.torque)); 
        rpmPts.push(rp); 
      }
    }
    if (xPts.length) {
      let label = `Gear ${g}`;
      if (g < 6 && shift_rpm[g] != null) {
        const convertedShiftSpeed = UnitConverter.convertSpeed(shift_speed[g], userPreferences.speed);
        label += ` (${Math.round(shift_rpm[g])} RPM / ${convertedShiftSpeed.toFixed(1)} ${userPreferences.speed})`;
      }
      else if (g === 6) { 
        const red = rpmArr[rpmArr.length - 1]; 
        const sp = rpmToSpeed(red, gear_ratios[g], fd); 
        const convertedSp = UnitConverter.convertSpeed(sp, userPreferences.speed);
        label += ` (${Math.round(red)} RPM / ${convertedSp.toFixed(1)} ${userPreferences.speed})`; 
      }
      traces.push({ x:xPts, y:yPts, customdata:rpmPts, mode:'lines', name:label, line:{ color:gear_colors[g-1], width:2, shape:'spline' }, opacity:1, hovertemplate:`Speed: %{x:.1f} ${userPreferences.speed}<br>RPM: %{customdata:.0f} RPM<br>Torque: %{y:.1f} ${userPreferences.torque}<extra></extra>` });
    }
  }

  const connectorTraces = [];
  // Use fixed axis bounds for wheel torque chart - ensure at least 160 MPH equivalent
  const wheelMaxSpeedMPH = Math.max(160, FIXED_AXIS_BOUNDS.wheel.maxSpeed);
  const maxXConverted = UnitConverter.convertSpeed(wheelMaxSpeedMPH, userPreferences.speed);
  const maxYConverted = UnitConverter.convertTorque(FIXED_AXIS_BOUNDS.wheel.maxTorque, userPreferences.torque);
  
  for (let g = 1; g <= 5; g++) {
    const xShift = shift_speed[g];
    if (xShift != null) {
      const baseRatio = 0.97, stepRatio = 0.03;
      const yLabel = Math.max(0, baseRatio - freezeCount * stepRatio) * maxYConverted;
      const speedsNext = rpmArr.map(r => rpmToSpeed(r, gear_ratios[g + 1], fd));
      const idxNext = speedsNext.findIndex(s => s >= xShift);
      const torqueNext = idxNext !== -1 ? UnitConverter.convertTorque(wt[g + 1][idxNext], userPreferences.torque) : 0;
      const xShiftConverted = UnitConverter.convertSpeed(xShift, userPreferences.speed);
      connectorTraces.push({ x:[xShiftConverted, xShiftConverted], y:[yLabel, torqueNext], mode:'lines', line:{ color:gear_colors[g - 1], width:2, dash: activeDash || 'solid' }, showlegend:false, hoverinfo:'skip' });
      connectorTraces.push({ x:[xShiftConverted], y:[yLabel], mode:'text', text:[`${xShiftConverted.toFixed(1)} ${userPreferences.speed}`], textposition:'top center', textfont:{ color:gear_colors[g - 1] }, showlegend:false, hoverinfo:'skip', cliponaxis:false });
    }
  }

  const viewTitle = document.getElementById('viewSelect').options[document.getElementById('viewSelect').selectedIndex].text;
  const layout = { transition:{ duration:1000, easing:'cubic-in-out' }, hovermode:'closest', hoverdistance:10, title: viewTitle, xaxis:{title:UnitConverter.getSpeedLabel(userPreferences.speed), color:'white', range:[0,maxXConverted]}, yaxis:{title:`Wheel ${UnitConverter.getTorqueLabel(userPreferences.torque)}`, color:'white', range:[0,maxYConverted]}, plot_bgcolor:'#111', paper_bgcolor:'#111', font:{color:'white'} };
  const allTraces = [...traces, ...connectorTraces, ...frozenTraces, ...frozenConnectorTraces];
  if (animate) Plotly.react('plot', allTraces, layout, {responsive: true});
  else { const staticLayout = { ...layout }; delete staticLayout.transition; Plotly.newPlot('plot', allTraces, staticLayout, {responsive: true}); }
  previousTraces = [...traces, ...connectorTraces];
  Plotly.Plots.resize(document.getElementById('plot'));
}

// Layout adjustment function
function adjustLayout() {
  const plot = document.getElementById('plot');
  const controls = document.querySelector('.controls');
  const buttonRow = document.querySelector('.button-row');
  
  // Calculate available height
  const windowHeight = window.innerHeight;
  const windowWidth = window.innerWidth;
  
  // Get actual heights of elements
  const controlsHeight = controls ? controls.offsetHeight : 0;
  const buttonRowHeight = buttonRow ? buttonRow.offsetHeight : 0;
  
  // Calculate available space for plot (with some padding)
  const availableHeight = windowHeight - controlsHeight - buttonRowHeight - 60; // 60px padding
  const availableWidth = windowWidth - 20; // 20px padding
  
  // Calculate ideal plot dimensions maintaining 16:9 aspect ratio
  let plotWidth = Math.min(availableWidth, availableHeight * (16/9));
  let plotHeight = plotWidth * (9/16);
  
  // If calculated height is too large, constrain by height instead
  if (plotHeight > availableHeight) {
    plotHeight = availableHeight;
    plotWidth = plotHeight * (16/9);
  }
  
  // Apply the calculated dimensions
  if (plot) {
    plot.style.width = `${plotWidth}px`;
    plot.style.height = `${plotHeight}px`;
    plot.style.maxWidth = `${plotWidth}px`;
    plot.style.maxHeight = `${plotHeight}px`;
  }
}