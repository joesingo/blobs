/** FROM: https://gist.github.com/eyecatchup/9536706
* HSV to RGB color conversion
*
* H runs from 0 to 360 degrees
* S and V run from 0 to 100
*
* Ported from the excellent java algorithm by Eugene Vishnevsky at:
* http://www.cs.rit.edu/~ncs/color/t_convert.html
*/
function hsvToRgb(h, s, v) {
    var r, g, b;
    var i;
    var f, p, q, t;

    // Make sure our arguments stay in-range
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(100, s));
    v = Math.max(0, Math.min(100, v));

    // We accept saturation and value arguments from 0 to 100 because that's
    // how Photoshop represents those values. Internally, however, the
    // saturation and value are calculated from a range of 0 to 1. We make
    // That conversion here.
    s /= 100;
    v /= 100;

    if(s == 0) {
        // Achromatic (grey)
        r = g = b = v;
        return [
            Math.round(r * 255),
            Math.round(g * 255),
            Math.round(b * 255)
        ];
    }

    h /= 60; // sector 0 to 5
    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));

    switch(i) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;

        case 1:
            r = q;
            g = v;
            b = p;
            break;

        case 2:
            r = p;
            g = v;
            b = t;
            break;

        case 3:
            r = p;
            g = q;
            b = v;
            break;

        case 4:
            r = t;
            g = p;
            b = v;
            break;

        default: // case 5:
            r = v;
            g = p;
            b = q;
    }

    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

/**
 * An object to represent an LFO
 *
 * minValue - The minimum value to set
 * maxValue - The maximum value to set
 * speed - The amount to increase the value by in 1 second
 * callback - A function that takes a Blob object and the value to be set
           as parameters
 * loopRound (optional) - If this is true then jump from maxValue to
                          minValue instead of going back down (defaults to
                          false)
 */
function LFO(minValue, maxValue, speed, callback, loopRound) {
    loopRound = loopRound || false

    var value = (minValue + maxValue) / 2;

    // The 'direction' to modulate the value. +1 for up (i.e. value
    // increases) and -1 for down
    var direction = 1;

    this.update = function(dt) {
        var change = speed * dt;
        value += change * direction;

        // Make sure the value has not gone out of range
        if (value > maxValue) {
            // Work out how far past the max value we have gone, and set
            // the value to the proper value
            var extra = value - maxValue;

            if (loopRound) {
                value = minValue + extra;
            }
            else {
                // Change direction
                direction *= -1;
                value = maxValue - extra;
            }
        }
        // (Same as above but for min value)
        if (value < minValue) {
            // We do not need to consider loopRound here because direction
            // will always be 1 if loopRound is true

            direction *= -1;
            var extra = minValue - value;
            value = minValue + extra;
        }

        callback(value);
    }
}

/**
  * An object representing a sequence of events (i.e. keypresses and
  * clicks) to run automatically as a macro
  *
  * moves - An array of 'moves' to perform. Each element of this array is an
  *         object with keys for time (in seconds), type ('keyup', 'keydown' or
  *         click) and 'key' or 'coords' depending on the type
  */
function Macro(moves) {
    var position = 0;
    // The index at which to start iterating through this.moves. This is
    // increased whenever a move is performed
    var startIndex;

    this.started = false;
    this.moves = moves;

    this.start = function() {
        startIndex = 0;
        position = 0;
        this.started = true;
    }

    this.update = function(dt) {
        for (var i=startIndex; i<this.moves.length; i++) {
            if (this.moves[i].time < position) {
                switch (this.moves[i].type) {
                    case "keyup":
                        delete pressedKeys[KEY_NAMES[this.moves[i].key]];
                        break;

                    case "keydown":
                        pressedKeys[KEY_NAMES[this.moves[i].key]] = true;
                        handleKeypress(KEY_NAMES[this.moves[i].key]);
                        break;

                    case "click":
                        // Coordinates go from 0-100 as a percentage of
                        // width/height
                        var x = this.moves[i].coords[0] * canvas.width / 100;
                        var y = this.moves[i].coords[1] * canvas.height / 100;
                        handleClick(x, y);
                        break;
                }

                startIndex++;

                if (startIndex === this.moves.length) {
                    this.started = false;
                }
            }
        }

        position += dt;
    }
}

