// exerciseInitializer.js
const firebaseModule = require('./firebase');
const admin = require('firebase-admin');

async function initializeExerciseData() {
  try {
    // Initialize Firebase connection (if not already initialized)
    if (!firebaseModule.getDb()) {
      firebaseModule.initializeFirebase();
    }
    
    // Get the admin database reference
    const db = firebaseModule.getDb();
    
    console.log('Connected to Firebase successfully');
    
    // Check if 'exercises' data exists
    const exercisesRef = db.ref('exercises');
    const snapshot = await exercisesRef.once('value');
    
    if (snapshot.exists()) {
      console.log('Exercises data already exists:');
      // Just log count to avoid large output
      const exercisesData = snapshot.val();
      console.log(`Found ${Object.keys(exercisesData).length} exercises in the database`);
      return;
    }
    
    // If 'exercises' doesn't exist, create initial data from your original shapes
    console.log('Exercises data does not exist. Creating initial exercise data...');
    
    // Define exercise attributes from your original code
    const shapes = {
        "Dips": "circle",
        "Push Ups": "circle",
        "Pull Ups": "rectRot",
        "Chin Ups": "rectRot",
        "Nordic Curls": "triangle",
        "Sit Ups": "triangle",

        "Dumbbell Flat Bench": "circle",
        "Dumbbell Incline Bench": "circle",
        "Barbell Flat Bench": "rectRot",
        "Barbell Incline Bench": "rectRot",
        "Low To High Cable Chest Fly": "triangle",
        "High To Low Cable Crossover": "triangle",
        "Flies Flat": "rect",
        "Flies Incline": "rect",
        "Cable Flies": "rectRounded",
        "Flies Decline": "rectRounded",
        "Barbell Decline Bench": "cross",
        "Dumbbell Decline Bench": "crossRot",

        "Deadlifts": "circle",
        "T-Bar Rows": "circle",
        "Barbell Rows": "rectRot",
        "Dumbbell Rows": "rectRot",
        "Lat Pulldowns": "triangle",
        "Single Arm Kneeling Row": "triangle",
        "Barbell Shrug": "rect",
        "Dumbbell Shrug": "rect",
        "Cable Rows": "rectRounded",
        "Cable Rope Pullovers": "rectRounded",

        "Side Dumbbell Lat Raise": "circle",
        "Rear Dumbbell Lat Raise": "circle",
        "Standing Cable Rear Delt Fly": "rectRot",
        "Single Arm Reverse Fly": "rectRot",
        "Overhead Press": "triangle",
        "Dumbbell Press": "triangle",
        "Side Cable Lateral Raise": "rect",
        "Front Cable Raise": "rect",
        "Rear Delt Row": "rectRounded",
        "Face Pulls": "rectRounded",
        "Side Shoulder Rotation": "cross",

        "Dumbbell Bicep Curls": "circle",
        "Barbell Bicep Curls": "circle",
        "Dumbbell Reverse Curl": "rectRot",
        "Barbell Reverse Curl": "rectRot",
        "Cable Curl": "triangle",
        "Hammer Curl": "triangle",
        "Skull Crushers": "rect",
        "Tricep Pulldowns": "rect",
        "Wrist Curls": "rectRounded",
        "Reverse Wrist Curls": "rectRounded",
        "Overhead Extensions": "cross",
        "Wrist Rollers": "crossRot",

        "Squats": "circle",
        "Hip Thrusts": "circle",
        "Bulgarian Split Squats": "rectRot",
        "Lunges": "rectRot",
        "Glute Kickbacks": "triangle",
        "Hamstring Curls": "triangle",
        "Leg Extensions": "rect",
        "Leg Raises": "rect",

        "Tib Raises": "circle",
        "Hip Abductor Raises": "triangle",
        "Donkey Calf Raises": "rectRot",
        "Seated Calf Raises": "rectRot",
        "Cable Abductor Raise": "rect",
        "Fire Hydrant": "rect",
    };
    
    const borderColor = {
        "Dips": "#b5a4da",
        "Push Ups": "#b5a4da",
        "Pull Ups": "#b5a4da",
        "Chin Ups": "#b5a4da",
        "Nordic Curls": "#b5a4da",
        "Sit Ups": "#b5a4da",

        "Dumbbell Flat Bench": "#f44336",
        "Dumbbell Incline Bench": "#f44336",
        "Barbell Flat Bench": "#f44336",
        "Barbell Incline Bench": "#f44336",
        "Low To High Cable Chest Fly": "#f44336",
        "High To Low Cable Crossover": "#f44336",
        "Flies Flat": "#f44336",
        "Flies Incline": "#f44336",
        "Cable Flies": "#f44336",
        "Flies Decline": "#f44336",
        "Barbell Decline Bench": "#f44336",
        "Dumbbell Decline Bench": "#f44336",

        "Deadlifts": "#ea9999",
        "T-Bar Rows": "#ea9999",
        "Barbell Rows": "#ea9999",
        "Dumbbell Rows": "#ea9999",
        "Lat Pulldowns": "#ea9999",
        "Single Arm Kneeling Row": "#ea9999",
        "Barbell Shrug": "#ea9999",
        "Dumbbell Shrug": "#ea9999",
        "Cable Rows": "#ea9999",
        "Cable Rope Pullovers": "#ea9999",

        "Side Dumbbell Lat Raise": "#ffad3f",
        "Rear Dumbbell Lat Raise": "#ffad3f",
        "Standing Cable Rear Delt Fly": "#ffad3f",
        "Single Arm Reverse Fly": "#ffad3f",
        "Overhead Press": "#ffad3f",
        "Dumbbell Press": "#ffad3f",
        "Side Cable Lateral Raise": "#ffad3f",
        "Front Cable Raise": "#ffad3f",
        "Rear Delt Row": "#ffad3f",
        "Face Pulls": "#ffad3f",
        "Side Shoulder Rotation": "#ffad3f",

        "Dumbbell Bicep Curls": "#93c47d",
        "Barbell Bicep Curls": "#93c47d",
        "Dumbbell Reverse Curl": "#93c47d",
        "Barbell Reverse Curl": "#93c47d",
        "Cable Curl": "#93c47d",
        "Hammer Curl": "#93c47d",
        "Skull Crushers": "#93c47d",
        "Tricep Pulldowns": "#93c47d",
        "Wrist Curls": "#93c47d",
        "Reverse Wrist Curls": "#93c47d",
        "Overhead Extensions": "#93c47d",
        "Wrist Rollers": "#93c47d",

        "Squats": "#6d9eeb",
        "Hip Thrusts": "#6d9eeb",
        "Bulgarian Split Squats": "#6d9eeb",
        "Lunges": "#6d9eeb",
        "Glute Kickbacks": "#6d9eeb",
        "Hamstring Curls": "#6d9eeb",
        "Leg Extensions": "#6d9eeb",
        "Leg Raises": "#6d9eeb",

        "Tib Raises": "#cadcfd",
        "Hip Abductor Raises": "#cadcfd",
        "Donkey Calf Raises": "#cadcfd",
        "Seated Calf Raises": "#cadcfd",
        "Cable Abductor Raise": "#cadcfd",
        "Fire Hydrant": "#cadcfd",
    };
    
    const backgroundColor = {
        "Dips": "#b5a4da",
        "Push Ups": "#000000",
        "Pull Ups": "#b5a4da",
        "Chin Ups": "#000000",
        "Nordic Curls": "#b5a4da",
        "Sit Ups": "#000000",

        "Dumbbell Flat Bench": "#f44336",
        "Dumbbell Incline Bench": "#000000",
        "Barbell Flat Bench": "#f44336",
        "Barbell Incline Bench": "#000000",
        "Low To High Cable Chest Fly": "#f44336",
        "High To Low Cable Crossover": "#000000",
        "Flies Flat": "#f44336",
        "Flies Incline": "#000000",
        "Cable Flies": "#f44336",
        "Flies Decline": "#000000",
        "Barbell Decline Bench": "#f44336",
        "Dumbbell Decline Bench": "#f44336",

        "Deadlifts": "#ea9999",
        "T-Bar Rows": "#000000",
        "Barbell Rows": "#ea9999",
        "Dumbbell Rows": "#000000",
        "Lat Pulldowns": "#ea9999",
        "Single Arm Kneeling Row": "#000000",
        "Barbell Shrug": "#ea9999",
        "Dumbbell Shrug": "#000000",
        "Cable Rows": "#ea9999",
        "Cable Rope Pullovers": "#000000",

        "Side Dumbbell Lat Raise": "#ffad3f",
        "Rear Dumbbell Lat Raise": "#000000",
        "Standing Cable Rear Delt Fly": "#ffad3f",
        "Single Arm Reverse Fly": "#000000",
        "Overhead Press": "#ffad3f",
        "Dumbbell Press": "#000000",
        "Side Cable Lateral Raise": "#ffad3f",
        "Front Cable Raise": "#000000",
        "Rear Delt Row": "#ffad3f",
        "Face Pulls": "#000000",
        "Side Shoulder Rotation": "#ffad3f",

        "Dumbbell Bicep Curls": "#93c47d",
        "Barbell Bicep Curls": "#000000",
        "Dumbbell Reverse Curl": "#93c47d",
        "Barbell Reverse Curl": "#000000",
        "Cable Curl": "#93c47d",
        "Hammer Curl": "#000000",
        "Skull Crushers": "#93c47d",
        "Tricep Pulldowns": "#000000",
        "Wrist Curls": "#93c47d",
        "Reverse Wrist Curls": "#000000",
        "Overhead Extensions": "#93c47d",
        "Wrist Rollers": "#93c47d",

        "Squats": "#6d9eeb",
        "Hip Thrusts": "#000000",
        "Bulgarian Split Squats": "#6d9eeb",
        "Lunges": "#000000",
        "Glute Kickbacks": "#6d9eeb",
        "Hamstring Curls": "#000000",
        "Leg Extensions": "#6d9eeb",
        "Leg Raises": "#000000",

        "Tib Raises": "#cadcfd",
        "Hip Abductor Raises": "#cadcfd",
        "Donkey Calf Raises": "#cadcfd",
        "Seated Calf Raises": "#000000",
        "Cable Abductor Raise": "#cadcfd",
        "Fire Hydrant": "#000000",
    };
    
    // Define muscle groups from your original code
    const muscleGroups = [
        "Calisthenics",
        "Chest",
        "Back",
        "Delts",
        "Arms",
        "Upper Legs",
        "Lower Legs"
    ];
    
    // Map exercises to their muscle groups
    const exerciseGroups = {};
    
    // Calisthenics exercises
    ["Dips", "Push Ups", "Pull Ups", "Chin Ups", "Nordic Curls", "Sit Ups"].forEach(exercise => {
        exerciseGroups[exercise] = "Calisthenics";
    });
    
    // Chest exercises
    ["Dumbbell Flat Bench", "Dumbbell Incline Bench", "Barbell Flat Bench", "Barbell Incline Bench", 
     "Low To High Cable Chest Fly", "High To Low Cable Crossover", "Flies Flat", "Flies Incline", 
     "Cable Flies", "Flies Decline", "Barbell Decline Bench", "Dumbbell Decline Bench"].forEach(exercise => {
        exerciseGroups[exercise] = "Chest";
    });
    
    // Back exercises
    ["Deadlifts", "T-Bar Rows", "Barbell Rows", "Dumbbell Rows", "Lat Pulldowns", 
     "Single Arm Kneeling Row", "Barbell Shrug", "Dumbbell Shrug", "Cable Rows", 
     "Cable Rope Pullovers"].forEach(exercise => {
        exerciseGroups[exercise] = "Back";
    });
    
    // Delts exercises
    ["Side Dumbbell Lat Raise", "Rear Dumbbell Lat Raise", "Standing Cable Rear Delt Fly", 
     "Single Arm Reverse Fly", "Overhead Press", "Dumbbell Press", "Side Cable Lateral Raise", 
     "Front Cable Raise", "Rear Delt Row", "Face Pulls", "Side Shoulder Rotation"].forEach(exercise => {
        exerciseGroups[exercise] = "Delts";
    });
    
    // Arms exercises
    ["Dumbbell Bicep Curls", "Barbell Bicep Curls", "Dumbbell Reverse Curl", "Barbell Reverse Curl", 
     "Cable Curl", "Hammer Curl", "Skull Crushers", "Tricep Pulldowns", "Wrist Curls", 
     "Reverse Wrist Curls", "Overhead Extensions", "Wrist Rollers"].forEach(exercise => {
        exerciseGroups[exercise] = "Arms";
    });
    
    // Upper Legs exercises
    ["Squats", "Hip Thrusts", "Bulgarian Split Squats", "Lunges", "Glute Kickbacks", 
     "Hamstring Curls", "Leg Extensions", "Leg Raises"].forEach(exercise => {
        exerciseGroups[exercise] = "Upper Legs";
    });
    
    // Lower Legs exercises
    ["Tib Raises", "Hip Abductor Raises", "Donkey Calf Raises", "Seated Calf Raises", 
     "Cable Abductor Raise", "Fire Hydrant"].forEach(exercise => {
        exerciseGroups[exercise] = "Lower Legs";
    });
    
    // Create exercise entries
    const exercises = {};
    
    // Convert each exercise to the Firebase format
    Object.keys(shapes).forEach(exerciseName => {
        // Ensure the exercise is in exerciseGroups
        if (!exerciseGroups[exerciseName]) {
            console.warn(`Warning: Exercise "${exerciseName}" not assigned to a muscle group. Skipping.`);
            return;
        }

        // Convert name to a valid Firebase key (lowercase, no spaces)
        const exerciseId = exerciseName
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');
      
        exercises[exerciseId] = {
            name: exerciseName,
            muscleGroup: exerciseGroups[exerciseName],
            pointStyle: shapes[exerciseName],
            borderColor: borderColor[exerciseName],
            backgroundColor: backgroundColor[exerciseName]
        };
    });
    
    // Save to Firebase
    await exercisesRef.set(exercises);
    console.log(`Initial exercise data created successfully! Added ${Object.keys(exercises).length} exercises.`);
    
    // Print all exercise IDs for reference
    console.log("Exercise IDs for reference:");
    Object.keys(exercises).forEach(id => {
        console.log(`${exercises[id].name} => "${id}"`);
    });
    
  } catch (error) {
    console.error('Error initializing exercise data:', error);
  }
}

// If this file is run directly, execute the function
if (require.main === module) {
    initializeExerciseData();
}

// Export the function for use in other modules
module.exports = { initializeExerciseData };