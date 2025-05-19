// script.js

const canvas = document.getElementById('patternCanvas');
const ctx = canvas.getContext('2d');

// --- Data Coordinate System ---
// These define the logical bounds of our drawing space, independent of pixel size.
const X_MIN = -0.5;
const X_MAX = 10;
const Y_MIN = -0.5;
const Y_MAX = 10;

const DATA_RANGE_X = X_MAX - X_MIN; // Total width of data: 10 - (-0.5) = 10.5
const DATA_RANGE_Y = Y_MAX - Y_MIN; // Total height of data: 10 - (-0.5) = 10.5

// Define the effective width of a character in data units for horizontal spacing.
const CHAR_WIDTH_DATA_UNITS = 7;

// --- Size Multiplier ---
// Increase this value to make the letters larger.
const SIZE_MULTIPLIER = 1.8; // Increased size further (adjust as needed)


// --- Dynamic Scaling and Offset Variables ---
let currentCanvasWidth = 0;
let currentCanvasHeight = 0;
let baseScale = 0; // Base scale factor based on the minimum canvas dimension
let wordScaleFactor = 1; // Additional scale factor for the word if it's too long

// Pixel offsets for centering the entire scaled word block on the canvas
let centerXOffsetPixels = 0;
let centerYOffsetPixels = 0;


/**
 * Updates canvas dimensions and recalculates scaling/offset based on current client size.
 * This should be called on initial load and on window resize.
 */
function updateCanvasDimensions() {
    // Get the actual rendered size of the canvas element from CSS
    currentCanvasWidth = canvas.clientWidth;
    currentCanvasHeight = canvas.clientHeight;

    // Set the canvas's internal drawing buffer size to match its display size
    // This prevents blurring on high-density displays
    canvas.width = currentCanvasWidth;
    canvas.height = currentCanvasHeight;

    // --- Calculate the base scale factor based on the minimum canvas dimension ---
    // This scale factor ensures the core character shape fits within the smaller
    // dimension of the canvas while maintaining its aspect ratio.
    const availableCanvasMinDimension = Math.min(currentCanvasWidth, currentCanvasHeight);
    const dataMaxDimension = Math.max(DATA_RANGE_X, DATA_RANGE_Y); // Assume character fits in a square data space

    // Avoid division by zero if canvas dimensions are 0
    if (availableCanvasMinDimension === 0 || dataMaxDimension === 0) {
        baseScale = 0;
    } else {
        // The baseScale is how many pixels per data unit based on the smaller canvas dimension.
        // We apply the SIZE_MULTIPLIER here to make the base character size larger.
        baseScale = (availableCanvasMinDimension / dataMaxDimension) * SIZE_MULTIPLIER;
    }

    // Recalculate scaling and centering for the current word based on the new canvas size
    if (wordToAnimate) {
        calculateWordScalingAndOffset(wordToAnimate);
    } else {
        // Reset scaling and offset if no word is set
        wordScaleFactor = 1;
        centerXOffsetPixels = 0;
        centerYOffsetPixels = 0;
    }

    // Redraw the current state after resizing
    // Use requestAnimationFrame for redrawing after resize to avoid tearing during rapid resizing
    requestAnimationFrame(redrawCanvasContent);
}


/**
 * Calculates the wordScaleFactor and pixel offsets needed to center the word
 * within the current canvas dimensions, maintaining aspect ratio.
 * @param {string} word - The word to be animated.
 */