/**
  * An object to represent the recording of a macro, with methods to add events
  * and calculate the timings of events
  */
function MacroRecording() {
    this.moves = [];

    var startTime = null;

    /**
      * Calculate the time for an event happening right now. If this is the
      * first event then the time will be 0, otherwise it will be the number
      * of seconds elapsed since the first event
      */
    var getTime = function() {
        if (startTime === null) {
            startTime = Date.now();
            return 0;
        }

        return (Date.now() - startTime) / 1000;
    }

    this.addClick = function(x, y) {
        this.moves.push({
            "time": getTime(),
            "type": "click",
            "coords": [x, y]
        });
    }

    this.addKeyEvent = function(keyName, type) {
        this.moves.push({
            "time": getTime(),
            "type": type,
            "key": keyName
        });
    }
}

/**
 * An object representing a colour as HSV
 */
function Colour(h, s, v) {

    /**
     * Update this colour's HSV value and convert it to RGB
     */
    this.update = function(h, s, v) {
        this.hue = h % 360;
        this.sat = s;
        this.val = v;

        var rgb = hsvToRgb(this.hue, this.sat, this.val);
        // Store the RGB string on the object so we don't have to convert
        // every frame
        this.rbgString = "rgb(" + rgb.join(",") + ")";
    }

    this.update(h, s, v);
}

/**
 * A blob object
 *
 * x - x-coordinate
 * y - y-coordinate
 * bearing - Bearing from north in radians
 * color - A Colour object representing the colour of this blob
 */
function Blob(x, y, bearing, colour) {
    this.x = x;
    this.y = y;
    this.bearing = bearing;
    this.colour = colour;

    // This angle is added to the bearing each frame (e.g. to be modulated
    // by an LFO)
    this.bearingShift = 0;

    // This amount is added to the speed wben the randomiseSpeed button is down
    this.extraSpeed = 2 * settings.blob.maxExtraSpeed * Math.random() -
                      settings.blob.maxExtraSpeed;

    /**
     * Update this blob's position
     */
    this.update = function(dt) {
        // Move this blob if the pause key is not down
        if (!(KEY_NAMES.pause in pressedKeys)) {
            var speed = KEY_NAMES.slow in pressedKeys ?
                        settings.blob.slowSpeed : settings.blob.speed;

            if (KEY_NAMES.randomiseSpeed in pressedKeys) {
                // Add the extra speed
                speed += this.extraSpeed;
            }

            var bearing = this.bearing + this.bearingShift;

            this.x += Math.sin(bearing) * speed * dt;
            this.y -= Math.cos(bearing) * speed * dt;
        }
    }

    /**
     * Draw this blob as a circle on the canvas
     */
    this.draw = function() {
        ctx.fillStyle = this.colour.rbgString;

        var coords = [
            [this.x, this.y]
        ];

        if (settings.symmetry) {
            // Reflect this blob in all 4 quadrant of the canvas
            coords.push(
                [this.x, canvas.height - this.y],
                [canvas.width - this.x, this.y],
                [canvas.width - this.x, canvas.height - this.y]
            );
        }

        for (var i in coords) {
            ctx.beginPath();
            ctx.arc(
                coords[i][0], coords[i][1], settings.blob.radius, 0,
                2 * Math.PI
            );
            ctx.fill();
        }

    }
}

/**
  * Adjust the bearing of each blob in the array to head towards the point
  * (x, y)
  */
function attractBlobs(blobs, x, y) {
    for (var i in blobs) {
        var dx = x - blobs[i].x;
        var dy = -(y - blobs[i].y);
        blobs[i].bearing = Math.atan2(dx, dy);
    }
}

/**
 * Move every blob in the array to the point (x, y)
 */
function moveBlobs(blobs, x, y) {
    for (var i in blobs) {
        blobs[i].x = x;
        blobs[i].y = y;
    }
}

/**
 * Move all blobs to the point if paused, otherwise make them head towards
 * the point
 */
function handleClick(x, y) {
    if (KEY_NAMES.pause in pressedKeys) {
        moveBlobs(blobs, x, y);
    }
    else {
        attractBlobs(blobs, x, y);
    }
}

/**
  * Handle a keypress
  *
  * keyCode - The key code as given by event.keyCode
  */
function handleKeypress(keyCode) {
    switch (keyCode) {
        // Randomise the bearing of all blobs
        case KEY_NAMES.randomise:
            for (var i in blobs) {
                blobs[i].bearing = Math.random() * 2 * Math.PI;
            }
            break;

        // Show settings
        case KEY_NAMES.settings:
            if (displayedDialog === null) {
                showSettings();
            }
            break;

        case KEY_NAMES.toggleClear:
            settings.clearCanvas = !settings.clearCanvas;
            break;

        case KEY_NAMES.help:
            toggleHelp();
            break;

        case KEY_NAMES.esc:
            if (displayedDialog == dialogs.settings) {
                // Save settings when Esc is pressed
                saveSettings();
            }
            // Otherwise hide a dialog is one is currently shown
            else if (displayedDialog !== null) {
                hideDialog();
            }
            break;

        case KEY_NAMES.toggleSymmetry:
            settings.symmetry = !settings.symmetry;
            break;

        case KEY_NAMES.reverse:
            for (var i in blobs) {
                blobs[i].bearing += Math.PI;
            }
            break;

        case KEY_NAMES.startMacro:
            currentMacro.start();
            break;
    }
}

/**
 * Return an array of blobs, optionally at a specified co-ordinate
 *
 * count - The number of blobs to create
 * x (optional) - The x-coordinate to create the blobs at (defaults to using a
 *                random coordinate for each blob)
 * y (optional) - Same as x for y-coordinate
 */
function createBlobs(count, x, y) {
    var blobs = [];
    for (var i=0; i<count; i++) {
        var bearing = Math.random() * 2 * Math.PI;

        var hue = 120;
        var sat = Math.random() * 100;
        var val = Math.random() * 100;
        var colour = new Colour(hue, sat, val);

        var tx = x || Math.random() * canvas.width;
        var ty = y || Math.random() * canvas.height;

        blobs.push(new Blob(tx, ty, bearing, colour));
    }
    return blobs;
}

/**
 * Set up the canvas, blobs and LFOs
 */
function setup() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    blobs = createBlobs(settings.blob.count);
    lfos = {};

    // Get the current macro from the dropdown
    var macroName = document.getElementById("macro-dropdown").value;
    currentMacro = new Macro(macros[macroName]);

    macroRecording = new MacroRecording();

    // Modulate blob bearing
    lfos.bearingShift = new LFO(-Math.PI/4, Math.PI/4, 1,
        function(value) {
            for (var i in blobs) {
                blobs[i].bearingShift = value;
            }
        }
    );

    // Modulate blob hue
    lfos.hue = new LFO(0, 360, settings.hueChangePerSecond,
        function(value) {
        for (var i in blobs) {
            var colour = blobs[i].colour;
            blobs[i].colour.update(
                value, colour.sat, colour.val
            );
        }
    }, true);

    // lfos.speed = new LFO(100, 300, 200, function(value) {
    //     settings.blob.speed = value;
    // });

    stopped = false;

    // Draw background colour here - cannot rely on it being done in draw()
    // since the clearCanvas option could be false, in which case background
    // will be white
    ctx.fillStyle = settings.canvas.backgroundColour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * The main update loop that is called each frame
 * dt - Time in seconds since the last frame
 */
