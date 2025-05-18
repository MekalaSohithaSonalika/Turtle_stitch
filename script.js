// script.js

const canvas = document.getElementById('patternCanvas');
const ctx = canvas.getContext('2d');

// --- Canvas Setup ---
const CANVAS_SIZE = 600; // You can adjust this value. It's the maximum dimension.
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

const X_MIN = -0.5;
const X_MAX = 10;
const Y_MIN = -0.5;
const Y_MAX = 10;

const DATA_RANGE_X = X_MAX - X_MIN;
const DATA_RANGE_Y = Y_MAX - Y_MIN;

const SCALE_X = CANVAS_SIZE / DATA_RANGE_X;
const SCALE_Y = CANVAS_SIZE / DATA_RANGE_Y;

// Define the effective width of a character in data units for horizontal spacing.
// The 'A' pattern draws from x=0 to x=6. Setting this to 7 gives 1 unit of space between characters.
const CHAR_WIDTH_DATA_UNITS = 7;

// --- Dynamic Scaling Factor for the Entire Word ---
// This factor will be adjusted based on the length of the word to ensure it fits the canvas.
let wordScaleFactor = 1;

/**
 * Transforms a point from a character's local data coordinates to canvas coordinates,
 * applying a horizontal offset for its position in the word AND a global scaling factor.
 * @param {number} dataX - X coordinate in the character's local data space (e.g., 0-6 for 'A').
 * @param {number} dataY - Y coordinate in the data space.
 * @param {number} charXOffsetDataUnits - Horizontal offset for the character in data units.
 * @returns {{x: number, y: number}} - Object with canvas X and Y coordinates.
 */
function transformPoint(dataX, dataY, charXOffsetDataUnits = 0) {
    const transformedDataX = dataX + charXOffsetDataUnits;
    // Apply wordScaleFactor to both X and Y dimensions after base scaling
    const canvasX = (transformedDataX - X_MIN) * SCALE_X * wordScaleFactor;
    const canvasY = CANVAS_SIZE - ((dataY - Y_MIN) * SCALE_Y * wordScaleFactor);
    return { x: canvasX, y: canvasY };
}

/**
 * Interpolates points along a line segment.
 * @param {Array<Array<number>>} segment - [startPoint, endPoint] e.g., [[x1, y1], [x2, y2]]
 * @param {number} [steps=20] - Number of points to generate along the segment.
 * @returns {Array<Array<number>>} An array of interpolated points.
 */
function interpolateSegment(segment, steps = 20) {
    const start = segment[0];
    const end = segment[1];
    const interpolatedPoints = [];

    // Ensure we include the start and end points
    for (let i = 0; i <= steps; i++) {
        const t = i / steps; // Interpolation factor (0 to 1)
        const x = start[0] + t * (end[0] - start[0]);
        const y = start[1] + t * (end[1] - start[1]);
        interpolatedPoints.push([x, y]);
    }
    return interpolatedPoints;
}

