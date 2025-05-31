// WorkoutChart.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import './WorkoutChart.css';
import { set } from 'date-fns';

// Register Chart.js components
Chart.register(...registerables);


// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCLOgmLbTZxtbV2YpjfjwBPI0rhJ_9OJr8",
    authDomain: "level-tracker-f67f6.firebaseapp.com",
    databaseURL: "https://level-tracker-f67f6-default-rtdb.firebaseio.com",
    projectId: "level-tracker-f67f6",
    storageBucket: "level-tracker-f67f6.appspot.com",
    messagingSenderId: "121770062751",
    appId: "1:121770062751:web:eb68d1e10a97ecb09c03aa",
    measurementId: "G-HBPPGTG7E2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
let today = new Date();
let currentDay = today.getDate().toString();
let isCurrentMonth;

const DateSidebar = ({ dateRange, setDateRange }) => {


    // Get current date to highlight active month
    const currentYear = dateRange.startDate.getFullYear().toString();
    const currentMonth = dateRange.startDate.getMonth();

    const [expandedYears, setExpandedYears] = useState({
        '2024': currentYear === '2024',
        '2025': currentYear === '2025',
        '2026': currentYear === '2026',
        '2027': currentYear === '2027',
        '2028': currentYear === '2028',
        '2029': currentYear === '2029',
        '2030': currentYear === '2030'
    });

    // Helper to convert month index to name
    const getMonthName = (monthIndex) => {
        return new Date(2000, monthIndex, 1).toLocaleString('default', { month: 'long' });
    };

    // Toggle year expansion
    const toggleYear = (year) => {
        setExpandedYears(prev => ({
            ...prev,
            [year]: !prev[year]
        }));
    };

    // Handle month selection
    const handleMonthSelect = (year, monthIndex) => {
        const startDate = new Date(parseInt(year), monthIndex, 1);
        const endDate = new Date(parseInt(year), monthIndex + 1, 0);

        setDateRange({
            startDate,
            endDate
        });
    };

    // Generate years from 2024 to 2030
    const years = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

    return (
        <div className="date-sidebar">
            {years.map(year => (
                <div key={year} className="year-section">
                    <div
                        className="year-header"
                        onClick={() => toggleYear(year)}
                    >
                        <span className={`arrow ${expandedYears[year] ? 'expanded' : 'collapsed'}`}>
                            {expandedYears[year] ? '▼' : '▶'}
                        </span>
                        <span className="year-text">{year}</span>
                    </div>

                    {expandedYears[year] && (
                        <div className="months-container">
                            {/* Generate months, but for 2024 start from August */}
                            {Array.from({ length: 12 }, (_, i) => i)
                                .filter(monthIndex => year !== '2024' || monthIndex >= 7) // Start from August for 2024
                                .map(monthIndex => {
                                    const isActive =
                                        currentYear === year &&
                                        currentMonth === monthIndex;

                                    return (
                                        <div
                                            key={monthIndex}
                                            className={`month-item ${isActive ? 'active' : ''}`}
                                            onClick={() => handleMonthSelect(year, monthIndex)}
                                        >
                                            {getMonthName(monthIndex)}
                                        </div>
                                    );
                                })
                            }
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const WorkoutChart = () => {
    console.log("WorkoutChart component rendered");
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    // State variables
    const [mode, setMode] = useState('strength'); // 'workout' or 'cardio'
    const [metricType, setMetricType] = useState('distance');
    const [exercises, setExercises] = useState({}); //list of exercises pulled from firebase
    const [workouts, setWorkouts] = useState({});   //list of workouts pulled from firebase
    const lastToggleActivityRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [cardioExercises, setCardioExercises] = useState({});
    const [cardioWorkouts, setCardioWorkouts] = useState({});
    const [selectedCardioActivities, setSelectedCardioActivities] = useState([]);

    // ... [rest of existing state and useEffects]

    // Filter activities based on search term
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        // day 0 of next month = last day of current month
        return { startDate, endDate };
    });

    // Muscle groups definition (from your original code)
    const muscleGroups = {
        "Calisthenics": { color: "#b4a4da", order: 1 },
        "Chest": { color: "#f44336", order: 2 },
        "Back": { color: "#ea9999", order: 3 },
        "Delts": { color: "#ffad3f", order: 4 },
        "Arms": { color: "#93c47d", order: 5 },
        "Upper Legs": { color: "#6d9eeb", order: 6 },
        "Lower Legs": { color: "#cadcfd", order: 7 }
    };



    const [selectedGroups, setSelectedGroups] = useState(Object.keys(muscleGroups));
    const labelColors = ['#b4a4da', '#f44336', '#ea9999', '#ffad3f', '#93c47d', '#6c9eeb', '#cadcfd'];
    const CalisthenicsList = new Set(["Dips", "Push Ups", "Pull Ups", "Chin Ups", "Nordic Curls", "Sit Ups"]);

    const [filteredActivities, setFilteredActivities] = useState([]);
    const [selectedActivities, setSelectedActivities] = useState([]);

    // Initialize muscle groups state
    // Initialize muscle groups state
    useEffect(() => {
        if (selectedGroups.length === 0) {
            setSelectedGroups(Object.keys(muscleGroups));
        }

        // Fetch exercises data
        console.log("initializing exercises");
        const exercisesRef = ref(database, 'exercises');
        const unsubscribe = onValue(exercisesRef, (snapshot) => {
            const data = snapshot.val() || {};
            setExercises(data);
        });

        // Fetch cardio exercises
        const cardioExercisesRef = ref(database, 'cardioExercises');
        const cardioUnsubscribe = onValue(cardioExercisesRef, (snapshot) => {
            const data = snapshot.val() || {};
            setCardioExercises(data);

            // Initialize selected cardio activities
            if (Object.keys(data).length > 0 && selectedCardioActivities.length === 0) {
                setSelectedCardioActivities(Object.keys(data));
            }
        });

        return () => {
            unsubscribe();
            cardioUnsubscribe();
        };
    }, []);

    // Add this useEffect near the other useEffects in your WorkoutChart component
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!event.ctrlKey && event.key === 'Tab') {
                event.preventDefault(); // Prevent default browser tab switching

                // Toggle between strength and cardio mode
                setMode(prevMode => {
                    const newMode = prevMode === 'strength' ? 'cardio' : 'strength';

                    // Reset Y-axis reverse when switching modes
                    if (chartInstance.current) {
                        chartInstance.current.options.scales.y.reverse = false;
                    }

                    return newMode;
                });
            }
        };

        // Add event listener
        document.addEventListener('keydown', handleKeyDown);

        // Cleanup function to remove event listener
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Empty dependency array since we only want to set this up once

    // Fetch workouts based on date range
    // Add this fix to the useEffect for fetching workouts based on date range
    // Fetch workouts based on date range and current mode
    useEffect(() => {
        if (chartInstance.current) {
            // Update x-axis min and max when month changes
            chartInstance.current.options.scales.x.min = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1).getTime();
            chartInstance.current.options.scales.x.max = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth() + 1, 0).getTime();
        }

        if (!dateRange.startDate || !dateRange.endDate) return;

        // Reset legend filtering when changing months
        setSelectedGroups(Object.keys(muscleGroups));
        lastToggleActivityRef.current = null;

        // Get year and month for the path
        const year = dateRange.startDate.getFullYear().toString();
        const month = (dateRange.startDate.getMonth() + 1).toString().padStart(2, '0');

        if (mode === 'strength') {
            // Fetch strength workouts
            console.log(`Fetching strength workouts for ${year}/${month}`);
            const monthWorkoutsRef = ref(database, `workouts/${year}/${month}`);

            const unsubscribe = onValue(monthWorkoutsRef, (snapshot) => {
                const monthData = snapshot.val() || {};
                setWorkouts(monthData);
            });

            return () => unsubscribe();
        } else {
            // Fetch cardio workouts
            console.log(`Fetching cardio workouts for ${year}/${month}`);
            const cardioMonthRef = ref(database, `cardio/${year}/${month}`);

            const unsubscribe = onValue(cardioMonthRef, (snapshot) => {
                const monthData = snapshot.val() || {};
                setCardioWorkouts(monthData);
            });

            return () => unsubscribe();
        }
    }, [dateRange, mode]); // Add mode as a dependency

    // Process data and update chart
    useEffect(() => {
        if ((mode === 'strength' && Object.keys(exercises).length === 0) ||
            (mode === 'cardio' && Object.keys(cardioExercises).length === 0)) {
            return; // Only wait for appropriate exercises to load
        }

        console.log(`Updating chart for ${mode} mode with ${metricType} metric type`);
        updateChart();
        updateChartMode(); // Add this line
    }, [
        exercises,
        workouts,
        cardioExercises,
        cardioWorkouts,
        selectedActivities,
        selectedCardioActivities,
        selectedGroups,
        mode,
        metricType
    ]);


    const displayedActivities = useMemo(() => {
        if (mode === 'strength') {
            return filteredActivities.filter(activity =>
                activity.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        } else {
            // In cardio mode, return cardio exercises
            return Object.entries(cardioExercises)
                .filter(([id, exercise]) =>
                    exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(([id, exercise]) => ({
                    id,
                    name: exercise.name,
                    selected: selectedCardioActivities.includes(id)
                }));
        }
    }, [
        mode,
        filteredActivities,
        cardioExercises,
        selectedCardioActivities,
        searchTerm
    ]);


    useEffect(() => {
        console.log("updating filtered activities");

        // Store current filter state before updating
        const currentSelectedIds = new Set(selectedActivities);
        const isFilteringByLegend = selectedGroups.length < Object.keys(muscleGroups).length; // FIX: Changed from length === 1
        const currentLegendFilter = selectedGroups; // FIX: Store all selected groups, not just one

        // Detect if we're in "ONLY" mode - a single selected activity
        const isInOnlyMode = currentSelectedIds.size === 1 && filteredActivities.length > 1;

        // Reset everything if workouts object is empty
        if (Object.keys(workouts).length === 0) {
            console.log("No workouts found for this month - clearing filters panel");
            setFilteredActivities([]);
            setSelectedActivities([]);
            return;
        }

        // Check if exercises data is loaded
        if (Object.keys(exercises).length === 0) return;

        // Get the list of exercises that exist in the current month's workouts
        const exercisesInCurrentMonth = new Set();

        // Loop through all workouts for the current month
        Object.keys(workouts).forEach(dateKey => {
            const exercisesForDate = workouts[dateKey];
            // Add each exercise ID to our set
            Object.keys(exercisesForDate).forEach(exerciseId => {
                exercisesInCurrentMonth.add(exerciseId);
            });
        });

        // If we found no exercises in this month, clear the filters
        if (exercisesInCurrentMonth.size === 0) {
            console.log("No exercises found in workouts for this month");
            setFilteredActivities([]);
            setSelectedActivities([]);
            return;
        }

        // Create a map of previous activity states for reference
        const previousActivityMap = new Map();
        filteredActivities.forEach(activity => {
            previousActivityMap.set(activity.id, {
                selected: activity.selected,
                muscleGroup: activity.muscleGroup
            });
        });

        // Transform only the exercises that exist in the current month
        let activitiesList = Array.from(exercisesInCurrentMonth)
            .filter(exerciseId => exercises[exerciseId]) // Make sure the exercise exists in our exercises object
            .map(exerciseId => {
                const exercise = exercises[exerciseId];
                const previous = previousActivityMap.get(exerciseId);
                const isNewActivity = !previous; // This is a newly added activity

                // Determine if this activity should be selected based on your rules:
                let shouldBeSelected;

                if (isInOnlyMode) {
                    // If in ONLY mode, only the single previously selected activity should be selected
                    shouldBeSelected = currentSelectedIds.has(exerciseId);
                } else if (isFilteringByLegend) {
                    // FIX: Check if the exercise belongs to any of the selected groups
                    const belongsToFilteredGroup = selectedGroups.includes(exercise.muscleGroup);
                    const hasPartialSelectionInGroup = filteredActivities.some(a =>
                        selectedGroups.includes(a.muscleGroup) && !a.selected
                    );

                    shouldBeSelected = belongsToFilteredGroup &&
                        (!isNewActivity || !hasPartialSelectionInGroup);
                } else {
                    // Normal case - maintain previous selection, new items are selected
                    shouldBeSelected = isNewActivity || (previous && previous.selected);
                }

                return {
                    id: exerciseId,
                    name: exercise.name,
                    muscleGroup: exercise.muscleGroup,
                    selected: shouldBeSelected
                };
            });

        // FIX: If filtering by legend, only show activities from the selected muscle groups
        if (isFilteringByLegend) {
            activitiesList = activitiesList.filter(activity =>
                selectedGroups.includes(activity.muscleGroup)
            );
        }

        // Sort by muscle group and then by name for better organization
        activitiesList.sort((a, b) => {
            // First sort by muscle group order
            const groupOrderA = muscleGroups[a.muscleGroup]?.order || 999;
            const groupOrderB = muscleGroups[b.muscleGroup]?.order || 999;

            if (groupOrderA !== groupOrderB) {
                return groupOrderA - groupOrderB;
            }

            // Then by name
            return a.name.localeCompare(b.name);
        });

        // Update the filtered activities
        setFilteredActivities(activitiesList);

        // Update selectedActivities to match
        const newSelectedActivities = activitiesList
            .filter(a => a.selected)
            .map(a => a.id);

        setSelectedActivities(newSelectedActivities);

        console.log("Filtered activities updated:", activitiesList);
        console.log("Selected activities updated:", newSelectedActivities);
    }, [exercises, workouts, dateRange, selectedGroups, filteredActivities.length]);

    const handleActivityToggle = (activityId) => {
        // If in cardio mode, handle cardio activities
        if (mode === 'cardio') {
            // Check if this is the last selected activity and if we're trying to uncheck it
            if (selectedCardioActivities.length === 1 && selectedCardioActivities[0] === activityId) {
                // If unchecking the last selected cardio activity, select all cardio activities
                console.log("Selecting all cardio activities");
                setSelectedCardioActivities(Object.keys(cardioExercises));
            } else {
                // Normal toggle behavior
                setSelectedCardioActivities(prev => {
                    if (prev.includes(activityId)) {
                        // Remove if already selected
                        return prev.filter(id => id !== activityId);
                    } else {
                        // Add if not selected
                        return [...prev, activityId];
                    }
                });
            }

            // Update chart immediately
            updateChart();
            return;
        }

        // Existing strength mode logic
        const isLastSelected = selectedActivities.length === 1 && selectedActivities[0] === activityId;

        // Get the current activity and its muscle group
        const activity = filteredActivities.find(a => a.id === activityId);
        if (!activity) return;

        // Check if we're currently filtered to specific muscle groups from legend
        const isFilteredByLegend = selectedGroups.length < Object.keys(muscleGroups).length;
        const currentFilterGroups = selectedGroups; // All currently selected groups

        if (isLastSelected) {
            // If unchecking the last selected exercise

            if (isFilteredByLegend) {
                // If we're filtered by legend, only select all activities from the current muscle groups
                const activitiesInGroups = filteredActivities.filter(a =>
                    currentFilterGroups.includes(a.muscleGroup)
                );

                // Set all activities in these groups to selected
                setFilteredActivities(prev => prev.map(activity => ({
                    ...activity,
                    selected: currentFilterGroups.includes(activity.muscleGroup)
                })));

                // Update selectedActivities to include all IDs from the filtered groups
                setSelectedActivities(activitiesInGroups.map(a => a.id));

                console.log("Selecting all activities in current filtered groups:", currentFilterGroups);
            } else {
                // If not filtered by legend, select all activities (original behavior)
                setFilteredActivities(prev => prev.map(activity => ({
                    ...activity,
                    selected: true
                })));

                const allActivityIds = filteredActivities.map(a => a.id);
                setSelectedActivities(allActivityIds);

                console.log("Selecting all activities (no legend filter)");
            }
            return;
        }

        console.log("activityToggle", activityId);

        // Create a new array of selected or deselected activities
        let newSelectedActivities;
        if (selectedActivities.includes(activityId)) {
            // Removing this activity
            newSelectedActivities = selectedActivities.filter(id => id !== activityId);
        } else {
            // Adding this activity
            newSelectedActivities = [...selectedActivities, activityId];
        }

        // Update the filteredActivities to match
        setFilteredActivities(prev => prev.map(act => ({
            ...act,
            selected: newSelectedActivities.includes(act.id)
        })));

        // Update selectedActivities
        setSelectedActivities(newSelectedActivities);

        // DON'T update muscle groups when toggling individual activities
        // The muscle group selection should remain independent of individual activity selection
        // Remove this entire block that was causing the unwanted muscle group filtering

        console.log("Updated selectedActivities:", newSelectedActivities);
        console.log("Legend filter active:", isFilteredByLegend ? currentFilterGroups : "none");
    };

    const handleOnlyClick = (activityId) => {
        console.log("handleOnlyClick", activityId);

        // Handle cardio mode
        if (mode === 'cardio') {
            // Select only this cardio activity
            setSelectedCardioActivities([activityId]);

            // Update chart immediately
            updateChart();
            return;
        }

        // Original strength mode logic
        const clickedActivity = filteredActivities.find(a => a.id === activityId);
        if (!clickedActivity) return;

        // Update filteredActivities to select only this one
        setFilteredActivities(prev => prev.map(activity => ({
            ...activity,
            selected: activity.id === activityId
        })));

        // Update selectedActivities
        setSelectedActivities([activityId]);

        // REMOVE THIS LINE - Don't change selectedGroups (legend)
        // setSelectedGroups([clickedActivity.muscleGroup]);
    };

    const getCardioIconPath = (exerciseId) => {
        const exercise = cardioExercises[exerciseId];
        if (!exercise) return null;

        const pointStyle = exercise.pointStyle || 'circle';
        const backgroundColor = exercise.backgroundColor || '#ffffff';
        const needsStrokeVersion = backgroundColor === '#000000';
        const borderColor = exercise.borderColor;
        console.log("borderColor", borderColor);
        // Map pointStyle to shape component
        let groupPrefix;
        switch (borderColor) {
            case "#b5a4da":
                groupPrefix = 'Calisthenics_';
                break;
            case "#f44336":
                groupPrefix = 'Chest_';
                break;
            case "#ea9999":
                groupPrefix = 'Back_';
                break;
            case "#ffad3f":
                groupPrefix = 'Delts_';
                break;
            case "#93c47d":
                groupPrefix = 'Arms_';
                break;
            case "#6d9eeb":
                groupPrefix = 'Upper Legs_';
                break;
            case "#cadcfd":
                groupPrefix = 'Lower Legs_';
                break;
        }

        let shapeComponent;
        switch (pointStyle.toLowerCase()) {
            case 'triangle':
                shapeComponent = needsStrokeVersion ? 'TriangleStroke' : 'Triangle';
                break;
            case 'rectrot':
                shapeComponent = needsStrokeVersion ? 'RectRotStroke' : 'RectRot';
                break;
            case 'rect':
                shapeComponent = needsStrokeVersion ? 'RectStroke' : 'Rect';
                break;
            case 'rectrounded':
                shapeComponent = needsStrokeVersion ? 'RectRoundedStroke' : 'RectRounded';
                break;
            case 'cross':
                shapeComponent = 'Cross';
                break;
            case 'crossrot':
                shapeComponent = 'CrossRot';
                break;
            case 'circle':
            default:
                shapeComponent = needsStrokeVersion ? 'CircleStroke' : 'Circle';
                break;
        }

        // Use Lower Legs prefix for cardio icons

        // Construct the filename and URL
        const fileName = `${groupPrefix}${shapeComponent}.svg`;
        const safeFile = encodeURIComponent(fileName);

        return `${process.env.PUBLIC_URL}/icons/${safeFile}`;
    };

    // Add this function near the top of your component
    const getExerciseIconPath = (exercise) => {
        if (!exercise) return null;

        const muscleGroup = exercise.muscleGroup;
        const pointStyle = exercise.pointStyle || 'circle'; // comes from your Firebase data
        const backgroundColor = exercise.backgroundColor || '#ffffff';

        // Determine if we need the “stroke” version (for a black BG)
        const needsStrokeVersion = backgroundColor === '#000000';

        // Map pointStyle to the shape component name
        let shapeComponent;
        switch (pointStyle.toLowerCase()) {
            case 'triangle':
                shapeComponent = needsStrokeVersion ? 'TriangleStroke' : 'Triangle';
                break;
            case 'rectrot':
                shapeComponent = needsStrokeVersion ? 'RectRotStroke' : 'RectRot';
                break;
            case 'rect':
                shapeComponent = needsStrokeVersion ? 'RectStroke' : 'Rect';
                break;
            case 'rectrounded':
                shapeComponent = needsStrokeVersion ? 'RectRoundedStroke' : 'RectRounded';
                break;
            case 'cross':
                shapeComponent = 'Cross';
                break;
            case 'crossrot':
                shapeComponent = 'CrossRot';
                break;
            case 'circle':
            default:
                shapeComponent = needsStrokeVersion ? 'CircleStroke' : 'Circle';
                break;
        }

        // Map muscleGroup to the filename prefix
        let groupPrefix;
        switch (muscleGroup) {
            case 'Calisthenics':
                groupPrefix = 'Calisthenics_';
                break;
            case 'Chest':
                groupPrefix = 'Chest_';
                break;
            case 'Back':
                groupPrefix = 'Back_';
                break;
            case 'Delts':
                groupPrefix = 'Delts_';
                break;
            case 'Arms':
                groupPrefix = 'Arms_';
                break;
            case 'Upper Legs':
                groupPrefix = 'Upper Legs_';
                break;
            case 'Lower Legs':
                groupPrefix = 'Lower Legs_';
                break;
            default:
                groupPrefix = '';
        }

        // Construct filename and URL-encode it (handles spaces/case)
        const fileName = `${groupPrefix}${shapeComponent}.svg`;
        const safeFile = encodeURIComponent(fileName);

        // Use PUBLIC_URL so it respects your “homepage” path
        return `${process.env.PUBLIC_URL}/icons/${safeFile}`;
    };

    const updateChart = () => {
        console.log(`updateChart - mode: ${mode}, metricType: ${metricType}`);

        today = new Date();
        currentDay = today.getDate().toString();
        isCurrentMonth = (
            today.getMonth() === dateRange.startDate.getMonth() &&
            today.getFullYear() === dateRange.startDate.getFullYear()
        );

        const chartContext = chartRef.current?.getContext('2d');
        if (!chartContext) return;

        if (mode === 'strength') {
            updateStrengthChart();
        } else {
            updateCardioChart();
        }
    };

    // Create modified chart configuration when switching modes
    const updateChartMode = () => {
        if (!chartInstance.current) return;

        if (mode === 'cardio') {
            // Hide all strength legend items and datasets
            chartInstance.current.data.datasets.forEach((dataset, i) => {
                if (dataset.label in muscleGroups) {
                    chartInstance.current.setDatasetVisibility(i, false);
                }
            });

            // Only display cardio data
            chartInstance.current.options.plugins.legend.display = false;
        } else {
            // Show strength legend items and update visibility based on selectedGroups
            chartInstance.current.options.plugins.legend.display = true;
            chartInstance.current.data.datasets.forEach((dataset, i) => {
                chartInstance.current.setDatasetVisibility(i, selectedGroups.includes(dataset.label));
            });
        }

        chartInstance.current.update();
    };

    // Update chart with processed data
    // Modified updateChart function for new data structure
    const updateStrengthChart = () => {
        console.log("selectedActivities from update chart", selectedActivities);
        today = new Date();
        currentDay = today.getDate().toString();
        isCurrentMonth = (
            today.getMonth() === dateRange.startDate.getMonth() &&
            today.getFullYear() === dateRange.startDate.getFullYear()
        );

        const chartContext = chartRef.current?.getContext('2d');
        if (!chartContext) return;

        // Initialize data structure by muscle group
        const dict = {};
        Object.keys(muscleGroups).forEach(group => {
            dict[group] = [];
        });

        // Shape and color dictionaries
        let shapesDict = {};
        let borderColorDict = {};
        let backgroundColorDict = {};

        Object.keys(muscleGroups).forEach(group => {
            shapesDict[group] = [];
            borderColorDict[group] = [];
            backgroundColorDict[group] = [];
        });

        Object.keys(workouts).forEach(dateKey => {
            const exercisesForDate = workouts[dateKey];
            // For each exercise on this date
            Object.keys(exercisesForDate).forEach(exerciseId => {
                if (selectedActivities.length > 0 && !selectedActivities.includes(exerciseId)) {
                    return; // Skip this exercise
                }

                const workout = exercisesForDate[exerciseId];
                const exercise = exercises[exerciseId];

                if (exercise) {
                    const muscleGroup = exercise.muscleGroup;

                    // Group sets by weight to combine those with the same weight
                    const setsByWeight = {};

                    // Process sets and group by weight
                    workout.sets.forEach((set, setIndex) => {
                        const weight = set.weight;

                        if (!setsByWeight[weight]) {
                            setsByWeight[weight] = {
                                totalReps: 0,
                                reps: []
                            };
                        }

                        setsByWeight[weight].totalReps += set.reps;
                        setsByWeight[weight].reps.push(set.reps);
                    });

                    // Create data points for each unique weight
                    Object.keys(setsByWeight).forEach((weight, weightIndex) => {
                        const weightData = setsByWeight[weight];
                        const weightValue = parseInt(weight);

                        // Use corrected radius calculation that takes weight into account
                        const radius = calculateRadius(
                            weightData.totalReps,
                            weightValue,
                            CalisthenicsList.has(exercise.name)
                        );

                        // Create a single data point for each unique weight
                        if (CalisthenicsList.has(exercise.name)) {
                            const dataPoint = {
                                x: new Date(
                                    parseInt(dateKey.substring(0, 4)),    // Year
                                    parseInt(dateKey.substring(4, 6)) - 1, // Month (0-based)
                                    parseInt(dateKey.substring(6, 8))     // Day
                                ).getTime(),
                                y: weightData.totalReps, // Use totalReps for Y-axis for Calisthenics
                                r: radius,
                                workout: exercise.name,
                                weight: parseInt(weight),
                                totalReps: weightData.totalReps,
                                reps: weightData.reps,
                                notes: workout.notes,
                                dateKey: dateKey,
                                exerciseId: exerciseId
                            };
                            dict[muscleGroup].push(dataPoint);
                        } else {
                            // Regular exercises use weight for Y-axis
                            const dataPoint = {
                                x: new Date(
                                    parseInt(dateKey.substring(0, 4)),    // Year
                                    parseInt(dateKey.substring(4, 6)) - 1, // Month (0-based)
                                    parseInt(dateKey.substring(6, 8))     // Day
                                ).getTime(),
                                y: parseInt(weight),
                                r: radius,
                                workout: exercise.name,
                                weight: parseInt(weight),
                                totalReps: weightData.totalReps,
                                reps: weightData.reps,
                                notes: workout.notes,
                                dateKey: dateKey,
                                exerciseId: exerciseId
                            };
                            dict[muscleGroup].push(dataPoint);
                        }

                        shapesDict[muscleGroup].push(exercise.pointStyle);
                        borderColorDict[muscleGroup].push(exercise.borderColor);
                        backgroundColorDict[muscleGroup].push(exercise.backgroundColor);
                    });
                }
            });
        });

        // Create chart datasets
        const chartData = {
            datasets: []
        };

        let hasData = false;
        Object.keys(dict).forEach((key) => {
            if (dict[key].length > 0) {
                console.log("dict[key] ", dict[key]);
                hasData = true;
                const dataset = {
                    label: key,
                    data: dict[key],
                    backgroundColor: backgroundColorDict[key],
                    borderColor: borderColorDict[key],
                    pointStyle: shapesDict[key],
                    borderWidth: 1,
                    hidden: !selectedGroups.includes(key)
                };
                chartData.datasets.push(dataset);
            }
        });

        console.log("chartData", chartData);

        // Create or update chart
        if (chartInstance.current) {
            // Completely reset the Y-axis for strength mode
            chartInstance.current.options.scales.y.min = 0;
            chartInstance.current.options.scales.y.max = 300;
            chartInstance.current.options.scales.y.title.text = 'Weight';
            chartInstance.current.options.scales.y.ticks.stepSize = 25;

            // Restore strength mode callback for ticks
            chartInstance.current.options.scales.y.ticks.callback = function (value) {
                return value % 25 === 0 ? value : '';
            };

            // Reset any bounds/grace settings that might have been set in cardio mode
            chartInstance.current.options.scales.y.bounds = 'ticks';
            chartInstance.current.options.scales.y.grace = 0;

            // Re-apply afterBuildTicks function for strength mode
            chartInstance.current.options.scales.y.afterBuildTicks = function (axis) {
                axis.max += 5;
            };

            chartInstance.current.options.plugins.tooltip.callbacks = createTooltipCallback();
            // Update the data
            chartInstance.current.data = chartData;

            console.log("hasData " + hasData);
            if (!hasData) {
                // Clear any old points
                chartInstance.current.data.datasets = [];
                chartInstance.current.options.plugins.legend.display = false;
                console.log("No data for this month - clearing chart");
                // Optionally add a "no data" message to the chart
                chartInstance.current.options.plugins.title = {
                    display: true,
                    text: 'No workout data for this month',
                    color: '#888',
                    font: { size: 16 }
                };
            } else {
                // Make sure legend is visible when we have data
                chartInstance.current.options.plugins.legend.display = true;
                chartInstance.current.options.plugins.title = {
                    display: false
                };
            }

            // re-bind legend click so it sees the latest `workouts`
            chartInstance.current.options.plugins.legend.labels.generateLabels = function (chart) {
                if (!chart.data.datasets) return [];

                // Get all muscle groups that have data in the current month
                const muscleGroupsWithData = new Set();

                // Check workouts to find all active muscle groups
                Object.keys(workouts).forEach(dateKey => {
                    const exercisesForDate = workouts[dateKey];

                    Object.keys(exercisesForDate).forEach(exerciseId => {
                        const exercise = exercises[exerciseId];
                        if (exercise && exercise.muscleGroup) {
                            muscleGroupsWithData.add(exercise.muscleGroup);
                        }
                    });
                });

                // Convert to array for easier manipulation
                const activeMuscleGroups = Array.from(muscleGroupsWithData);

                // Create labels for each active muscle group
                return activeMuscleGroups.map(groupKey => {
                    const groupColor = muscleGroups[groupKey]?.color || '#cccccc';
                    const isActive = selectedGroups.includes(groupKey);

                    // Find the dataset index for this muscle group (if it exists in the chart)
                    let datasetIndex = -1;
                    chart.data.datasets.forEach((dataset, i) => {
                        if (dataset.label === groupKey) {
                            datasetIndex = i;
                        }
                    });

                    return {
                        text: groupKey,
                        fillStyle: isActive ? groupColor : '#cccccc',
                        strokeStyle: 'transparent',
                        lineWidth: 0,
                        fontColor: isActive ? '#ffffff' : '#888888',
                        hidden: false,  // Never hide the legend item
                        datasetIndex: datasetIndex // Will be -1 if no corresponding dataset
                    };
                }).sort((a, b) => {
                    // Sort by the predefined muscle group order
                    const orderA = muscleGroups[a.text]?.order || 999;
                    const orderB = muscleGroups[b.text]?.order || 999;
                    return orderA - orderB;
                });
            };

            chartInstance.current.options.plugins.legend.onClick = (e, legendItem) => {
                console.log("legend click new", legendItem);
                console.log("selectedGroups", selectedGroups);
                console.log("Shift key pressed:", e.native.shiftKey);

                const clickedGroup = legendItem.text;

                // Check if shift key is held
                if (e.native.shiftKey) {
                    // Shift-click behavior: add/remove individual muscle groups
                    if (selectedGroups.includes(clickedGroup)) {
                        // Remove the clicked group
                        const newSelectedGroups = selectedGroups.filter(group => group !== clickedGroup);

                        // If this was the last group, select all groups instead
                        if (newSelectedGroups.length === 0) {
                            setSelectedGroups(Object.keys(muscleGroups));

                            // Make all activities visible and selected
                            const activitiesList = Array.from(
                                new Set(Object.values(workouts).flatMap(exercisesForDate =>
                                    Object.keys(exercisesForDate)
                                ))
                            )
                                .filter(exerciseId => exercises[exerciseId])
                                .map(exerciseId => {
                                    const exercise = exercises[exerciseId];
                                    return {
                                        id: exerciseId,
                                        name: exercise.name,
                                        muscleGroup: exercise.muscleGroup,
                                        selected: true
                                    };
                                });

                            // Sort activities
                            activitiesList.sort((a, b) => {
                                const groupOrderA = muscleGroups[a.muscleGroup]?.order || 999;
                                const groupOrderB = muscleGroups[b.muscleGroup]?.order || 999;

                                if (groupOrderA !== groupOrderB) {
                                    return groupOrderA - groupOrderB;
                                }

                                return a.name.localeCompare(b.name);
                            });

                            setFilteredActivities(activitiesList);
                            setSelectedActivities(activitiesList.map(a => a.id));

                            console.log("Last group removed - all groups now active");
                        } else {
                            // Update to new selected groups
                            setSelectedGroups(newSelectedGroups);

                            // Update activities to match the new selected groups
                            const exercisesInCurrentMonth = new Set();
                            Object.keys(workouts).forEach(dateKey => {
                                const exercisesForDate = workouts[dateKey];
                                Object.keys(exercisesForDate).forEach(exerciseId => {
                                    exercisesInCurrentMonth.add(exerciseId);
                                });
                            });

                            const filteredList = Array.from(exercisesInCurrentMonth)
                                .filter(exerciseId => {
                                    const exercise = exercises[exerciseId];
                                    return exercise && newSelectedGroups.includes(exercise.muscleGroup);
                                })
                                .map(exerciseId => {
                                    const exercise = exercises[exerciseId];
                                    return {
                                        id: exerciseId,
                                        name: exercise.name,
                                        muscleGroup: exercise.muscleGroup,
                                        selected: true
                                    };
                                });

                            filteredList.sort((a, b) => {
                                const groupOrderA = muscleGroups[a.muscleGroup]?.order || 999;
                                const groupOrderB = muscleGroups[b.muscleGroup]?.order || 999;

                                if (groupOrderA !== groupOrderB) {
                                    return groupOrderA - groupOrderB;
                                }

                                return a.name.localeCompare(b.name);
                            });

                            setFilteredActivities(filteredList);
                            setSelectedActivities(filteredList.map(a => a.id));

                            console.log("Removed group:", clickedGroup);
                        }
                    } else {
                        // Add the clicked group to existing selection
                        const newSelectedGroups = [...selectedGroups, clickedGroup];
                        setSelectedGroups(newSelectedGroups);

                        // Update activities to include the newly added group
                        const exercisesInCurrentMonth = new Set();
                        Object.keys(workouts).forEach(dateKey => {
                            const exercisesForDate = workouts[dateKey];
                            Object.keys(exercisesForDate).forEach(exerciseId => {
                                exercisesInCurrentMonth.add(exerciseId);
                            });
                        });

                        const filteredList = Array.from(exercisesInCurrentMonth)
                            .filter(exerciseId => {
                                const exercise = exercises[exerciseId];
                                return exercise && newSelectedGroups.includes(exercise.muscleGroup);
                            })
                            .map(exerciseId => {
                                const exercise = exercises[exerciseId];
                                return {
                                    id: exerciseId,
                                    name: exercise.name,
                                    muscleGroup: exercise.muscleGroup,
                                    selected: true
                                };
                            });

                        filteredList.sort((a, b) => {
                            const groupOrderA = muscleGroups[a.muscleGroup]?.order || 999;
                            const groupOrderB = muscleGroups[b.muscleGroup]?.order || 999;

                            if (groupOrderA !== groupOrderB) {
                                return groupOrderA - groupOrderB;
                            }

                            return a.name.localeCompare(b.name);
                        });

                        setFilteredActivities(filteredList);
                        setSelectedActivities(filteredList.map(a => a.id));

                        console.log("Added group:", clickedGroup);
                    }

                    // Clear the last toggle reference when using shift-click
                    lastToggleActivityRef.current = null;

                } else {
                    // Original click behavior (without shift)
                    // FIX: Check if clicking the only active group OR if it's the same as last toggle
                    if ((selectedGroups.length === 1 && selectedGroups[0] === clickedGroup) ||
                        lastToggleActivityRef.current === clickedGroup) {
                        // If clicking the only active group OR clicking the same group again, show all groups
                        lastToggleActivityRef.current = null;
                        setSelectedGroups(Object.keys(muscleGroups));

                        // Make all activities in original dataset visible and selected
                        const activitiesList = Array.from(
                            new Set(Object.values(workouts).flatMap(exercisesForDate =>
                                Object.keys(exercisesForDate)
                            ))
                        )
                            .filter(exerciseId => exercises[exerciseId])
                            .map(exerciseId => {
                                const exercise = exercises[exerciseId];
                                return {
                                    id: exerciseId,
                                    name: exercise.name,
                                    muscleGroup: exercise.muscleGroup,
                                    selected: true
                                };
                            });

                        // Sort activities as before
                        activitiesList.sort((a, b) => {
                            const groupOrderA = muscleGroups[a.muscleGroup]?.order || 999;
                            const groupOrderB = muscleGroups[b.muscleGroup]?.order || 999;

                            if (groupOrderA !== groupOrderB) {
                                return groupOrderA - groupOrderB;
                            }

                            return a.name.localeCompare(b.name);
                        });

                        setFilteredActivities(activitiesList);
                        setSelectedActivities(activitiesList.map(a => a.id));

                        console.log("All groups selected new click");
                    } else {
                        // If clicking a different group, show only that group
                        lastToggleActivityRef.current = clickedGroup;
                        setSelectedGroups([clickedGroup]);

                        // Filter the activities to only include ones from this muscle group
                        const exercisesInCurrentMonth = new Set();

                        // Get all exercise IDs from current month
                        Object.keys(workouts).forEach(dateKey => {
                            const exercisesForDate = workouts[dateKey];
                            Object.keys(exercisesForDate).forEach(exerciseId => {
                                exercisesInCurrentMonth.add(exerciseId);
                            });
                        });

                        // Filter to only activities of the clicked muscle group
                        const filteredList = Array.from(exercisesInCurrentMonth)
                            .filter(exerciseId =>
                                exercises[exerciseId] &&
                                exercises[exerciseId].muscleGroup === clickedGroup
                            )
                            .map(exerciseId => {
                                const exercise = exercises[exerciseId];
                                return {
                                    id: exerciseId,
                                    name: exercise.name,
                                    muscleGroup: exercise.muscleGroup,
                                    selected: true
                                };
                            });

                        // Sort the filtered activities
                        filteredList.sort((a, b) => a.name.localeCompare(b.name));

                        // Update state
                        setFilteredActivities(filteredList);
                        setSelectedActivities(filteredList.map(a => a.id));

                        console.log("Selected group: new click", clickedGroup);
                        console.log("Filtered to activities:", filteredList.length);
                    }
                }
            };

            chartInstance.current.update();
        } else {
            chartInstance.current = new Chart(chartContext, {
                type: 'bubble',
                data: chartData,
                options:
                {
                    maintainAspectRatio: false,
                    animation: { duration: 100 },
                    scales: {
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 1,
                                zeroLineColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            beginAtZero: true,
                            max: 300,
                            afterBuildTicks: function (axis) {
                                axis.max += 5;
                            },
                            title: {
                                display: true,
                                text: 'Weight',
                            },

                            ticks: {
                                font: {
                                    size: 13
                                },
                                stepSize: 25,
                                callback: function (value) {
                                    return value % 25 === 0 ? value : '';
                                }
                            }
                        },
                        x: {
                            offset: true,
                            grid: {
                                color: function (context) {
                                    return (isCurrentMonth && context.tick.label[0] === currentDay)
                                        ? '#b4a4da'
                                        : "#636363";
                                },
                                lineWidth: function (context) {
                                    return (isCurrentMonth && context.tick.label[0] === currentDay)
                                        ? 0.35
                                        : 0.13;
                                },
                                zeroLineColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            type: 'time',
                            time: {
                                unit: 'day',
                                displayFormats: {
                                    day: 'd' // Keep simple date format as we'll handle the day display in the callback
                                }
                            },
                            min: new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1).getTime(),
                            // Set max to last day of month
                            max: new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth() + 1, 0).getTime(),

                            ticks: {
                                color: '#e0e0e0',
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: 12
                                },
                                color: function (context) {
                                    return context.tick.label[0] === currentDay && isCurrentMonth ? '#b4a4da' : "#636363";
                                },
                                callback: function (value, index) {
                                    const date = new Date(value);
                                    const dayNum = date.getDate();
                                    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    return [`${dayNum}`, `${dayOfWeek}`];
                                }
                            },
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#e0e0e0',

                            bodyFont: {
                                size: 14.25
                            },
                            callbacks: createTooltipCallback()
                        },

                        legend: {
                            display: hasData,
                            labels: {
                                font: {
                                    size: 17,
                                },
                            },
                        }
                    }
                }
            });
        }
    };
    // Update chart for cardio mode
    // Update chart for cardio mode
    // Update chart for cardio mode
    const updateCardioChart = () => {
        console.log("Updating cardio chart with metric type:", metricType);

        const chartContext = chartRef.current?.getContext('2d');
        if (!chartContext) return;

        // Create a dataset for cardio data
        const datasets = [];
        const hasData = Object.keys(cardioWorkouts).length > 0;

        // Process cardio data for selected activities
        if (hasData) {
            selectedCardioActivities.forEach(exerciseId => {
                const exercise = cardioExercises[exerciseId];
                if (!exercise) return;

                const dataPoints = [];

                Object.keys(cardioWorkouts).forEach(dateKey => {
                    const dayWorkouts = cardioWorkouts[dateKey];
                    if (!dayWorkouts[exerciseId]) return;

                    // FIX: Process ALL sessions, not just the first one
                    const sessions = dayWorkouts[exerciseId].sessions;

                    sessions.forEach((session, sessionIndex) => {
                        if (!session) return;

                        // Create datapoint based on metric type
                        const dataPoint = {
                            x: new Date(
                                parseInt(dateKey.substring(0, 4)),    // Year
                                parseInt(dateKey.substring(4, 6)) - 1, // Month (0-based)
                                parseInt(dateKey.substring(6, 8))     // Day
                            ).getTime(),
                            // Y value depends on metric type
                            y: metricType === 'distance'
                                ? session.distance  // Use distance as Y for distance mode
                                : parsePaceString(session.speed.pace), // Use pace for speed mode
                            r: metricType === 'distance'
                                ? calculateRadiusFromSpeed(session.speed.mph) // Radius from speed in distance mode
                                : calculateRadiusFromDistance(session.distance), // Radius from distance in pace mode
                            exercise: exercise.name,
                            distance: session.distance,
                            pace: session.speed.pace,
                            mph: session.speed.mph,
                            resistance: session.resistance || '', // Include resistance if available
                            time: `${session.time.minutes}:${session.time.seconds.toString().padStart(2, '0')}`,
                            exerciseId,
                            sessionIndex: sessionIndex, // Add session index to distinguish multiple sessions
                            dateKey: dateKey
                        };

                        dataPoints.push(dataPoint);
                    });
                });

                // Add dataset for this exercise - MODIFIED TO ENSURE CORRECT STYLES
                if (dataPoints.length > 0) {
                    datasets.push({
                        label: exercise.name,
                        data: dataPoints,
                        backgroundColor: exercise.backgroundColor,
                        borderColor: exercise.borderColor,
                        pointStyle: exercise.pointStyle,
                        borderWidth: 1
                    });
                }
            });
        }

        // Create chart data
        const chartData = { datasets };

        // Create or update chart
        if (chartInstance.current) {
            // Update data
            chartInstance.current.data = chartData;

            // Hide legend and display no data message if no data
            if (!hasData) {
                chartInstance.current.options.plugins.legend.display = false;
                chartInstance.current.options.plugins.title = {
                    display: true,
                    text: 'No cardio data for this month',
                    color: '#888',
                    font: { size: 16 }
                };
            } else {
                chartInstance.current.options.plugins.legend.display = true;
                chartInstance.current.options.plugins.title = { display: false };
            }

            // Update Y axis title based on metric type
            chartInstance.current.options.scales.y.title.text =
                metricType === 'distance' ? 'Distance (miles)' : 'Pace (min/mile)';

            // *** FIX: Correct Y-axis scaling ***
            // Set rigid min/max values and prevent auto-scaling
            if (metricType === 'distance') {
                // Distance mode: 0-14 miles
                chartInstance.current.options.scales.y.min = 0;
                chartInstance.current.options.scales.y.max = 14;
                chartInstance.current.options.scales.y.ticks.stepSize = 1;
                chartInstance.current.options.scales.y.reverse = false;
            } else {
                // Pace mode: 6:00-20:00 min/mile
                chartInstance.current.options.scales.y.min = 4;
                chartInstance.current.options.scales.y.max = 30;
                chartInstance.current.options.scales.y.ticks.stepSize = 2;
                chartInstance.current.options.scales.y.reverse = true;
            }

            // Critical fix: Disable auto-scaling completely
            chartInstance.current.options.scales.y.bounds = 'data';
            chartInstance.current.options.scales.y.grace = 0;
            delete chartInstance.current.options.scales.y.beginAtZero; // Remove this to prevent auto-adjustment
            delete chartInstance.current.options.scales.y.afterBuildTicks; // Remove this function from strength chart

            // Force Chart.js to respect our exact min/max values
            chartInstance.current.options.scales.y.ticks.precision = 0;

            // Update tick display format
            chartInstance.current.options.scales.y.ticks.callback = function (value) {
                if (metricType === 'distance') {
                    return `${value} mi`; // Add "mi" suffix to distance values
                } else {
                    // Format pace ticks as min:sec
                    return `${Math.floor(value)}:00`;
                }
            };

            // Update tooltip
            chartInstance.current.options.plugins.tooltip.callbacks = createCardioTooltipCallback();

            // Apply changes
            chartInstance.current.update({ duration: 0 }); // Force immediate update with no animation
        } else {
            // ... rest of the chart creation code remains the same ...
        }
    };

    // Helper function to parse pace string (e.g., "8:30") to decimal value
    const parsePaceString = (paceString) => {
        if (!paceString) return 0;
        const [minutes, seconds] = paceString.split(':').map(num => parseInt(num, 10));
        return minutes + (seconds / 60);
    };

    // Calculate radius based on mph for distance mode
    const calculateRadiusFromSpeed = (mph) => {
        if (!mph) return 1;
        // Faster = bigger bubble
        return Math.min(20, Math.max(2.5 + mph / 2.5));
    };

    // Calculate radius based on distance for pace mode
    const calculateRadiusFromDistance = (distance) => {
        if (!distance) return 1;
        // Longer distance = bigger bubble
        return Math.min(20, Math.max(2 + distance / 2));
    };

    // Create tooltip callback for cardio mode
    const createCardioTooltipCallback = () => {
        return {
            label: function (context) {
                const raw = context.raw;
                if (!raw) return [];

                const tooltipLines = [
                    raw.exercise,
                    `Distance: ${raw.distance} miles`,
                    `Pace: ${raw.pace} min/mile`,
                    `Time: ${raw.time}`,
                ];

                // Only add resistance line if it exists
                if (raw.resistance) {
                    tooltipLines.push(`Resistance: ${raw.resistance}`);
                }

                return tooltipLines;
            }
        };
    };

    const createTooltipCallback = () => {
        return {
            label: function (context) {
                const raw = context.raw;
                if (!raw) return [];

                // Build tooltip content that shows combined sets
                const lines = [
                    raw.workout,
                    `Weight: ${raw.weight}lbs`,
                    `Total Reps: ${raw.totalReps}`,
                    `Reps: ${raw.reps.join(', ')}`
                ];

                if (raw.notes) {
                    lines.push(`Notes: ${raw.notes}`);
                }

                return lines;
            }
        };
    };

    const calculateRadius = (reps, weight, isCalisthenics) => {
        console.log("calculateRadius", reps, weight, isCalisthenics);
        if (isCalisthenics) {
            // For calisthenics, use weight to determine bubble size
            // Since calisthenics often has weight=0, we can use reps as fallback
            const area = weight > 0 ? weight : 1;
            return Math.sqrt(area / Math.PI) * 1.5 + 2.35;
        } else {
            // For weighted exercises, use reps to determine bubble size
            const area = reps;
            return Math.sqrt(area / Math.PI) * 1.5 + 0.75;
        }
    };

    // Handle date range change
    const handleDateChange = (field, event) => {
        const value = event.target.value;
        setDateRange(prev => ({
            ...prev,
            [field]: value ? new Date(value) : null
        }));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
            {/* Left: Date Sidebar */}
            <DateSidebar
                dateRange={dateRange}
                setDateRange={setDateRange}
            />

            {/* Mode Toggle Button */}
            <button
                className="mode-toggle-button"
                onClick={() => { setMode(mode === 'strength' ? 'cardio' : 'strength'); chartInstance.current.options.scales.y.reverse = false; }}
            >
                {mode === 'strength' ? 'Cardio' : 'Strength'}
            </button>
            {/* Metric Toggle - only visible in cardio mode */}
            {mode === 'cardio' && (
                <div className="metric-toggle">
                    <button
                        className={`metric-toggle-button ${metricType === 'distance' ? 'active' : ''}`}
                        onClick={() => setMetricType('distance')}
                    >
                        Distance
                    </button>
                    <button
                        className={`metric-toggle-button ${metricType === 'speed' ? 'active' : ''}`}
                        onClick={() => setMetricType('speed')}
                    >
                        Pace
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Title Area for Month and Year */}
                <div style={{
                    marginBottom: '8px',
                    borderRadius: '6px 6px 0 0'
                }}>
                    <h2 style={{
                        paddingTop: '2vh',
                        margin: 0,
                        color: '#C58AF9',
                        fontWeight: 'bold',
                        fontSize: '36px'
                    }}>
                        {dateRange.startDate.toLocaleString('default', { month: 'long' })} {dateRange.startDate.getFullYear()}
                    </h2>
                </div>

                {/* Chart Container */}
                <div className="chart-container">
                    <canvas ref={chartRef}></canvas>
                </div>
            </div>

            {/* Right: Filters Container */}
            <div className="filters-container">
                {/* Search input above the scrollable area */}
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Search exercises..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button
                            className="clear-search"
                            onClick={() => setSearchTerm('')}
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Scrollable area for activities */}
                {/* Scrollable area for activities */}
                <div className="filters-panel">
                    {mode === 'strength' ? (
                        // Strength mode activities
                        displayedActivities.map(activity => {
                            const exercise = exercises[activity.id];
                            const iconPath = exercise ? getExerciseIconPath(exercise) : null;

                            return (
                                <div key={activity.id} className="activity-filter">
                                    <div className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            id={`checkbox-${activity.id}`}
                                            checked={activity.selected}
                                            onChange={() => handleActivityToggle(activity.id)}
                                            className="checkbox"
                                        />
                                        {iconPath && (
                                            <img
                                                style={{ paddingLeft: '4px' }}
                                                src={iconPath}
                                                alt=""
                                                className="exercise-icon"
                                                width="16"
                                                height="16"
                                            />
                                        )}
                                        <label
                                            htmlFor={`checkbox-${activity.id}`}
                                            className="checkbox-label"
                                        >
                                            <span
                                                className="activity-name"
                                                style={{ color: muscleGroups[activity.muscleGroup]?.color || '#ffffff' }}
                                            >
                                                {activity.name}
                                            </span>
                                        </label>
                                    </div>
                                    <button
                                        className="only-button"
                                        onClick={() => handleOnlyClick(activity.id)}
                                    >
                                        ONLY
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        // Cardio mode activities - only show if there's cardio data for this month
                        // Cardio mode activities - only show if there's cardio data for this month
                        Object.keys(cardioWorkouts).length > 0 ? (
                            (() => {
                                // Define the desired order for cardio exercises
                                const cardioOrder = ['Elliptical', 'Treadmill', 'Jogging', 'Mission Peak', 'Summit'];

                                // Get the list of cardio exercises that exist in the current month's workouts
                                const cardioExercisesInCurrentMonth = new Set();
                                Object.keys(cardioWorkouts).forEach(dateKey => {
                                    const exercisesForDate = cardioWorkouts[dateKey];
                                    Object.keys(exercisesForDate).forEach(exerciseId => {
                                        cardioExercisesInCurrentMonth.add(exerciseId);
                                    });
                                });

                                // Create and sort the cardio activities - ONLY include exercises that exist in current month
                                const sortedCardioActivities = Object.entries(cardioExercises)
                                    .filter(([id, exercise]) =>
                                        cardioExercisesInCurrentMonth.has(id) && // Only show exercises with data this month
                                        exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .sort(([idA, exerciseA], [idB, exerciseB]) => {
                                        // Sort by predefined order
                                        const orderA = cardioOrder.indexOf(exerciseA.name);
                                        const orderB = cardioOrder.indexOf(exerciseB.name);

                                        // If both are in the order list, sort by that order
                                        if (orderA !== -1 && orderB !== -1) {
                                            return orderA - orderB;
                                        }

                                        // If only one is in the order list, it comes first
                                        if (orderA !== -1) return -1;
                                        if (orderB !== -1) return 1;

                                        // If neither is in the order list, sort alphabetically
                                        return exerciseA.name.localeCompare(exerciseB.name);
                                    });

                                return sortedCardioActivities.map(([id, exercise]) => {
                                    const iconPath = getCardioIconPath(id);

                                    return (
                                        <div key={id} className="activity-filter">
                                            <div className="checkbox-container">
                                                <input
                                                    type="checkbox"
                                                    id={`checkbox-${id}`}
                                                    checked={selectedCardioActivities.includes(id)}
                                                    onChange={() => handleActivityToggle(id)}
                                                    className="checkbox"
                                                />
                                                {iconPath && (
                                                    <img
                                                        style={{ paddingLeft: '4px' }}
                                                        src={iconPath}
                                                        alt=""
                                                        className="exercise-icon"
                                                        width="16"
                                                        height="16"
                                                    />
                                                )}
                                                <label
                                                    htmlFor={`checkbox-${id}`}
                                                    className="checkbox-label"
                                                >
                                                    <span
                                                        className="activity-name"
                                                        style={{ color: "#cadcfd" }}
                                                    >
                                                        {exercise.name}
                                                    </span>
                                                </label>
                                            </div>
                                            <button
                                                className="only-button"
                                                onClick={() => handleOnlyClick(id)}
                                            >
                                                ONLY
                                            </button>
                                        </div>
                                    );
                                });
                            })()
                        ) : (
                            // No cardio data for this month - don't show any filters
                            <div className="no-results"></div>
                        )
                    )}

                    {/* Show message when no results from search */}
                    {searchTerm && displayedActivities.length === 0 && mode === 'strength' && (
                        <div className="no-results">No exercises match your search</div>
                    )}
                    {searchTerm && Object.entries(cardioExercises).filter(([id, exercise]) =>
                        exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
                    ).length === 0 && mode === 'cardio' && Object.keys(cardioWorkouts).length > 0 && (
                            <div className="no-results">No cardio activities match your search</div>
                        )}
                </div>
            </div>
        </div>
    );
};

export default WorkoutChart;