function calculateWordScalingAndOffset(word) {
    // Calculate the total width needed for the word in data units without additional word scaling
    const unscaledRequiredDataWidth = word.length * CHAR_WIDTH_DATA_UNITS;
    const unscaledRequiredDataHeight = DATA_RANGE_Y; // Height is constant for all characters

    // Calculate the pixel dimensions the word would take with only the baseScale applied
    const baseScaledPixelWidth = unscaledRequiredDataWidth * baseScale;
    const baseScaledPixelHeight = unscaledRequiredDataHeight * baseScale;

    // Determine the additional word scaling factor needed to fit the word into the canvas
    // This factor is applied *on top of* the baseScale.
    let widthFitFactor = 1;
    if (baseScaledPixelWidth > currentCanvasWidth) {
        widthFitFactor = (currentCanvasWidth / baseScaledPixelWidth) * 0.95; // Leave a small margin
    }

    let heightFitFactor = 1;
     if (baseScaledPixelHeight > currentCanvasHeight) {
         heightFitFactor = (currentCanvasHeight / baseScaledPixelHeight) * 0.95; // Leave a small margin
     }

     // The wordScaleFactor is the minimum of the width and height fit factors
     // to ensure the entire word fits within the canvas bounds.
     wordScaleFactor = Math.min(widthFitFactor, heightFitFactor);


    // Calculate the final scaled pixel dimensions of the entire word block
    const finalScaledPixelWidth = baseScaledPixelWidth * wordScaleFactor;
    const finalScaledPixelHeight = baseScaledPixelHeight * wordScaleFactor;

    // Calculate the pixel offsets needed to center the final scaled word block on the canvas.
    centerXOffsetPixels = (currentCanvasWidth - finalScaledPixelWidth) / 2;
    centerYOffsetPixels = (currentCanvasHeight - finalScaledPixelHeight) / 2;
}


/**
 * Transforms a point from a character's local data coordinates to canvas coordinates,
 * applying character offset, the base scale factor, word scale factor,
 * and final pixel centering offsets.
 * @param {number} dataX - X coordinate in the character's local data space (e.g., 0-6 for 'A').
 * @param {number} dataY - Y coordinate in the data space.
 * @param {number} charXOffsetDataUnits - Horizontal offset for the character in data units (based on its position in the word).
 * @returns {{x: number, y: number}} - Object with canvas X and Y coordinates.
 */
function transformPoint(dataX, dataY, charXOffsetDataUnits = 0) {
    // Apply character offset in data units
    const transformedDataX = dataX + charXOffsetDataUnits;
    const transformedDataY = dataY; // Y coordinate is relative to the character's base line

    // Scale the point using the baseScale and wordScaleFactor, relative to the data origin (X_MIN, Y_MIN)
    // The baseScale already includes the SIZE_MULTIPLIER.
    const scaledX = (transformedDataX - X_MIN) * baseScale * wordScaleFactor;
    const scaledY = (transformedDataY - Y_MIN) * baseScale * wordScaleFactor;

    // Apply the pixel offsets for centering and adjust for the canvas's top-left origin
    const canvasX = scaledX + centerXOffsetPixels;
    const canvasY = currentCanvasHeight - (scaledY + centerYOffsetPixels); // Invert Y-axis for canvas

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
    ],

'G': [
    [[0, 8], [0, 0]],   // Left vertical
    [[0, 0], [6, 0]],   // Bottom horizontal
    [[6, 0], [6, 4]],   // Right vertical (partial)
    [[6, 4], [3, 4]],   // Middle horizontal (right to left)
    [[3, 4], [6, 3]],   // Diagonal to top-right
    [[3.75, 4], [6, 2]],
    [[4.5, 4], [6, 1]],
    [[5.25, 4], [6, 0]],
    [[6, 0], [0, 1]],   // Diagonal to top-left
    [[5.25, 0], [0, 2]],
    [[4.5, 0], [0, 3]],
    [[3.75, 0], [0, 4]],
    [[3, 0], [0, 5]],
    [[2.25, 0], [0, 6]],
    [[1.5, 0], [0, 7]],
    [[0.75, 0], [0, 8]],
    [[0, 8], [6, 8]],   // Top horizontal
    [[6, 8], [0, 7.2]], // Diagonal to bottom-left
    [[4.8, 8], [0, 6.4]],
    [[3.6, 8], [0, 5.6]],
    [[2.4, 8], [0, 4.8]],
    [[1.2, 8], [0, 4]]   // Middle horizontal (left to right)
],

'H': [
    [[0, 4], [3, 4]],
    [[3, 4], [0, 5]],
    [[2.25, 4], [0, 6]],
    [[1.5, 4], [0, 7]],
    [[0.75, 4], [0, 8]],
    [[0, 8], [0, 0]],
    [[0, 0], [0.75, 4]],
    [[0, 1], [1.5, 4]],
    [[0, 2], [2.25, 4]],
    [[0, 3], [3, 4]],
    [[3, 4], [6, 5]],
    [[3.75, 4], [6, 6]],
    [[4.5, 4], [6, 7]],
    [[5.25, 4], [6, 8]],
    [[6, 8], [6, 0]],
    [[6, 0], [5.25, 4]],
    [[6, 1], [4.5, 4]],
    [[6, 2], [3.75, 4]],
    [[6, 3], [3, 4]],
    [[3, 4], [6, 4]],   
],