// --- Character Drawing Data ---
// Define the drawing segments for each character.
// The order of segments is crucial for the "pen stroke" animation.
const CHARACTER_DRAWING_DATA = {
    'A': [
        // Original 'A' animation segments
        [[6, 8], [0, 8]],   // Top horizontal
        [[0, 8], [0, 0]],   // Left vertical
        [[0, 0], [0.75, 8]],
        [[0, 1], [1.5, 8]],
        [[0, 2], [2.25, 8]],
        [[0, 3], [3, 8]],
        [[0, 4], [3.75, 8]],
        [[0, 5], [4.5, 8]],
        [[0, 6], [5.25, 8]],
        [[0, 7], [6, 8]],
        [[6, 8], [6, 0]], // Right vertical
        [[6, 0], [5.25, 8]],
        [[6, 1], [4.5, 8]],
        [[6, 2], [3.75, 8]],
        [[6, 3], [3, 8]],
        [[6, 4], [2.25, 8]],
        [[6, 5], [1.5, 8]],
        [[6, 6], [0.75, 8]],
        [[6, 7], [0, 8]]
    ],
    // 'B' animation segments based on B7.py
    'B': [
        [[6, 8], [0, 8]],   // Top horizontal
        [[0, 8], [0, 0]],   // Left vertical
        [[0, 0], [0.75, 8]],
        [[0, 1], [1.5, 8]],
        [[0, 2], [2.25, 8]],
        [[0, 3], [3, 8]],
        [[0, 4], [3.75, 8]],
        [[0, 5], [4.5, 8]],
        [[0, 6], [5.25, 8]],
        [[0, 7], [6, 8]],
        [[6, 8], [4.8, 4]],
        [[6, 7.2], [3.6, 4]],
        [[6, 6.4], [2.4, 4]],
        [[6, 5.6], [1.2, 4]],
        [[6, 4.8], [0, 4]],
        [[0, 4], [6, 4]],
        [[6, 4], [4.8, 0]],
        [[6, 3.2], [3.6, 0]],
        [[6, 2.4], [2.4, 0]],
        [[6, 1.6], [1.2, 0]],
        [[6, 0.8], [0, 0]],
        [[0, 0], [6, 0]],
        [[6, 0], [6, 8]],
    ],
    // 'C' animation segments based on C7.py
    'C': [
        [[0, 0], [0, 8]],   // Left vertical
        [[0, 8], [6, 8]],   // Top horizontal
        [[6, 8], [0, 7]],
        [[5.25, 8], [0, 6]],
        [[4.5, 8], [0, 5]],
        [[3.75, 8], [0, 4]],
        [[3, 8], [0, 3]],
        [[2.25, 8], [0, 2]],
        [[1.5, 8], [0, 1]],
        [[0.75, 8], [0, 0]],
        [[0, 0], [6, 0]],    // Bottom horizontal
        [[6, 0], [0, 1]],
        [[5.25, 0], [0, 2]],
        [[4.5, 0], [0, 3]],
        [[3.75, 0], [0, 4]],
        [[3, 0], [0, 5]],
        [[2.25, 0], [0, 6]],
        [[1.5, 0], [0, 7]],
        [[0.75, 0], [0, 8]],
    ],
     // 'D' animation segments based on D7.py
    'D': [
        [[6, 8], [6, 0]],    // Right vertical
        [[6, 0], [0, 0]],    // Bottom horizontal
        [[0, 0], [6, 1]],
        [[0.75, 0], [6, 2]],
        [[1.5, 0], [6, 3]],
        [[2.25, 0], [6, 4]],
        [[3, 0], [6, 5]],
        [[3.75, 0], [6, 6]],
        [[4.5, 0], [6, 7]],
        [[5.25, 0], [6, 8]],
        [[6, 8], [0, 8]],    // Top horizontal
        [[0, 8], [6, 7]],
        [[0.75, 8], [6, 6]],
        [[1.5, 8], [6, 5]],
        [[2.25, 8], [6, 4]],
        [[3, 8], [6, 3]],
        [[3.75, 8], [6, 2]],
        [[4.5, 8], [6, 1]],
        [[5.25, 8], [6, 0]],
    ],
    // 'E' animation segments based on E7.py
    'E': [
        [[0, 4], [6, 4]],   // Middle horizontal
        [[6, 4], [0, 3.6]],
        [[4.8, 4], [0, 3.2]],
        [[3.6, 4], [0, 2.8]],
        [[2.4, 4], [0, 2.4]],
        [[1.2, 4], [0, 2]],
        [[0, 2], [1.2, 0]],
        [[0, 1.6], [2.4, 0]],
        [[0, 1.2], [3.6, 0]],
        [[0, 0.8], [4.8, 0]],
        [[0, 0.4], [6, 0]],
        [[6, 0], [0, 0]],    // Bottom horizontal
        [[0, 0], [0, 4]],    // Lower left vertical
        [[0, 4], [0, 8]],    // Upper left vertical
        [[0, 8], [6, 8]],    // Top horizontal
        [[6, 8], [0, 7.6]],
        [[4.8, 8], [0, 7.2]],
        [[3.6, 8], [0, 6.8]],
        [[2.4, 8], [0, 6.4]],
        [[1.2, 8], [0, 6]],
        [[0, 6], [1.2, 4]],
        [[0, 5.6], [2.4, 4]],
        [[0, 5.2], [3.6, 4]],
        [[0, 4.8], [4.8, 4]],
        [[0, 4.4], [6, 4]], // Connects back to the middle horizontal
    ],
    // 'F' animation segments based on F7.py
    'F': [
        [[0, 0], [0, 8]],    // Left vertical
        [[0, 8], [6, 8]],    // Top horizontal
        [[6, 8], [0, 7]],
        [[5.25, 8], [0, 6]],
        [[4.5, 8], [0, 5]],
        [[3.75, 8], [0, 4]],
        [[3, 8], [0, 3]],
        [[2.25, 8], [0, 2]],
        [[1.5, 8], [0, 1]],
        [[0.75, 8], [0, 0]], // Connects back to bottom left
        [[0, 0], [1.5, 4]],
        [[0, 1], [3, 4]],
        [[0, 2], [4.5, 4]],
        [[0, 3], [6, 4]],
        [[6, 4], [0, 4]],    // Middle horizontal
    ]
    // Add more characters here as needed.
};


