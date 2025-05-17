// testWorkoutUtils.js
const workoutUtils = require('./workoutUtils');

async function runTests() {
  try {
    console.log('===== WORKOUT TRACKER FIREBASE TESTS =====');
    
    // 1. Get all workouts (or create initial one if none exist)
    console.log('\n1. Fetching all workouts...');
    let allWorkouts = await workoutUtils.getAllWorkouts();
    
    if (!allWorkouts) {
      console.log('No workouts found. Creating an initial workout...');
      
      // Add a sample workout
      const today = new Date();
      await workoutUtils.addWorkout(
        today,
        'pushups', // Make sure this exercise ID exists in your exercises data
        [
          { weight: 0, reps: 15 },
          { weight: 0, reps: 12 },
          { weight: 0, reps: 10 }
        ],
        'Initial test workout'
      );
      
      // Fetch workouts again
      allWorkouts = await workoutUtils.getAllWorkouts();
      console.log('Created initial workout and fetched all workouts:');
    } else {
      console.log('Found existing workouts:');
    }
    
    // Display workout dates
    console.log('Workout dates:', Object.keys(allWorkouts));
    
    // 2. Add a new workout
    console.log('\n2. Adding a new workout...');
    const newWorkout = await workoutUtils.addWorkout(
      new Date(),
      'dips', // Make sure this exercise ID exists in your exercises data
      [
        { weight: 0, reps: 12 },
        { weight: 0, reps: 10 },
        { weight: 0, reps: 8 }
      ],
      'Testing the workout tracker'
    );
    console.log('New workout added:', newWorkout);
    
    // 3. Get workouts by date range (last 7 days)
    console.log('\n3. Fetching workouts from the last 7 days...');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    const recentWorkouts = await workoutUtils.getWorkoutsByDateRange(startDate, endDate);
    console.log('Recent workouts:', Object.keys(recentWorkouts));
    
    // Count workouts in this period
    let workoutCount = 0;
    Object.values(recentWorkouts).forEach(dateWorkouts => {
      workoutCount += Object.keys(dateWorkouts).length;
    });
    console.log(`Found ${workoutCount} workouts in the last 7 days`);
    
    // Get today's date key
    const todayKey = workoutUtils.formatDateKey(new Date());
    const todayWorkouts = recentWorkouts[todayKey] || {};
    
    // Choose a workout to delete (the one we just added)
    const workoutIdToDelete = newWorkout.id;
    
    // 4. Delete a workout
    console.log(`\n4. Deleting workout ${workoutIdToDelete}...`);
    await workoutUtils.deleteWorkout(todayKey, workoutIdToDelete);
    
    // 5. Verify deletion by fetching all workouts again
    console.log('\n5. Verifying deletion by fetching all workouts again...');
    const updatedWorkouts = await workoutUtils.getAllWorkouts();
    
    // Check if workout exists in today's workouts
    const todayUpdatedWorkouts = updatedWorkouts[todayKey] || {};
    if (todayUpdatedWorkouts[workoutIdToDelete]) {
      console.log('Error: Workout still exists after deletion!');
    } else {
      console.log('Success: Workout was deleted successfully');
    }
    
    console.log('\n===== TESTS COMPLETED =====');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
runTests();