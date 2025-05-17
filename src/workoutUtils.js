// workoutUtils.js
const firebaseModule = require('./firebase');
const admin = require('firebase-admin');

// Initialize Firebase if not already initialized
function ensureFirebaseInitialized() {
  if (!firebaseModule.getDb()) {
    firebaseModule.initializeFirebase();
  }
  return firebaseModule.getDb();
}

/**
 * Read all workout data from Firebase
 */
async function getAllWorkouts() {
  const db = ensureFirebaseInitialized();
  
  try {
    const workoutsRef = db.ref('workouts');
    const snapshot = await workoutsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('No workout data found');
      return null;
    }
    
    return snapshot.val();
  } catch (error) {
    console.error('Error fetching workouts:', error);
    throw error;
  }
}

/**
 * Read workouts for a specific date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
async function getWorkoutsByDateRange(startDate, endDate) {
  const db = ensureFirebaseInitialized();
  
  // Convert dates to YYYYMMDD format for Firebase keys
  const startDateKey = formatDateKey(startDate);
  const endDateKey = formatDateKey(endDate);
  
  try {
    const workoutsRef = db.ref('workouts');
    const snapshot = await workoutsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('No workout data found');
      return null;
    }
    
    const allWorkouts = snapshot.val();
    const filteredWorkouts = {};
    
    // Filter workouts by date
    Object.keys(allWorkouts).forEach(dateKey => {
      if (dateKey >= startDateKey && dateKey <= endDateKey) {
        filteredWorkouts[dateKey] = allWorkouts[dateKey];
      }
    });
    
    return filteredWorkouts;
  } catch (error) {
    console.error('Error fetching workouts by date range:', error);
    throw error;
  }
}

/**
 * Add a new workout
 * @param {Date} date - Workout date
 * @param {string} exerciseId - Exercise ID
 * @param {Array} sets - Array of sets with weight and reps
 * @param {string} notes - Optional notes
 */
async function addWorkout(date, exerciseId, sets, notes = '') {
  const db = ensureFirebaseInitialized();
  
  try {
    // Get exercises to validate exerciseId
    const exercisesRef = db.ref('exercises');
    const exercisesSnapshot = await exercisesRef.once('value');
    
    if (!exercisesSnapshot.exists()) {
      throw new Error('Exercises data not found. Initialize exercises first.');
    }
    
    const exercises = exercisesSnapshot.val();
    if (!exercises[exerciseId]) {
      throw new Error(`Exercise ID '${exerciseId}' not found in database.`);
    }
    
    // Format date for Firebase key
    const dateKey = formatDateKey(date);
    const timestamp = date.getTime();
    
    // Prepare workout data
    const workoutData = {
      exerciseId,
      sets,
      timestamp,
      notes
    };
    
    // Add the workout
    const workoutsRef = db.ref(`workouts/${dateKey}`);
    const newWorkoutRef = workoutsRef.push();
    await newWorkoutRef.set(workoutData);
    
    console.log(`Workout added successfully with ID: ${newWorkoutRef.key}`);
    return { id: newWorkoutRef.key, ...workoutData };
    
  } catch (error) {
    console.error('Error adding workout:', error);
    throw error;
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

/**
 * Delete a workout by ID
 * @param {string} dateKey - Date key in YYYYMMDD format
 * @param {string} workoutId - Workout ID to delete
 */
async function deleteWorkout(dateKey, workoutId) {
  const db = ensureFirebaseInitialized();
  
  try {
    const workoutRef = db.ref(`workouts/${dateKey}/${workoutId}`);
    await workoutRef.remove();
    console.log(`Workout ${workoutId} deleted successfully`);
    return true;
  } catch (error) {
    console.error('Error deleting workout:', error);
    throw error;
  }
}

// Export the functions
module.exports = {
  getAllWorkouts,
  getWorkoutsByDateRange,
  addWorkout,
  deleteWorkout,
  formatDateKey
};