// --- Animation State Variables ---
let wordToAnimate = '';             // The word entered by the user (e.g., "AAAA")
let currentWordCharIndex = 0;       // Index of the character currently being animated in the word
// This will now be a single flattened array of all points for the current character
let processedPointsForCurrentChar = [];
let totalFramesForCurrentChar = 0;      // Total frames for the current character's animation (equals number of points)
let currentFrame = 0;               // Current frame within the current character's animation
let animationActive = false;        // Flag to control if the animation loop is running

// This array stores the complete drawing data for characters that have finished animating.
// Each item will be an object: { char: 'A', processedPoints: [...], xOffset: N }
let completedCharacters = [];

// --- DOM Elements ---
const textInput = document.getElementById('wordInput');
const animateButton = document.getElementById('animateBtn');
const messageDiv = document.getElementById('message');

/**
 * Prepares all necessary animation data (interpolated points) for a given character.
 * This function now flattens all segments into a single list of points.
 * @param {string} char - The character for which to prepare the animation.
 * @returns {boolean} True if data was prepared successfully, false otherwise.
 */
function prepareAnimationForCharacter(char) {
    const charDrawingSegments = CHARACTER_DRAWING_DATA[char];

    if (!charDrawingSegments) {
        console.warn(`No drawing data found for character: '${char}'. Skipping.`);
        processedPointsForCurrentChar = [];
        totalFramesForCurrentChar = 0;
        return false;
    }

    // Flatten all interpolated points from all segments into a single array
    processedPointsForCurrentChar = [];
    for (const segment of charDrawingSegments) {
        // Add points for the current segment.
        // We skip the very first point of subsequent segments if it's the same as
        // the last point of the previous segment to avoid drawing the same point twice,
        // maintaining a continuous stroke.
        const interpolated = interpolateSegment(segment);
        if (processedPointsForCurrentChar.length > 0 &&
            interpolated.length > 0 &&
            processedPointsForCurrentChar[processedPointsForCurrentChar.length - 1][0] === interpolated[0][0] &&
            processedPointsForCurrentChar[processedPointsForCurrentChar.length - 1][1] === interpolated[0][1]) {
             // If the start of the new segment is the same as the end of the previous,
             // add points starting from the second point of the new segment.
             processedPointsForCurrentChar.push(...interpolated.slice(1));
        } else {
             // Otherwise, add all points of the new segment.
             processedPointsForCurrentChar.push(...interpolated);
        }
    }

    totalFramesForCurrentChar = processedPointsForCurrentChar.length; // Total frames = total points
    currentFrame = 0; // Always reset frame count when preparing for a new character
    return true;
}

// --- Helper to Draw a Path ---
// This function draws a sequence of points.
function drawPath(points, xOffset) {
    if (points.length < 2) return; // Need at least two points to draw a line

    ctx.beginPath(); // Start a new path
    // Move to the first point, applying the character's offset and global word scale
    const startPoint = transformPoint(points[0][0], points[0][1], xOffset);
    ctx.moveTo(startPoint.x, startPoint.y);

    // Draw lines to all subsequent points
    for (let i = 1; i < points.length; i++) {
        const point = transformPoint(points[i][0], points[i][1], xOffset);
        ctx.lineTo(point.x, point.y);
    }
    ctx.stroke(); // Render the path
}

// --- Animation Loop ---
let lastTimestamp = 0;
const ANIMATION_INTERVAL_MS = 20; // Corresponds to `interval=20` in Python code (50 FPS)

/**
 * The main animation loop.
 * This function clears the canvas, redraws all completed characters,
 * and then draws the current animating character's progress as a continuous stroke.
 * @param {DOMHighResTimeStamp} timestamp - The current time provided by requestAnimationFrame.
 */
