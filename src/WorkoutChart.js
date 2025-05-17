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
    const [exercises, setExercises] = useState({}); //list of exercises pulled from firebase
    const [workouts, setWorkouts] = useState({});   //list of workouts pulled from firebase
    const lastToggleActivityRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

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

        return () => unsubscribe();
    }, []);


    // Fetch workouts based on date range
    // Add this fix to the useEffect for fetching workouts based on date range
    useEffect(() => {
        if (chartInstance.current) {
            // Update x-axis min and max when month changes
            chartInstance.current.options.scales.x.min = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1).getTime();
            chartInstance.current.options.scales.x.max = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth() + 1, 0).getTime();
        }

        if (!dateRange.startDate || !dateRange.endDate) return;

        // Reset legend filtering when changing months
        // This ensures we don't carry over filtered state from previous month
        setSelectedGroups(Object.keys(muscleGroups));
        lastToggleActivityRef.current = null;

        // Get year and month for the path
        const year = dateRange.startDate.getFullYear().toString();
        const month = (dateRange.startDate.getMonth() + 1).toString().padStart(2, '0');
        console.log(`Fetching workouts for ${year}/${month}`);
        // Direct reference to the specific month's data
        const monthWorkoutsRef = ref(database, `workouts/${year}/${month}`);

        const unsubscribe = onValue(monthWorkoutsRef, (snapshot) => {
            const monthData = snapshot.val() || {};
            setWorkouts(monthData);
        });

        return () => unsubscribe();
    }, [dateRange]);

    // Process data and update chart
    useEffect(() => {
        if (Object.keys(exercises).length === 0) {
            return; // Only wait for exercises to load
        }
        console.log("updated selectedGroups", selectedGroups);
        updateChart();
    }, [exercises, workouts, selectedActivities, selectedGroups]);


    const displayedActivities = useMemo(() => {
        return filteredActivities.filter(activity =>
            activity.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [filteredActivities, searchTerm]);


    useEffect(() => {
        console.log("updating filtered activities");
    
        // Store current filter state before updating
        const currentSelectedIds = new Set(selectedActivities);
        const isFilteringByLegend = selectedGroups.length === 1;
        const currentLegendFilter = isFilteringByLegend ? selectedGroups[0] : null;
        
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
                    // If filtering by muscle group, activities should be selected if:
                    // 1. They belong to the filtered muscle group AND
                    // 2. Either they're not new OR we're not in a partial selection state
                    const belongsToFilteredGroup = exercise.muscleGroup === currentLegendFilter;
                    const hasPartialSelectionInGroup = filteredActivities.some(a => 
                        a.muscleGroup === currentLegendFilter && !a.selected
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
    
        // If filtering by legend, only show activities from that muscle group
        if (isFilteringByLegend) {
            activitiesList = activitiesList.filter(activity => 
                activity.muscleGroup === currentLegendFilter
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
        const isLastSelected = selectedActivities.length === 1 && selectedActivities[0] === activityId;

        // Get the current activity and its muscle group
        const activity = filteredActivities.find(a => a.id === activityId);
        if (!activity) return;

        // Check if we're currently filtered to a specific muscle group from legend
        const isFilteredByLegend = selectedGroups.length === 1;
        const currentFilterGroup = isFilteredByLegend ? selectedGroups[0] : null;

        if (isLastSelected) {
            // If unchecking the last selected exercise

            if (isFilteredByLegend) {
                // If we're filtered by legend, only select all activities from the current muscle group
                const activitiesInGroup = filteredActivities.filter(a =>
                    a.muscleGroup === currentFilterGroup
                );

                // Set all activities in this group to selected
                setFilteredActivities(prev => prev.map(activity => ({
                    ...activity,
                    selected: activity.muscleGroup === currentFilterGroup
                })));

                // Update selectedActivities to include all IDs from the filtered group
                setSelectedActivities(activitiesInGroup.map(a => a.id));

                console.log("Selecting all activities in current filtered group:", currentFilterGroup);
            } else {
                // If not filtered by legend, select all activities (original behavior)
                setFilteredActivities(prev => prev.map(activity => ({
                    ...activity,
                    selected: true
                })));

                const allActivityIds = filteredActivities.map(a => a.id);
                setSelectedActivities(allActivityIds);

                // Update selectedGroups to include all muscle groups
                setSelectedGroups(Object.keys(muscleGroups));

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

        // Now update the selectedGroups based on which muscle groups are still represented
        if (!isFilteredByLegend) {
            // Only update muscle group selection if we're not already filtered by legend
            const remainingMuscleGroups = new Set();

            // For each selected activity, add its muscle group to the set
            newSelectedActivities.forEach(id => {
                const act = filteredActivities.find(a => a.id === id);
                if (act) {
                    remainingMuscleGroups.add(act.muscleGroup);
                }
            });

            // Update selectedGroups with the remaining muscle groups
            if (remainingMuscleGroups.size > 0) {
                setSelectedGroups(Array.from(remainingMuscleGroups));
            }
        }

        console.log("Updated selectedActivities:", newSelectedActivities);
        console.log("Legend filter active:", isFilteredByLegend ? currentFilterGroup : "none");
    };

    const handleOnlyClick = (activityId) => {
        console.log("handleOnlyClick", activityId);
        const clickedActivity = filteredActivities.find(a => a.id === activityId);
        if (!clickedActivity) return;

        // Update filteredActivities to select only this one
        setFilteredActivities(prev => prev.map(activity => ({
            ...activity,
            selected: activity.id === activityId
        })));

        // Update selectedActivities
        setSelectedActivities([activityId]);

        // FIX HERE: Change from a string to an array with one element
        //setSelectedGroups([clickedActivity.muscleGroup]); // Was incorrectly: setSelectedGroups(clickedActivity.muscleGroup);
        //lastToggleActivityRef.current = clickedActivity.muscleGroup;
    };

    // Add this function near the top of your component
    const getExerciseIconPath = (exercise) => {
        if (!exercise) return null;

        const muscleGroup = exercise.muscleGroup;
        const pointStyle = exercise.pointStyle || 'circle'; // This comes from your Firebase data
        const backgroundColor = exercise.backgroundColor || '#ffffff';

        // Determine if we need the stroke version (for black background)
        const needsStrokeVersion = backgroundColor === '#000000';

        // Map pointStyle directly to file name component
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
                shapeComponent = 'Cross'; // Cross doesn't have a stroke version
                break;
            case 'crossrot':
                shapeComponent = 'CrossRot'; // Added this for completeness
                break;
            case 'circle':
            default:
                shapeComponent = needsStrokeVersion ? 'CircleStroke' : 'Circle';
                break;
        }

        // Map muscle group to folder prefix
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

        return `/icons/${groupPrefix}${shapeComponent}.svg`;
    };

    // Update chart with processed data
    // Modified updateChart function for new data structure
    const updateChart = () => {
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

                //console.log("exerciseId", exerciseId);
                //console.log("selectedActivities", selectedActivities);
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
            chartInstance.current.data = chartData;
            chartInstance.current.update();
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

                // Update legend click handler and labels...
                // Your existing code here
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

                const clickedGroup = legendItem.text;

                if (lastToggleActivityRef.current === clickedGroup) {
                    // If clicking the same group again, show all groups and all activities
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
                                    size: 17, // Increase this value to make the legend text larger
                                },

                            },


                        }
                    }
                }
            });
        }
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

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Title Area for Month and Year */}
                <div style={{
                    marginBottom: '8px',
                    borderRadius: '6px 6px 0 0'
                }}>
                    <h2 style={{
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
                <div className="filters-panel">
                    {/* Render filtered activities */}
                    {/* Render filtered activities */}
                    {displayedActivities.map(activity => {
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
                    })}

                    {/* Show message when no results */}
                    {searchTerm && displayedActivities.length === 0 && (
                        <div className="no-results">No exercises match your search</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkoutChart;