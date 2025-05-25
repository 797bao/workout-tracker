// cardioInitializer.js - RESTRUCTURED with added Mission Peak and Summit activities
const firebaseModule = require('./firebase');

async function initializeCardioData() {
  try {
    // Initialize Firebase connection
    if (!firebaseModule.getDb()) {
      firebaseModule.initializeFirebase();
    }
    
    // Get the database reference
    const db = firebaseModule.getDb();
    
    console.log('Connected to Firebase successfully');
    
    // Check if cardio data exists
    const cardioRef = db.ref('cardio');
    const snapshot = await cardioRef.once('value');
    
    if (snapshot.exists()) {
      console.log('Cardio data already exists:');
      const years = Object.keys(snapshot.val());
      for (const year of years) {
        const months = Object.keys(snapshot.val()[year]);
        console.log(`Found cardio data for year ${year}, months: ${months.join(', ')}`);
      }
      return;
    }
    
    // Define cardio exercises - NOW WITH MISSION PEAK AND SUMMIT
    const cardioExercises = {
      "treadmill": {
        name: "Treadmill",
        pointStyle: "rect",
        backgroundColor: "#cadcfd",
        borderColor: "#ffffff"
      },
      "elliptical": {
        name: "Elliptical",
        pointStyle: "rectRot",
        backgroundColor: "#cadcfd",
        borderColor: "#ffffff"
      },
      "jogging": {
        name: "Jogging",
        pointStyle: "circle",
        backgroundColor: "#cadcfd",
        borderColor: "#ffffff"
      },
      "missionpeak": {
        name: "Mission Peak",
        pointStyle: "triangle",
        backgroundColor: "#000000", // Black background
        borderColor: "#cadcfd"      // Same blue border color
      },
      "summit": {
        name: "Summit",
        pointStyle: "star",         // Different shape
        backgroundColor: "#000000", // Black background
        borderColor: "#cadcfd"      // Same blue border color
      }
    };
    
    // Initialize cardioExercises in database
    const cardioExercisesRef = db.ref('cardioExercises');
    await cardioExercisesRef.set(cardioExercises);
    console.log('Initialized cardio exercises definition with 5 activities');
    
    // Generate sample cardio data
    console.log('Cardio data does not exist. Creating sample cardio data...');
    
    // Generate dates for the past 30 days
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    
    // Format cardio data in the structure: cardio/YYYY/MM/YYYYMMDD/[exercises]
    const cardioData = {};
    
    // Add cardio sessions for each date (skipping some days for realism)
    dates.forEach((date, index) => {
      // Skip some days (for a more realistic workout schedule)
      if (index % 2 === 1) return; // Skip every other day
      
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const dateKey = formatDateKey(date);
      
      // Initialize nested structure if needed
      if (!cardioData[year]) {
        cardioData[year] = {};
      }
      if (!cardioData[year][month]) {
        cardioData[year][month] = {};
      }
      if (!cardioData[year][month][dateKey]) {
        cardioData[year][month][dateKey] = {};
      }
      
      // Different cardio routine based on day of week
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Generate a random cardio workout based on the day
      switch (dayOfWeek) {
        case 0: // Sunday - Light jogging
          cardioData[year][month][dateKey]['jogging'] = generateCardioSession('jogging', 2.5, 30);
          break;
          
        case 1: // Monday - Mission Peak hike
          cardioData[year][month][dateKey]['missionpeak'] = generateHikeSession(6.0, 180); // 6 miles, 3 hours
          break;
          
        case 2: // Tuesday - Treadmill interval training
          cardioData[year][month][dateKey]['treadmill'] = generateCardioSession('treadmill', 3.0, 30);
          break;
          
        case 3: // Wednesday - Rest or light exercise (maybe elliptical)
          if (index % 4 === 0) { // Only on some Wednesdays
            cardioData[year][month][dateKey]['elliptical'] = generateCardioSession('elliptical', 2.0, 20);
          }
          break;
          
        case 4: // Thursday - Elliptical workout
          cardioData[year][month][dateKey]['elliptical'] = generateCardioSession('elliptical', 4.0, 35);
          break;
          
        case 5: // Friday - Rest day or summit hike (less frequent)
          if (index % 6 === 0) { // Every 6th Friday
            cardioData[year][month][dateKey]['summit'] = generateHikeSession(8.0, 240); // 8 miles, 4 hours
          }
          break;
          
        case 6: // Saturday - Long run or Mission Peak
          if (index % 4 === 0) { // Sometimes Mission Peak instead of jogging
            cardioData[year][month][dateKey]['missionpeak'] = generateHikeSession(6.0, 165); // Slightly faster pace
          } else {
            cardioData[year][month][dateKey]['jogging'] = generateCardioSession('jogging', 5.0, 45);
          }
          break;
          
        default: // Fallback - Random selection (should never hit this)
          const exercises = Object.keys(cardioExercises);
          const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
          
          if (randomExercise === 'missionpeak' || randomExercise === 'summit') {
            cardioData[year][month][dateKey][randomExercise] = generateHikeSession(
              randomExercise === 'missionpeak' ? 6.0 : 8.0,
              randomExercise === 'missionpeak' ? 180 : 240
            );
          } else {
            const distance = (Math.random() * 5 + 1).toFixed(2);
            const duration = Math.floor(Math.random() * 30 + 15);
            cardioData[year][month][dateKey][randomExercise] = 
              generateCardioSession(randomExercise, parseFloat(distance), duration);
          }
          break;
      }
      
      // Remove empty date entries
      if (Object.keys(cardioData[year][month][dateKey]).length === 0) {
        delete cardioData[year][month][dateKey];
      }
      // Remove empty month entries
      if (cardioData[year][month] && Object.keys(cardioData[year][month]).length === 0) {
        delete cardioData[year][month];
      }
      // Remove empty year entries
      if (cardioData[year] && Object.keys(cardioData[year]).length === 0) {
        delete cardioData[year];
      }
    });
    
    // Add some special summit hikes (not tied to day of week pattern)
    // For demonstration purposes, add a few summit hikes to specific dates
    
    // Add a summit hike on May 15, 2025
    const summitDate1 = new Date(2025, 4, 15); // May 15, 2025
    addSpecialHike(cardioData, summitDate1, 'summit', 9.5, 300); // 9.5 miles, 5 hours
    
    // Add a Mission Peak hike on May 8, 2025
    const missionDate1 = new Date(2025, 4, 8); // May 8, 2025
    addSpecialHike(cardioData, missionDate1, 'missionpeak', 6.2, 170); // 6.2 miles, 2h50m
    
    // Set the data
    await cardioRef.set(cardioData);
    
    // Count total cardio sessions
    let totalSessions = 0;
    let totalDays = 0;
    let hikeCount = 0;
    
    Object.keys(cardioData).forEach(year => {
      Object.keys(cardioData[year]).forEach(month => {
        Object.keys(cardioData[year][month]).forEach(day => {
          const daySessions = cardioData[year][month][day];
          totalSessions += Object.keys(daySessions).length;
          
          // Count hikes specifically
          if (daySessions['missionpeak'] || daySessions['summit']) {
            hikeCount++;
          }
          
          totalDays++;
        });
      });
    });
    
    console.log(`Sample cardio data created successfully! Added ${totalSessions} cardio sessions across ${totalDays} days.`);
    console.log(`Includes ${hikeCount} hiking sessions (Mission Peak and Summit).`);
    
  } catch (error) {
    console.error('Error initializing cardio data:', error);
  }
}

/**
 * Add a special hike to a specific date
 * @param {Object} cardioData - The cardio data object
 * @param {Date} date - The date for the hike
 * @param {string} hikeType - 'missionpeak' or 'summit'
 * @param {number} distance - Distance in miles
 * @param {number} minutes - Duration in minutes
 */
function addSpecialHike(cardioData, date, hikeType, distance, minutes) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const dateKey = formatDateKey(date);
  
  // Initialize nested structure if needed
  if (!cardioData[year]) {
    cardioData[year] = {};
  }
  if (!cardioData[year][month]) {
    cardioData[year][month] = {};
  }
  if (!cardioData[year][month][dateKey]) {
    cardioData[year][month][dateKey] = {};
  }
  
  // Add the hike
  cardioData[year][month][dateKey][hikeType] = generateHikeSession(distance, minutes);
}

/**
 * Generate a hike session with realistic data
 * @param {number} baseDistance - Base distance in miles
 * @param {number} baseDuration - Base duration in minutes
 * @returns {Object} Hike session data
 */
function generateHikeSession(baseDistance, baseDuration) {
  // Add some randomness to the base values
  const distanceVariation = (Math.random() * 0.3 - 0.1); // +/- small distance variation
  const distance = Math.max(0.5, baseDistance + distanceVariation).toFixed(2);
  
  const durationVariation = Math.floor(Math.random() * 20 - 10); // +/- 10 minutes
  const minutes = Math.max(30, baseDuration + durationVariation);
  const seconds = 0; // Typically we don't track seconds for long hikes
  const totalTime = minutes * 60 + seconds; // Total time in seconds
  
  // Calculate pace (minutes per mile)
  const timePerMile = totalTime / parseFloat(distance);
  const minutesPerMile = Math.floor(timePerMile / 60);
  const secondsPerMile = Math.floor(timePerMile % 60);
  const speedString = `${minutesPerMile}:${secondsPerMile.toString().padStart(2, '0')}`;
  
  // Calculate MPH - hiking is typically slow (2-3 mph)
  const mph = (parseFloat(distance) / (totalTime / 3600)).toFixed(2);
  
  // Create a session with elevation gain for hikes
  return {
    sessions: [{
      distance: parseFloat(distance),
      time: {
        minutes: minutes,
        seconds: seconds,
        total: totalTime
      },
      speed: {
        pace: speedString, // time per mile (min:sec)
        mph: parseFloat(mph) // miles per hour
      },
      // Add elevation gain for hikes - Mission Peak is about 2,000 ft, Summit varies
      elevationGain: baseDistance > 7 ? Math.floor(3000 + Math.random() * 500) : Math.floor(1800 + Math.random() * 400)
    }]
  };
}