'I': [
    [[3, 0], [3, 4]],
    [[3, 4], [2.25, 0]],
    [[3, 3], [1.5, 0]],
    [[3, 2], [0.75, 0]],
    [[3, 1], [0, 0]],
    [[0, 0], [6, 0]],
    [[6, 0], [3, 1]],
    [[5.25, 0], [3, 2]],
    [[4.5, 0], [3, 3]],
    [[3.75, 0], [3, 4]],
    [[3, 4], [3, 8]],
    [[3, 8], [0, 8]],
    [[0, 8], [3, 7]],
    [[0.75, 8], [3, 6]],
    [[1.5, 8], [3, 5]],
    [[2.25, 8], [3, 4]],
    [[3, 4], [3.75, 8]],
    [[3, 5], [4.5, 8]],
    [[3, 6], [5.25, 8]],
    [[3, 7], [6, 8]],
    [[6, 8], [3, 8]],
],

'J': [
    [[0, 0], [6, 0]],
    [[6, 0], [6, 8]],
    [[6, 8], [5.25, 0]],
    [[6, 7], [4.5, 0]],
    [[6, 6], [3.75, 0]],
    [[6, 5], [3, 0]],
    [[6, 4], [2.25, 0]],
    [[6, 3], [1.5, 0]],
    [[6, 2], [0.75, 0]],
    [[6, 1], [0, 0]],
],

'K': [
    [[0, 4], [6, 0]],
    [[6, 0], [0, 3.2]],
    [[4.8, 0.8], [0, 2.4]],
    [[3.6, 1.6], [0, 1.6]],
    [[2.4, 2.4], [0, 0.8]],
    [[1.2, 3.2], [0, 0]],
    [[0, 0], [0, 8]],
    [[0, 8], [1.2, 4.8]],
    [[0, 7.2], [2.4, 5.6]],
    [[0, 6.4], [3.6, 6.4]],
    [[0, 5.6], [4.8, 7.2]],
    [[0, 4.8], [6, 8]],
    [[6, 8], [0, 4]],
],

'L':[
    [[0, 8],[0, 0]],   // Left vertical
    [[0, 0],[6, 0]],   // Bottom horizontal
    [[6, 0],[0, 1]],
    [[5.25, 0],[0, 2]],
    [[4.5, 0],[0, 3]],
    [[3.75, 0],[0, 4]],
    [[3, 0],[0, 5]],
    [[2.25, 0],[0, 6]],
    [[1.5, 0],[0, 7]],
    [[0.75, 0],[0, 8]],
],

'M':[
    [[3, 4], [0, 8]],
    [[0, 8], [0, 0]],
    [[0, 0], [0.375, 7.5]],
    [[0, 1], [0.75, 7]],
    [[0, 2], [1.125, 6.5]],
    [[0, 3], [1.5, 6]],
    [[0, 4], [1.875, 5.5]],
    [[0, 5], [2.25, 5]],
    [[0, 6], [2.625, 4.5]],
    [[0, 7], [3, 4]],
    [[3, 4], [6, 8]],
    [[6, 8], [6, 0]],
    [[6, 0], [5.625, 7.5]],
    [[6, 1], [5.25, 7]],
    [[6, 2], [4.875, 6.5]],
    [[6, 3], [4.5, 6]],
    [[6, 4], [4.125, 5.5]],
    [[6, 5], [3.75, 5]],
    [[6, 6], [3.375, 4.5]],
    [[6, 7], [3, 4]]
],

