function drawViz(vizData) {

    //console.log("GUSSSSSSS ",vizData);
    let startDate = vizData.dateRanges.DEFAULT.start;
    let endDate = vizData.dateRanges.DEFAULT.end;


    //console.log("vizData.interactions.onClick ", vizData.interactions.onClick);

    const entries = vizData.tables.DEFAULT;
    let dict = {
        "Calisthenics": [],
        "Chest": [],
        "Back": [],
        "Delts": [],
        "Arms": [],
        "Upper Legs": [],
        "Lower Legs": [],
    };


    let shapes = {
        "Dips": "circle",
        "Push Ups": "circle",
        "Pull Ups": "rectRot",
        "Chin Ups": "rectRot",
        "Nordic Curls": "triangle",
        "Sit Ups": "triangle",

        "Dumbell Flat Bench": "circle",
        "Dumbell Incline Bench": "circle",
        "Barbell Flat Bench": "rectRot",
        "Barbell Incline Bench": "rectRot",
        "Low To High Cable Chest Fly": "triangle",
        "High To Low Cable Crossover": "triangle",
        "Flies Flat": "rect",
        "Flies Incline": "rect",
        "Cable Flies": "rectRounded",
        "Flies Decline": "rectRounded",
        "Barbell Decline Bench": "cross",
        "Dumbell Decline Bench": "crossRot",

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
    }

    let borderColor = {
        "Dips": "#b5a4da",
        "Push Ups": "#b5a4da",
        "Pull Ups": "#b5a4da",
        "Chin Ups": "#b5a4da",
        "Nordic Curls": "#b5a4da",
        "Sit Ups": "#b5a4da",

        "Dumbell Flat Bench": "#f44336",
        "Dumbell Incline Bench": "#f44336",
        "Barbell Flat Bench": "#f44336",
        "Barbell Incline Bench": "#f44336",
        "Low To High Cable Chest Fly": "#f44336",
        "High To Low Cable Crossover": "#f44336",
        "Flies Flat": "#f44336",
        "Flies Incline": "#f44336",
        "Cable Flies": "#f44336",
        "Flies Decline": "#f44336",
        "Barbell Decline Bench": "#f44336",
        "Dumbell Decline Bench": "#f44336",

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
    }

    let backgroundColor = {

        "Dips": "#b5a4da",
        "Push Ups": "#000000",
        "Pull Ups": "#b5a4da",
        "Chin Ups": "#000000",
        "Nordic Curls": "#b5a4da",
        "Sit Ups": "#000000",

        "Dumbell Flat Bench": "#f44336",
        "Dumbell Incline Bench": "#000000",
        "Barbell Flat Bench": "#f44336",
        "Barbell Incline Bench": "#000000",
        "Low To High Cable Chest Fly": "#f44336",
        "High To Low Cable Crossover": "#000000",
        "Flies Flat": "#f44336",
        "Flies Incline": "#000000",
        "Cable Flies": "#f44336",
        "Flies Decline": "#000000",
        "Barbell Decline Bench": "#f44336",
        "Dumbell Decline Bench": "#f44336",

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
    }

    let shapesDict = {
        "Calisthenics": [],
        "Chest": [],
        "Back": [],
        "Delts": [],
        "Arms": [],
        "Upper Legs": [],
        "Lower Legs": [],
    };

    let borderColorDict = {
        "Calisthenics": [],
        "Chest": [],
        "Back": [],
        "Delts": [],
        "Arms": [],
        "Upper Legs": [],
        "Lower Legs": [],
    };
    let backgroundColorDict = {
        "Calisthenics": [],
        "Chest": [],
        "Back": [],
        "Delts": [],
        "Arms": [],
        "Upper Legs": [],
        "Lower Legs": [],
    };

    let labelColors = ['#b4a4da', '#f44336', '#ea9999', '#ffad3f', '#93c47d', '#6c9eeb', '#cadcfd'];
    const CalisthenicsList = new Set(["Dips", "Push Ups", "Pull Ups", "Chin Ups", "Nordic Curls", "Sit Ups"]);

    entries.forEach(entry => {
        //check entry if logged this column must be stats column
        if (entry.tableDimension && entry.tableDimension[2] != null) {
            let dataArray = JSON.parse(entry.tableDimension[2]);
            let label = entry.tableDimension[3]; //this is the label 'type' 
            let workout = entry.tableDimension[1];

            if (dict.hasOwnProperty(label)) {
                dataArray.forEach(function (data) {
                    dict[label].push(data);
                    shapesDict[label].push(shapes[workout]);
                    borderColorDict[label].push(borderColor[workout]);
                    backgroundColorDict[label].push(backgroundColor[workout]);
                });
            }
        }
    });

    const chartData = {
        datasets: []
    };

    Object.keys(dict).forEach((key) => {
        const dataset = {
            label: key, // The key from 'dict' as the label
            data: dict[key], // The array associated with the key in 'dict'
            backgroundColor: backgroundColorDict[key], // The color associated with the key from 'colors'
            borderColor: borderColorDict[key],
            pointStyle: shapesDict[key],
            borderWidth: 1,
        };
        chartData.datasets.push(dataset);
    });

    const newLegendClickHandler = function (e, legendItem, legend) {
        const indexName = legendItem.text;

        // Retrieve current active categories, if any
        let currentActive = null;
        if (vizData.interactions.onClick.value.data != null) {
            currentActive = vizData.interactions.onClick.value.data.values.map(item => item[0]);
        } else {
            currentActive = [];
        }

        let interactionData;
        if (currentActive.length === 1 && currentActive.includes(indexName)) {
            interactionData = {
                "concepts": ["qt_ga64eu0egd"], // Assuming this is a field ID
                "values": [["Calisthenics"], ["Chest"], ["Back"], ["Delts"], ["Arms"], ["Upper Legs"], ["Lower Legs"]] // Pass an empty array to set all as active
            };
        } else if (currentActive.includes(indexName)) {
            // All are active, set only the clicked one as active
            interactionData = {
                "concepts": ["qt_ga64eu0egd"],
                "values": [[indexName]]
            };
        } else {
            // Set only the clicked legend as active
            interactionData = {
                "concepts": ["qt_ga64eu0egd"],
                "values": [[indexName]]
            };
        }

        // Send the interaction data
        const actionId = "onClick";
        const FILTER = dscc.InteractionType.FILTER;
        dscc.sendInteraction(actionId, FILTER, interactionData);
    };


    /** 
    const newLegendClickHandler = function (e, legendItem, legend) {
        const indexName = legendItem.text;
      
        // Retrieve current active category, if any
        let currentActive = null;
        if (vizData.interactions.onClick.value.data != null) 
          currentActive = vizData.interactions.onClick.value.data.values; 
      
        //Check the active category, do nothing return
        if (currentActive && currentActive.length === 1 && currentActive[0][0] === indexName) {
          return; 
        }
      
        // Set the active category to the one that was just clicked
        var interactionData = {
          "concepts": ["qt_ga64eu0egd"],  // Assuming this is some sort of field ID
          "values": [[indexName]]  // Set the active category
        };
      
        // Send the interaction data
        var actionId = "onClick";
        var FILTER = dscc.InteractionType.FILTER;
        dscc.sendInteraction(actionId, FILTER, interactionData);
      };
*/
    /**
      const newLegendClickHandler = function (e, legendItem, legend) {
        const indexName = legendItem.text;
        const indexPos = legendItem.datasetIndex;
  
        let ret = [['Calisthenics'], ['Chest'], ['Back'], ['Delts'], ['Arms'], ['Upper Legs'], ['Lower Legs']];
  
        if (vizData.interactions.onClick.value.data != null) 
          ret = vizData.interactions.onClick.value.data.values; //double array
  
        //you've selected a legend that is not crossed out so cross it out and do not add it to display
        if (ret.some(subarray => subarray.toString() === [indexName].toString())) {
          let indexToRemove = ret.findIndex(subarray => subarray.toString() === [indexName].toString());
          ret.splice(indexToRemove, 1);
        }
        else //you've selected a legend that is crossed out so uncross it and add it to display
          ret.splice(indexPos, 0, [indexName]);
  
        var fieldID = "qt_ga64eu0egd";
        var interactionData = {
            "concepts": [fieldID],
            "values": ret
        };
        var actionId = "onClick"; 
        var FILTER = dscc.InteractionType.FILTER;
        dscc.sendInteraction(actionId, FILTER, interactionData);
    };
     */
    let day = new Date().getDate();
    let tickCheck = "" + day;

    // Configuration for the chart
    const config = {
        type: 'bubble', // or any other type
        data: chartData,
        options: {
            // Set y-axis minimum to 0
            maintainAspectRatio: false,
            animation: {
                duration: 100,
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.3)',  // Set the color to grey with 50% opacity
                        lineWidth: 0.33,  // Adjust the line width if needed
                        zeroLineColor: 'rgba(255, 255, 255, 0.3)'  // Set the color of the zero line
                    },
                    beginAtZero: true, // Ensures y-axis starts at 0
                    max: 300,
                    afterBuildTicks: function (axis) {
                        axis.max += 5; // Add extra space at the top by extending the maximum
                    },
                    title: {
                        display: true,
                        text: 'Weight' // Set y-axis title
                    },
                    ticks: {
                        stepSize: 25, // This sets minor ticks at every 10 units
                        callback: function (value, index, values) {
                            // Only label the ticks at multiples of 50
                            return value % 25 === 0 ? value : '';
                        }
                    }
                },
                x: {
                    offset: true,
                    grid: {
                        color: function (context) {
                            return context.tick.label === tickCheck ? '#b4a4da' : "#636363";
                        },
                        lineWidth: function (context) {
                            return context.tick.label === tickCheck ? 0.26 : 0.13;
                        },
                        zeroLineColor: 'rgba(255, 255, 255, 0.3)'  // Set the color of the zero line
                    },
                    type: 'time',
                    time: {
                        parser: 'YYYYMMDD',
                        unit: 'day',
                        displayFormats: {
                            day: 'D' // Format dates on the axis
                        },
                    },

                    min: startDate,
                    max: endDate,
                    ticks: {
                        maxTicksLimit: 31,
                        color: function (context) {
                            // Highlight the 17th date in red
                            return context.tick.label == tickCheck ? '#b4a4da' : "#636363";
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date' // Set x-axis title
                    }
                }
            },
            backgroundColor: 'transparent',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            console.log("context ", context.raw);
                            if (CalisthenicsList.has(context.raw.workout)) {
                                let label = '' + context.raw.workout;

                                //const weights = context.raw.y;
                                const reps = context.raw.reps;
                                const totalReps = reps ? reps.reduce((sum, rep) => sum + rep, 0) : 0;

                                const weights = Math.round((context.raw.r / 1.5) ** 2 * Math.PI - 10);
                                const weightsLabel = 'Weight: ' + weights + "lbs";

                                const repsLabel = reps ? 'Reps: ' + reps.join(', ') : '';
                                const totalRepsLabel = "Total Reps: " + totalReps;

                                return [label, weightsLabel, totalRepsLabel, repsLabel];
                            }
                            else {
                                let label = '' + context.raw.workout;
                                const weights = context.raw.y;
                                const weightsLabel = 'Weight: ' + weights + "lbs";
                                const reps = context.raw.reps;
                                const totalReps = reps ? reps.reduce((sum, rep) => sum + rep, 0) : 0;
                                const repsLabel = reps ? 'Reps: ' + reps.join(', ') : '';
                                const totalRepsLabel = "Total Reps: " + totalReps;
                                return [label, weightsLabel, totalRepsLabel, repsLabel];
                            }
                        }
                    }
                },
                legend: {
                    onClick: newLegendClickHandler,
                    labels: {
                        generateLabels: function (chart) {
                            const originalLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);

                            // Get the current active category from the interaction data
                            let currentActive = null;
                            if (vizData.interactions.onClick.value.data != null)
                                currentActive = vizData.interactions.onClick.value.data.values;

                            originalLabels.forEach((label, i) => {
                                label.strokeStyle = 'transparent';
                                if (currentActive && currentActive.length === 1 && currentActive[0][0] === label.text) {
                                    // If the label is active, set its color to the corresponding color
                                    label.fillStyle = labelColors[i % labelColors.length];
                                } else if (currentActive === null || currentActive.length === 7) {
                                    // If the label is inactive, set its color to grey
                                    label.fillStyle = labelColors[i % labelColors.length];
                                }
                                else {
                                    label.fillStyle = '#cccccc';
                                }
                            });


                            return originalLabels;
                        }
                    }
                }
            }
        }
    };

    // Ensure a canvas element for the chart exists
    let canvas = document.getElementById('myChart');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'myChart';
        document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');

    // Instantiate a new Chart or update an existing one
    if (window.myChart instanceof Chart) {
        window.myChart.destroy(); // Destroy the old chart instance if exists
    }
    window.myChart = new Chart(ctx, config); // Creates the chart with the new data

    if (vizData.interactions.onClick.value.data != null) {
        const filterLabels = vizData.interactions.onClick.value.data.values.flat();

        //console.log("vizData.interactions.onClick.value.data.values ", filterLabels);

        myChart.data.datasets.forEach(dataset => {
            //console.log("RENDERING PROCESS label ", dataset.label); 

            if (filterLabels.includes(dataset.label)) {
                // If the label is included in filterLabels, hide this dataset
                //console.log("show");
                // If the label is not included in filterLabels, show this dataset
                dataset.hidden = false;
            } else {


                //console.log("hide");
                dataset.hidden = true;
            }
        });
        myChart.update();
        //console.log(myChart, "myChart");

    }

}

// Subscribe to data and style changes. Use the table format for data.
dscc.subscribeToData(drawViz, { transform: dscc.objectTransform });