// workoutInitializer.js - RESTRUCTURED
const firebaseModule = require('./firebase');
const admin = require('firebase-admin');

async function initializeWorkoutData() {
  try {
    // Initialize Firebase connection
    if (!firebaseModule.getDb()) {
      firebaseModule.initializeFirebase();
    }
    
    // Get the admin database reference
    const db = firebaseModule.getDb();
    
    console.log('Connected to Firebase successfully');
    
    // Check if restructured 'workouts' data exists
    const workoutsRef = db.ref('workouts');
    const snapshot = await workoutsRef.once('value');
    
    if (snapshot.exists()) {
      console.log('Workouts data already exists:');
      const years = Object.keys(snapshot.val());
      for (const year of years) {
        const months = Object.keys(snapshot.val()[year]);
        console.log(`Found workout data for year ${year}, months: ${months.join(', ')}`);
      }
      return;
    }
    
    // If 'workouts' doesn't exist, create a sample dataset with 30 days of workout history
    console.log('Workouts data does not exist. Creating sample workout data in new structure...');
    
    // Generate dates for the past 30 days
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    
    // Format workout data in new structure: workouts/YYYY/MM/YYYYMMDD/[exercises]
    const workoutData = {};
    
    // Add workouts for each date (skipping some days for realism)
    dates.forEach((date, index) => {
      // Skip some days (for a more realistic workout schedule)
      if (index % 3 === 2) return; // Skip every 3rd day
      
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const dateKey = formatDateKey(date);
      const timestamp = date.getTime();
      
      // Initialize nested structure if needed
      if (!workoutData[year]) {
        workoutData[year] = {};
      }
      if (!workoutData[year][month]) {
        workoutData[year][month] = {};
      }
      if (!workoutData[year][month][dateKey]) {
        workoutData[year][month][dateKey] = {};
      }
      
      // Different workout routine based on day of week
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      switch (dayOfWeek) {
        case 1: // Monday - Chest day
          // Example of a workout with multiple sets at SAME weight
          workoutData[year][month][dateKey]['dumbellflatbench'] = {
            exerciseId: 'dumbellflatbench',
            sets: [
              { weight: 50, reps: 12 },
              { weight: 50, reps: 10 }, // Same weight as first set
              { weight: 50, reps: 8 }   // Same weight as first set
            ],

          };
          
          workoutData[year][month][dateKey]['barbellflatbench'] = {
            exerciseId: 'barbellflatbench',
            sets: [
              { weight: 135, reps: 10 },
              { weight: 155, reps: 8 },
              { weight: 175, reps: 6 }
            ],

          };
          
          workoutData[year][month][dateKey]['cableflies'] = {
            exerciseId: 'cableflies',
            sets: [
              { weight: 25, reps: 12 },
              { weight: 25, reps: 12 }, // Same weight
              { weight: 25, reps: 10 }  // Same weight
            ],

          };
          break;
          
        case 2: // Tuesday - Back day
          workoutData[year][month][dateKey]['deadlifts'] = {
            exerciseId: 'deadlifts',
            sets: [
              { weight: 185, reps: 10 },
              { weight: 225, reps: 8 },
              { weight: 245, reps: 6 }
            ],
          };
          
          workoutData[year][month][dateKey]['barbellrows'] = {
            exerciseId: 'barbellrows',
            sets: [
              { weight: 95, reps: 12 },
              { weight: 95, reps: 12 }, // Same weight
              { weight: 95, reps: 10 }  // Same weight
            ],
          };
          
          workoutData[year][month][dateKey]['latpulldowns'] = {
            exerciseId: 'latpulldowns',
            sets: [
              { weight: 100, reps: 12 },
              { weight: 120, reps: 10 },
              { weight: 140, reps: 8 }
            ],
          };
          break;
          
        case 3: // Wednesday - Leg day
          workoutData[year][month][dateKey]['squats'] = {
            exerciseId: 'squats',
            sets: [
              { weight: 185, reps: 10 },
              { weight: 185, reps: 10 }, // Same weight
              { weight: 225, reps: 6 }
            ],
          };
          
          workoutData[year][month][dateKey]['hipthrusts'] = {
            exerciseId: 'hipthrusts',
            sets: [
              { weight: 135, reps: 12 },
              { weight: 185, reps: 10 },
              { weight: 225, reps: 8 }
            ],

          };
          
          workoutData[year][month][dateKey]['hamstringcurls'] = {
            exerciseId: 'hamstringcurls',
            sets: [
              { weight: 50, reps: 12 },
              { weight: 60, reps: 10 },
              { weight: 70, reps: 8 }
            ],

          };
          break;
          
   
     
        case 6: // Saturday - Calisthenics day
          workoutData[year][month][dateKey]['pullups'] = {
            exerciseId: 'pullups',
            sets: [
              { weight: 0, reps: 12 },
              { weight: 0, reps: 10 },
              { weight: 0, reps: 8 }
            ],

          };
          
          workoutData[year][month][dateKey]['pushups'] = {
            exerciseId: 'pushups',
            sets: [
              { weight: 0, reps: 20 },
              { weight: 0, reps: 20 }, // Same reps
              { weight: 0, reps: 15 }
            ],

          };
          
          workoutData[year][month][dateKey]['dips'] = {
            exerciseId: 'dips',
            sets: [
              { weight: 0, reps: 15 },
              { weight: 0, reps: 15 }, // Same reps
              { weight: 0, reps: 12 }
            ],

          };
          break;
          
        default: // Sunday - Rest day or light workout
          // Only add a workout to some Sundays (every other one)
          if (index % 6 === 0) {
            workoutData[year][month][dateKey]['situps'] = {
              exerciseId: 'situps',
              sets: [
                { weight: 0, reps: 25 },
                { weight: 0, reps: 25 }, // Same reps
                { weight: 0, reps: 20 }
              ],

            };
          }
          break;
      }
      
      // Remove empty date entries
      if (Object.keys(workoutData[year][month][dateKey]).length === 0) {
        delete workoutData[year][month][dateKey];
      }
      // Remove empty month entries
      if (Object.keys(workoutData[year][month]).length === 0) {
        delete workoutData[year][month];
      }
      // Remove empty year entries
      if (Object.keys(workoutData[year]).length === 0) {
        delete workoutData[year];
      }
    });
    
    // Set the data
    await workoutsRef.set(workoutData);
    
    // Count total workouts
    let totalWorkouts = 0;
    let totalDays = 0;
    
    Object.keys(workoutData).forEach(year => {
      Object.keys(workoutData[year]).forEach(month => {
        Object.keys(workoutData[year][month]).forEach(day => {
          const dayWorkouts = workoutData[year][month][day];
          totalWorkouts += Object.keys(dayWorkouts).length;
          totalDays++;
        });
      });
    });
    
    console.log(`Sample workout data created successfully! Added ${totalWorkouts} workouts across ${totalDays} days.`);
    
  } catch (error) {
    console.error('Error initializing workout data:', error);
  }
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
  initializeWorkoutData();
}

// Export the function for use in other modules
module.exports = { initializeWorkoutData };