'N': [
    [[3, 4], [0, 8]],
    [[0, 8], [0, 0]],
    [[0, 0], [0.375, 7.5]],
    [[0, 1], [0.75, 7]],
    [[0, 2], [1.125, 6.5]],
    [[0, 3], [1.5, 6]],
    [[0, 4], [1.875, 5.5]],
    [[0, 5], [2.25, 5]],
    [[0, 6], [2.625, 4.5]],
    [[0, 7], [3, 4]],
    [[3, 4], [6, 0]],
    [[6, 0], [6, 8]],
    [[6, 8], [5.625, 0.5]],
    [[6, 7], [5.25, 1]],
    [[6, 6], [4.875, 1.5]],
    [[6, 5], [4.5, 2]],
    [[6, 4], [4.125, 2.5]],
    [[6, 3], [3.75, 3]],
    [[6, 2], [3.725, 3.5]],
    [[6, 1], [3, 4]],
]
    // Add more characters here as needed.
};


// --- Animation State Variables ---
let wordToAnimate = '';
let currentWordCharIndex = 0;
let processedPointsForCurrentChar = [];
let totalFramesForCurrentChar = 0;
let currentFrame = 0;
let animationActive = false;
let animationFrameId = null;

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

/**
 * Draws the content on the canvas. This includes completed characters and the current animating character.
 * This function is called by the animation loop and the resize handler.
 */
function redrawCanvasContent() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas completely
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'black';

    // 1. Draw all characters that have already finished animating.
    for (const completedCharData of completedCharacters) {
        drawPath(completedCharData.processedPoints, completedCharData.xOffset);
    }

    // 2. Draw the current character's partial animation if animation is active
    if (animationActive && currentWordCharIndex < wordToAnimate.length) {
        const currentChar = wordToAnimate[currentWordCharIndex];
        const currentXOffsetDataUnits = currentWordCharIndex * CHAR_WIDTH_DATA_UNITS;

         // Prepare animation data if needed (should usually be done before animation starts)
         // This check is mostly a safeguard.
        if (processedPointsForCurrentChar.length === 0) {
             prepareAnimationForCharacter(currentChar);
        }

        const pointsToDrawForCurrentChar = processedPointsForCurrentChar.slice(0, currentFrame + 1);
        drawPath(pointsToDrawForCurrentChar, currentXOffsetDataUnits);
    }
}


