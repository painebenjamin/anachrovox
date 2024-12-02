/**
 * Check if an object is 'empty'.
 *
 * @param object $o The object to check.o
 * @return bool True if the object is empty.
 */
export let isEmpty = (o) => {
    return (
        o === null ||
        o === undefined ||
        o === '' ||
        o === 'null' ||
        (Array.isArray(o) && o.length === 0) ||
        (typeof o === 'object' &&
            o.constructor.name === 'Object' &&
            Object.getOwnPropertyNames(o).length === 0)
    );
};

/**
 * Merge multiple typed arrays into a single typed array.
 * Assumes that all the arrays are of the same type.
 *
 * @param {Array<TypedArray>} arrays - The arrays to merge. Any kind of typed array is allowed.
 * @returns {TypedArray} - The merged typed array.
 */
export let mergeTypedArrays = (arrays) => {
    let totalLength = arrays.reduce((acc, array) => acc + array.length, 0);
    let result = new arrays[0].constructor(totalLength);
    let offset = 0;
    arrays.forEach((array) => {
        result.set(array, offset);
        offset += array.length;
    });
    return result;
}

/**
 * Binds a method to window mousemove, and then unbinds it when released
 * or when the mouse leaves the window.
 */
export let bindPointerUntilRelease = (callback, releaseCallback = null) => {
    let onWindowPointerMove = (e) => {
        callback(e);
    }
    let onWindowPointerUpOrLeave = (e) => {
        // In chrome, window.mouseleave is triggered when the mouse leaves the window.
        // In firefox, window.mouseleave is triggered when the mouse leaves any element, so we need to check if the target is the document.
        if (e.type === "mouseleave" && (e.target !== null && e.target !== undefined && e.target.tagName !== "HTML")) {
            return;
        }
        if (!isEmpty(releaseCallback)) {
            releaseCallback(e);
        }
        window.removeEventListener("mouseup", onWindowPointerUpOrLeave, true);
        window.removeEventListener("mouseleave", onWindowPointerUpOrLeave, true);
        window.removeEventListener("touchend", onWindowPointerUpOrLeave, true);
        window.removeEventListener("mousemove", onWindowPointerMove, true);
        window.removeEventListener("touchmove", onWindowPointerMove, true);
    }
    window.addEventListener("mouseup", onWindowPointerUpOrLeave, true);
    window.addEventListener("mouseleave", onWindowPointerUpOrLeave, true);
    window.addEventListener("touchend", onWindowPointerUpOrLeave, true);
    window.addEventListener("mousemove", onWindowPointerMove, true);
    window.addEventListener("touchmove", onWindowPointerMove, true);
};

/**
 * Binds drag events to an element.
 * The callback is called with an object containing the following properties:
 * - start: The starting point of the drag.
 *   - x: The x coordinate.
 *   - y: The y coordinate.
 * - current: The current point of the drag.
 *   - x: The x coordinate.
 *   - y: The y coordinate.
 * - delta: The difference between the current and starting points.
 *   - x: The x coordinate.
 *   - y: The y coordinate.
 * - startEvent: The event that started the drag.
 * - moveEvent: The event that triggered the callback.
 * The releaseCallback is called when the drag is released.
 */
export let bindPointerDrag = (element, startCallback, callback, releaseCallback = null) => {
    const pointerStart = (e) => {
        if (e.type === "mousedown" && e.button !== 0) {
            return;
        }
        e.preventDefault();
        const startPosition = e.type === "mousedown" ? e : e.touches[0];
        const startPoint = {x: startPosition.clientX, y: startPosition.clientY};
        if (!isEmpty(startCallback)) {
            startCallback({
                start: startPoint,
                startEvent: e
            });
        }
        bindPointerUntilRelease(
            (e2) => {
                const currentPosition = e2.type === "mousemove" ? e2 : e2.touches[0];
                const currentPoint = {x: currentPosition.clientX, y: currentPosition.clientY};
                const delta = {x: currentPoint.x - startPoint.x, y: currentPoint.y - startPoint.y};
                callback({
                    start: startPoint,
                    current: currentPoint,
                    delta: delta,
                    startEvent: e,
                    moveEvent: e2
                });
            },
            (e2) => {
                if (!isEmpty(releaseCallback)) {
                    releaseCallback({
                        start: startPoint,
                        startEvent: e,
                        releaseEvent: e2
                    });
                }
            }
        );
    };
    element.addEventListener("mousedown", pointerStart);
    element.addEventListener("touchstart", pointerStart);
};

/**
 * Replaces all quotes in a string with standard quotes.
 * @param {string} text - The text to replace quotes in.
 * @returns {string} - The text with quotes replaced.
 */
export let replaceQuotes = (text) => {
    return text.replaceAll("“", "\"")
               .replaceAll("”", "\"")
               .replaceAll("‘", "'")
               .replaceAll("’", "'");
};

/**
 * Converts a hex color to an rgb color.
 * @param {string} hex - The hex color to convert.
 * @returns {array} - The rgb color.
 */
export let hexToRgb = (hex) => {
    let bigint = parseInt(hex.replace("#", ""), 16);
    return [
        (bigint >> 16) & 255,
        (bigint >> 8) & 255,
        bigint & 255
    ];
};