function animate(timestamp) {
    if (!animationActive) {
        return; // Stop looping if animation is not active
    }

    const deltaTime = timestamp - lastTimestamp;

    if (deltaTime >= ANIMATION_INTERVAL_MS) {
        lastTimestamp = timestamp - (deltaTime % ANIMATION_INTERVAL_MS);

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas completely for each frame
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'black';

        // 1. Draw all characters that have already finished animating.
        // These characters remain fully visible on the canvas.
        for (const completedCharData of completedCharacters) {
            // Draw the *entire* processed path for the completed character
            drawPath(completedCharData.processedPoints, completedCharData.xOffset);
        }

        // 2. Animate the current character.
        if (currentWordCharIndex < wordToAnimate.length) {
            const currentChar = wordToAnimate[currentWordCharIndex];
            // Calculate the horizontal offset for the current character in the word
            const currentXOffsetDataUnits = currentWordCharIndex * CHAR_WIDTH_DATA_UNITS;

            // Prepare animation data for the current character if it's new or was skipped
            if (processedPointsForCurrentChar.length === 0) { // Check length of the flattened array
                const prepared = prepareAnimationForCharacter(currentChar);
                if (!prepared) {
                    // If data is missing for the current character (e.g., unsupported), skip to the next
                    currentWordCharIndex++;
                    currentFrame = 0; // Reset frame for the next char
                    requestAnimationFrame(animate); // Request next frame to try the next char immediately
                    return;
                }
            }

            // Get the points for the current character's animation up to the current frame.
            // This slice now takes from the single flattened array of points.
            const pointsToDrawForCurrentChar = processedPointsForCurrentChar.slice(0, currentFrame + 1);

            // Draw the current character's partial animation as a single continuous path
            drawPath(pointsToDrawForCurrentChar, currentXOffsetDataUnits);

            // Advance frame or move to the next character
            if (currentFrame >= totalFramesForCurrentChar - 1) {
                // The current character's animation has just finished
                // Add its full drawing data (the flattened points) to the `completedCharacters` array
                completedCharacters.push({
                    char: currentChar,
                    processedPoints: processedPointsForCurrentChar, // Store the complete flattened points for this char
                    xOffset: currentXOffsetDataUnits
                });

                currentWordCharIndex++; // Move to the next character in the word
                currentFrame = 0; // Reset frame count for the new character
                // Clear `processedPointsForCurrentChar` to force `prepareAnimationForCharacter`
                // to load data for the next character in the next frame.
                processedPointsForCurrentChar = [];

                if (currentWordCharIndex < wordToAnimate.length) {
                    messageDiv.textContent = `Animating: '${wordToAnimate}' - Current char: '${wordToAnimate[currentWordCharIndex]}'`;
                } else {
                    messageDiv.textContent = `Animation finished: ${wordToAnimate}`;
                }
            } else {
                currentFrame++; // Continue animating the current character by drawing the next point
            }
        } else {
            // All characters in the word have been animated and added to `completedCharacters`.
            // The animation loop will continue to redraw the final state of the word.
            messageDiv.textContent = `Animation finished: ${wordToAnimate}`;
            // If you want the animation to completely stop requesting frames after finishing:
            // animationActive = false;
            // return;
        }
    }

    requestAnimationFrame(animate); // Request the next animation frame
}

// --- Event Listener for Animation Button ---
animateButton.addEventListener('click', () => {
    let inputValue = textInput.value.trim().toUpperCase(); // Get input, trim whitespace, convert to uppercase

    // Filter out any characters not defined in CHARACTER_DRAWING_DATA
    const supportedCharsInInput = inputValue.split('').filter(char => CHARACTER_DRAWING_DATA.hasOwnProperty(char));
    wordToAnimate = supportedCharsInInput.join(''); // Reconstruct the word with only supported characters

    if (wordToAnimate.length === 0) {
        messageDiv.textContent = 'Please enter supported characters (A, B, C, D, E, F) to animate.';
        animationActive = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        completedCharacters = []; // Clear any previous completed chars
        return;
    }

    // --- Dynamic Scaling Calculation ---
    // Calculate the total width needed for the word in data units
    const requiredDataWidth = wordToAnimate.length * CHAR_WIDTH_DATA_UNITS;
    // The available data width in the canvas's current coordinate system
    const canvasAvailableDataWidth = X_MAX - X_MIN;

    // If the required width is greater than what can fit, scale down. Add a small padding (e.g., 95%)
    if (requiredDataWidth > canvasAvailableDataWidth) {
        wordScaleFactor = (canvasAvailableDataWidth / requiredDataWidth) * 0.95; // Scale down, leave 5% margin
    } else {
        wordScaleFactor = 1; // No scaling needed if word fits
    }
    // You could also calculate a globalXOffset here to center shorter words if wordScaleFactor is 1.
    // E.g., let globalXOffset = (wordScaleFactor === 1) ? (canvasAvailableDataWidth - requiredDataWidth) / 2 : 0;
    // Then apply this globalXOffset in transformPoint.

    // Inform the user if any unsupported characters were entered and filtered
    const allInputChars = inputValue.split('');
    const unsupportedCharsEntered = allInputChars.filter(char => !CHARACTER_DRAWING_DATA.hasOwnProperty(char));
    if (unsupportedCharsEntered.length > 0) {
        messageDiv.textContent = `Warning: Chars '${unsupportedCharsEntered.join(', ')}' not defined. Animating: ${wordToAnimate}`;
    } else {
        messageDiv.textContent = `Animating: ${wordToAnimate}`;
    }

    // Reset all animation state variables for a new word
    currentWordCharIndex = 0;
    currentFrame = 0;
    processedPointsForCurrentChar = []; // Ensure data for the first char is prepared
    completedCharacters = []; // Clear previously completed characters on the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas before starting a new animation

    animationActive = true; // Activate the animation loop
    requestAnimationFrame(animate); // Start or restart the animation loop
});

// Initial state message when the page loads
messageDiv.textContent = 'Enter characters (A, B, C, D, E, F) to animate.';