// --- Helper to Draw a Path ---
// This function draws a sequence of points.
function drawPath(points, xOffset) {
    if (points.length < 2) return; // Need at least two points to draw a line

    ctx.beginPath(); // Start a new path
    // Move to the first point, applying the character's offset and global word offset
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
const ANIMATION_INTERVAL_MS = 10; // Corresponds to `interval=20` in Python code (50 FPS)

/**
 * The main animation loop.
 * Handles frame progression and transitions between characters.
 * Drawing is delegated to redrawCanvasContent().
 * @param {DOMHighResTimeStamp} timestamp - The current time provided by requestAnimationFrame.
 */
function animate(timestamp) {
    if (!animationActive) {
        animationFrameId = null; // Clear the animation frame ID if animation stops
        return;
    }

    const deltaTime = timestamp - lastTimestamp;

    if (deltaTime >= ANIMATION_INTERVAL_MS) {
        lastTimestamp = timestamp - (deltaTime % ANIMATION_INTERVAL_MS);

        // Redraw the entire canvas content for the current frame
        redrawCanvasContent();

        // Advance frame or move to the next character
        if (currentWordCharIndex < wordToAnimate.length) {
             // Check if the current character's animation is finished
            if (currentFrame >= totalFramesForCurrentChar - 1) {
                // The current character's animation has just finished
                // Add its full drawing data to the `completedCharacters` array
                completedCharacters.push({
                    char: wordToAnimate[currentWordCharIndex],
                    processedPoints: processedPointsForCurrentChar, // Store the complete flattened points
                    xOffset: currentWordCharIndex * CHAR_WIDTH_DATA_UNITS // Store the offset it was drawn at
                });

                currentWordCharIndex++; // Move to the next character in the word
                currentFrame = 0; // Reset frame count for the new character
                // Clear `processedPointsForCurrentChar` to force `prepareAnimationForCharacter`
                // to load data for the next character in the next frame if needed.
                processedPointsForCurrentChar = [];

                if (currentWordCharIndex < wordToAnimate.length) {
                    messageDiv.textContent = `Stitching: '${wordToAnimate}' - Current char: '${wordToAnimate[currentWordCharIndex]}'`;
                    // Prepare data for the next character immediately
                    prepareAnimationForCharacter(wordToAnimate[currentWordCharIndex]);
                } else {
                    messageDiv.textContent = `Animation finished: ${wordToAnimate}`;
                    // Animation is complete
                    animationActive = false; // Stop the animation loop
                }
            } else {
                currentFrame++; // Continue animating the current character by drawing the next point
            }
        } else {
             // This case should ideally not be reached if animationActive is false when finished.
             // It's a safeguard.
             animationActive = false;
             messageDiv.textContent = `Animation finished: ${wordToAnimate}`;
        }
    }

    // Request the next animation frame if animation is still active
    if (animationActive) {
        animationFrameId = requestAnimationFrame(animate);
    }
}

// --- Event Listener for Animation Button ---
animateButton.addEventListener('click', () => {
    let inputValue = textInput.value.trim().toUpperCase(); // Get input, trim whitespace, convert to uppercase

    // Filter out any characters not defined in CHARACTER_DRAWING_DATA
    const supportedCharsInInput = inputValue.split('').filter(char => CHARACTER_DRAWING_DATA.hasOwnProperty(char));
    wordToAnimate = supportedCharsInInput.join(''); // Reconstruct the word with only supported characters

    // Stop any ongoing animation
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animationActive = false; // Ensure the flag is false

    if (wordToAnimate.length === 0) {
        messageDiv.textContent = 'Please enter supported characters (A-F) to stitch.';
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        completedCharacters = []; // Clear any previous completed chars
        wordScaleFactor = 1; // Reset word scale
        centerXOffsetPixels = 0; // Reset pixel offsets
        centerYOffsetPixels = 0;
        return;
    }

    // --- Calculate Scaling and Centering for the new word ---
    // Call updateCanvasDimensions first to ensure canvas size and base scale are current
    updateCanvasDimensions();
    // Then calculate word-specific scaling and offset based on the word and current canvas size
    calculateWordScalingAndOffset(wordToAnimate);


    // Inform the user if any unsupported characters were entered and filtered
    const allInputChars = inputValue.split('');
    const unsupportedCharsEntered = allInputChars.filter(char => !CHARACTER_DRAWING_DATA.hasOwnProperty(char));
    if (unsupportedCharsEntered.length > 0) {
        messageDiv.textContent = `Warning: Chars '${unsupportedCharsEntered.join(', ')}' not defined. Animating: ${wordToAnimate}`;
    } else {
        messageDiv.textContent = `Stitching: ${wordToAnimate}`;
    }

    // Reset all animation state variables for a new word
    currentWordCharIndex = 0;
    currentFrame = 0;
    processedPointsForCurrentChar = []; // Ensure data for the first char is prepared

    // Prepare data for the very first character of the new word BEFORE starting animation
    const firstChar = wordToAnimate[0];
    if (!prepareAnimationForCharacter(firstChar)) {
         // Handle case where the very first character is unsupported (should be filtered, but as safeguard)
         messageDiv.textContent = `Error: Could not prepare animation for '${firstChar}'. Please use supported characters.`;
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         completedCharacters = [];
         wordToAnimate = ''; // Clear the word if the first char is invalid
         wordScaleFactor = 1; // Reset scaling
         centerXOffsetPixels = 0; // Reset pixel offsets
         centerYOffsetPixels = 0;
         return;
    }

    completedCharacters = []; // Clear previously completed characters on the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas before starting a new animation

    animationActive = true; // Activate the animation loop
    lastTimestamp = performance.now(); // Reset timestamp for smooth start
    animationFrameId = requestAnimationFrame(animate); // Start the animation loop
});

// --- Resize Event Listener ---
// Update canvas dimensions and redraw when the window is resized
window.addEventListener('resize', () => {
    updateCanvasDimensions();
    // redrawCanvasContent() is called inside updateCanvasDimensions via requestAnimationFrame
});

// --- Initial Setup ---
// Call updateCanvasDimensions once on page load to set initial size and scale
window.onload = () => {
    updateCanvasDimensions();
    messageDiv.textContent = 'Enter characters (A-F) to stitch.';
};