function mainUpdate(dt) {
    // Only update if no dialogs are visible
    if (displayedDialog === null) {
        for (var i in lfos) {
            // Skip updating this LFO if it's bearingShift and the key is not
            // pressed
            if (i === "bearingShift" && !(KEY_NAMES.wavy in pressedKeys)) {
                continue;
            }
            lfos[i].update(dt);
        }

        if (currentMacro.started) {
            currentMacro.update(dt);
        }

        // Click at the center of the canvas. This is handled here so that the
        // user can hold the center button to continually direct blobs to the
        // center, instead of just when the key is first pressed
        if (KEY_NAMES.center in pressedKeys) {
            handleClick(canvas.width / 2, canvas.height / 2, true);
        }

        for (var i in blobs) {
            blobs[i].update(dt);
        }

        draw();
    }
}

/**
 * Clear the screen and draw all objects
 */
function draw() {
    if (settings.clearCanvas) {
        // Clear screen
        ctx.fillStyle = settings.canvas.backgroundColour;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Draw border
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    for (var i in blobs) {
        blobs[i].draw();
    }
}

/**
  * Add the specified class to the given element
  */
function addClass(element, className) {
    var classes = element.className.split(" ");
    if (classes.indexOf(className) === -1) {
        classes.push(className);
    }
    element.className = classes.join(" ");
}

/**
  * Remove the specified class from the given element
  */
function removeClass(element, className) {
    var classes = element.className.split(" ");
    var index = classes.indexOf(className);
    if (index !== -1) {
        classes.splice(index, 1);
    }
    element.className = classes.join(" ");
}

/**
 * Show the provided dialog and update displayedDialog
 */
function showDialog(d) {
    d.style.display = "block";
    displayedDialog = d;
}

/**
 * Hide the provided dialog and update displayedDialog
 */
function hideDialog() {
    displayedDialog.style.display = "none";
    displayedDialog = null;
}

/**
 * Show a popup containing a textarea to edit the settings object as JSON
 */
function showSettings() {
    showDialog(dialogs.settings);
    var elem = dialogs.settings.getElementsByTagName("div")[0];
    elem.innerHTML = syntaxHighlightJSON(settings);
    dialogs.settings.style.display = "block";
}

/**
 * Close the settings popup, update the settings object and save settings to
 * local storage
 */
function saveSettings() {
    var elem = dialogs.settings.getElementsByTagName("div")[0];

    try {
        settings = JSON.parse(elem.textContent);
    }
    catch (e) {
        // User did not enter valid JSON
        addClass(elem, "error");
        return;
    }

    // Save settings in local storage
    localStorage.setItem("settings", JSON.stringify(settings));

    setup();
    hideDialog();
    removeClass(elem, "error");
}

/**
 * Reset settings to the defaults and remove from local storage
 */
function resetSettings() {
    var elem = dialogs.settings.getElementsByTagName("div")[0];
    elem.textContent = JSON.stringify(defaultSettings);
    saveSettings();
    localStorage.removeItem("settings");
}

/**
 * Return the name of a key given the key code
 */
function getKeyName(code) {
    if (code >= 65 && code <= 90) {
        return String.fromCharCode(code);
    }
    // The key is not alphabetic
    switch (code) {
        case 16:
            return "Shift"
        case 27:
            return "Esc"
    }
}

/**
  * Return the 'friendly name' for a key given the keycode. 'friendly name'
  * is e.g. 'pause', 'randomise' etc
  */
function getKeyFriendlyName(code) {
    for (var name in KEY_NAMES) {
        if (KEY_NAMES[name] === code) {
            return name;
        }
    }
    return null;
}

/**
  * Return HTML for syntax highlighted JSON for the given object
  */
function syntaxHighlightJSON(obj) {
    var json = JSON.stringify(obj, null, 4);

    // Brackets - match {, }, [ or ] where it is NOT followed by .*" (i.e.
    // not part of a string)
    json = json.replace(/({|}|\[|\])(?!.*")/g, "<span class='bracket'>$&</span>");

    // Strings
    var quote = '<span class="quote">"</span>';
    json = json.replace(/"([^"]+)"/g, quote + '<span class="string">$1</span>' + quote);

    return json;
}

/**
 * Show the help dialog if it is currently hidden, and close it if it is
 * shown
 */
function toggleHelp() {
    if (displayedDialog === null) {
        showDialog(dialogs.help);
    }
    else if (displayedDialog === dialogs.help) {
        hideDialog(dialogs.help);
    }
}

/**
  * Show the div containing the form to add a new macro
  */
function showNewMacroDiv() {
    // Hide the button
    document.getElementById("new-macro-button").style.display = "none";
    // Show the div
    document.getElementById("new-macro-div").style.display = "block";
}

/**
  * Validate the form for adding a new macro, add the new macro to the 'macros'
  * object, and clear and hide the form
  */
function addNewMacro() {
    var inputs = document.getElementById("new-macro-div")
                         .getElementsByTagName("input");
    var name = inputs[0].value.trim();
    var macroStr = inputs[1].value.trim();

    // Validate name
    if (name === "") {
        addClass(inputs[0], "error")
        var error = true;
    }
    else {
        // Need to remove the error class in case there was an error previously
        removeClass(inputs[0], "error");
    }

    // Validate macro is valid JSON
    try {
       var macro = JSON.parse(macroStr);
        // Remove error class in case there were errors previously
        removeClass(inputs[1], "error");
    }
    catch (e) {
       addClass(inputs[1], "error");
       console.log("WARNING: Macro was not valid JSON");
       var error = true;
    }

    if (error) {
        return;
    }

    // Add the macro to the dropdown
    macros[name] = macro;
    populateMacroDropdown();

    // Reset and hide the form, and show the 'add' button
    inputs[0].value = "";
    inputs[1].value = "";
    document.getElementById("new-macro-div").style.display = "none";
    document.getElementById("new-macro-button").style.display = "block";
}

/**
  * Populate the macro dropdown in the settings dialog
  */
function populateMacroDropdown() {
    var macroDropdown = document.getElementById("macro-dropdown");
    macroDropdown.innerHTML = "";  // Clear previous contents
    for (var i in macros) {
        var option = document.createElement("option");
        option.value = i;
        option.innerHTML = i;
        macroDropdown.appendChild(option);
    }
}

// User customisable settings
var defaultSettings = {
    "canvas": {
        "backgroundColour": "black"
    },
    "blob": {
        "radius": 3,
        "count": 1300,
        "speed": 100,
        "slowSpeed": 50,
        "maxExtraSpeed": 100
    },
    "clearCanvas": true,
    "symmetry": true,
    "hueChangePerSecond": 30,
    "version": 1.2  // Increment this when changing the structure of settings
};
var settings = defaultSettings;

// Try to use the settings saved in local storage if it exists
if (localStorage.getItem("settings")) {
    try {
        settings = JSON.parse(localStorage.getItem("settings"));
    }
    catch (e) {
        console.log("WARNING: Saved settings was not valid JSON");
    }

    // Check the version number of the saved settings
    if (settings.version !== defaultSettings.version) {
        console.log("INFO: Saved settings were for an old version - using " +
                    "defaults");
        settings = defaultSettings;
    }
}

var macros = {
    "test": [
        {"time": 0, "type": "keydown", "key": "pause"},
        {"time": 0, "type": "keydown", "key": "center"},
        {"time": 0.1, "type": "keyup", "key": "center"},
        {"time": 0.1, "type": "keyup", "key": "pause"},
        {"time": 1, "type": "keydown", "key": "randomise"},
        {"time": 3, "type":"click", "coords": [0, 0]},
        {"time": 4, "type": "keydown", "key": "toggleClear"},
        {"time": 4, "type": "keydown", "key": "center"},
        {"time": 4.1, "type": "keyup", "key": "center"}
    ],
    "test2": [{"time":0,"type":"keydown","key":"pause"},{"time":0.179,"type":"keydown","key":"center"},{"time":0.299,"type":"keyup","key":"center"},{"time":0.558,"type":"keyup","key":"pause"},{"time":0.64,"type":"keydown","key":"randomiseSpeed"},{"time":2.413,"type":"click","coords":[29.57894736842105,28.125]},{"time":7.306,"type":"keyup","key":"randomiseSpeed"}]
}
populateMacroDropdown();

// Create canvas and context
var canvas = document.getElementById("main-canvas");
var ctx = canvas.getContext("2d");

var blobs = [];
var lfos = {};
var currentMacro = null;
var macroRecording = null;

var stopped = true;
// The DOM element that is currently show, or null if none shown
var displayedDialog = null;

var dialogs = {
    "settings": document.getElementById("settings-popup"),
    "help": document.getElementById("help-popup")
};

// Start main loop
var then = Date.now();
setInterval(function() {
    if (!stopped) {
        var now = Date.now();
        var dt = (now - then) / 1000;
        then = now;
        mainUpdate(dt);
    }
}, 1);

canvas.addEventListener("click", function(event) {
    var x = event.offsetX;
    var y = event.offsetY;
    handleClick(x, y);

    // Record this click in the current macro recording
    if (macroRecording !== null) {
        macroRecording.addClick(
            100 * x / canvas.width,
            100 * y / canvas.height
        );
    }
});

var KEY_NAMES = {
    "pause": 16, // shift
    "randomise": 82, // r
    "center": 67, // c
    "slow": 83, // s
    "wavy": 87, // w
    "settings": 79, // o
    "toggleClear": 75, // k
    "help": 72, // h
    "toggleSymmetry": 89, // y
    "reverse": 86, // v
    "randomiseSpeed": 81, // q
    "startMacro": 77, // m
    "esc": 27, // esc
}

var KEY_HELP_TEXT = {
    "pause":          "Hold to pause all blob movement. Hold and click to " +
                      "move all blobs to the clicked position",
    "randomise":      "Randomise the direction of each blob",
    "center":         "Make all blobs head towards the center of the screen",
    "reverse":        "Reverse the direction of all blobs",
    "slow":           "Hold to make all blobs travel at a slower speed " +
                      "(defined in the settings)",
    "wavy":           "Hold to make all blobs travel in a wavy line",
    "randomiseSpeed": "Hold to increase/decrease each blob's speed by a " +
                      "random amount",
    "startMacro":     "Start the current macro",
    "settings":       "Bring up the settings dialog",
    "toggleClear":    "Toggle clearing of the screen at the beginning of " +
                      "each frame",
   "toggleSymmetry":  "Toggle symmetry",
    "help":           "Toggle this help",
    "esc":            "Save settings/Close dialog"
}

// Create a table to show the help text for each keybinding
var keyTable = document.getElementById("key-table");
for (var keyName in KEY_HELP_TEXT) {
    var keyCell = document.createElement("td");
    keyCell.innerHTML = "<span>" + getKeyName(KEY_NAMES[keyName]) + "</span>";

    var helpCell = document.createElement("td");
    helpCell.innerHTML = KEY_HELP_TEXT[keyName];

    var row = document.createElement("tr");
    row.appendChild(keyCell);
    row.appendChild(helpCell);
    keyTable.appendChild(row);
}

// Listen for keyboard events
var pressedKeys = {};
window.addEventListener("keydown", function(event) {
    console.log(event.keyCode);

    if (!(event.keyCode in pressedKeys)) {
        // We only need to call handleKeypress once
        handleKeypress(event.keyCode);

        // Record this keydown event in the macro if we are currently recording
        var friendlyName = getKeyFriendlyName(event.keyCode);
        if (macroRecording !== null && friendlyName !== null) {
            macroRecording.addKeyEvent(friendlyName, "keydown");
        }

        pressedKeys[event.keyCode] = true;
    }
});
window.addEventListener("keyup", function(event) {
    delete pressedKeys[event.keyCode];

    switch (event.keyCode) {
        // Reset the bearing shift on all blobs when stopping wavy mode
        case KEY_NAMES.wavy:
            for (var i in blobs) {
                blobs[i].bearingShift = 0;
            }
            break;
    }

    // Record in the macro if we are currently recording
    var friendlyName = getKeyFriendlyName(event.keyCode);
    if (macroRecording !== null && friendlyName !== null) {
        macroRecording.addKeyEvent(friendlyName, "keyup");
    }
});

setup();