/**
 * Generate a cardio session with randomized data
 * @param {string} exerciseType - Type of cardio exercise
 * @param {number} baseDistance - Base distance in miles
 * @param {number} baseDuration - Base duration in minutes
 * @returns {Object} Cardio session data
 */
function generateCardioSession(exerciseType, baseDistance, baseDuration) {
  // Add some randomness to the base values
  const distanceVariation = (Math.random() * 0.5 - 0.25); // +/- 0.25 miles
  const distance = Math.max(0.5, baseDistance + distanceVariation).toFixed(2);
  
  const durationVariation = Math.floor(Math.random() * 10 - 5); // +/- 5 minutes
  const minutes = Math.max(10, baseDuration + durationVariation);
  const seconds = Math.floor(Math.random() * 60);
  const totalTime = minutes * 60 + seconds; // Total time in seconds
  
  // Calculate pace (minutes per mile)
  const timePerMile = totalTime / parseFloat(distance);
  const minutesPerMile = Math.floor(timePerMile / 60);
  const secondsPerMile = Math.floor(timePerMile % 60);
  const speedString = `${minutesPerMile}:${secondsPerMile.toString().padStart(2, '0')}`;
  
  // Calculate MPH
  const mph = (parseFloat(distance) / (totalTime / 3600)).toFixed(2);
  
  return {
    sessions: [{
      distance: parseFloat(distance),
      time: {
        minutes: minutes,
        seconds: seconds,
        total: totalTime
      },
      speed: {
        pace: speedString, // time per mile (min:sec)
        mph: parseFloat(mph) // miles per hour
      }
    }]
  };
}

/**
 * Format date to YYYYMMDD string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// If this file is run directly, execute the function
if (require.main === module) {
  initializeCardioData();
}

// Export the function for use in other modules
module.exports = { initializeCardioData };