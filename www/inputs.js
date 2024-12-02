import {
    isEmpty,
    bindPointerDrag
} from "./helpers.js";

// power buttons
const powerButtons = document.querySelectorAll("input.power");
powerButtons.forEach((button) => {
    // Set name if not set
    button.name = button.name || button.id;

    // Wrap input in div
    const wrapper = document.createElement("div");
    wrapper.classList.add("power-wrapper");
    wrapper.id = `wrapper-${button.id}`;
    button.parentNode.insertBefore(wrapper, button);
    wrapper.appendChild(button);

    // Add button elements
    const powerButton = document.createElement("div");
    powerButton.classList.add("power-button-background");
    const label = document.createElement("label");
    label.classList.add("power-button");
    label.htmlFor = button.id;
    const on = document.createElement("span");
    on.classList.add("on");
    on.innerText = "0";
    const off = document.createElement("span");
    off.classList.add("off");
    off.innerText = "I";
    label.appendChild(on);
    label.appendChild(off);
    powerButton.appendChild(label);
    wrapper.appendChild(powerButton);
});

// dials/knobs
const dials = document.querySelectorAll("input.dial");
dials.forEach((dial) => {
    // Wrap input in div
    const wrapper = document.createElement("div");
    const dialContainer = document.createElement("div");
    const dialElement = document.createElement("div");
    const specularElement = document.createElement("div");

    wrapper.classList.add("dial-wrapper");
    wrapper.id = `wrapper-${dial.id}`;
    dialContainer.classList.add("dial");
    dialElement.classList.add("dial-element");
    specularElement.classList.add("dial-specular");
    dial.parentNode.insertBefore(wrapper, dial);
    wrapper.appendChild(dialContainer);
    dialContainer.appendChild(dial);
    dialContainer.appendChild(specularElement);
    dialContainer.appendChild(dialElement);

    // Get range values
    const rangeStartValue = isEmpty(dial.min) ? 0 : parseFloat(dial.min);
    const rangeStartAngle = isEmpty(dial.dataset.angleStart) ? null : parseFloat(dial.dataset.angleStart);
    const rangeEndValue = isEmpty(dial.max) ? 100 : parseFloat(dial.max);
    const rangeEndAngle = isEmpty(dial.dataset.angleEnd) ? null : parseInt(dial.dataset.angleEnd);
    const rangeDegrees = rangeEndAngle === null || rangeStartAngle === null ? Infinity : rangeEndAngle - rangeStartAngle;

    // Add labels if configured
    const labels = isEmpty(dial.dataset.labels) ? null : JSON.parse(dial.dataset.labels);
    if (labels !== null) {
        for (let [value, text] of Object.entries(labels)) {
            value = parseFloat(value);
            const label = document.createElement("div");
            const valueDegrees = rangeDegrees === Infinity
                ? (value - rangeStartValue) / (rangeEndValue - rangeStartValue) * 360
                : (value - rangeStartValue) / (rangeEndValue - rangeStartValue) * rangeDegrees + rangeStartAngle;
            let valueDegreesCorrected = valueDegrees;
            while (valueDegreesCorrected < 0) {
                valueDegreesCorrected += 360;
            }
            label.classList.add("value");
            if (valueDegreesCorrected < 90) {
                label.classList.add("top");
            } else if (valueDegreesCorrected < 180) {
                label.classList.add("right");
            } else if (valueDegreesCorrected < 270) {
                label.classList.add("bottom");
            } else {
                label.classList.add("left");
            }
            label.style.transform = `rotate(${valueDegrees}deg)`;
            label.innerHTML = `<span>${text}</span>`;
            dialContainer.appendChild(label);
        }
    }

    // Bind dial input
    const getCurrentRotation = () => parseInt(dialElement.style.transform.replace("rotate(", "").replace("deg)", "")) % 360;
    const getCenterPoint = () => {
        const rect = dialElement.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    // Set initial rotation
    let initialValue = isEmpty(dial.value) ? rangeStartValue : parseFloat(dial.value);
    let initialAngle = rangeStartAngle === null || rangeDegrees === Infinity
        ? rangeStartAngle || 0
        : (initialValue - rangeStartValue) / (rangeEndValue - rangeStartValue) * rangeDegrees + rangeStartAngle;

    let startAngle;
    let startValue;
    let lastAngle;
    let fullRotations = 0;

    if (initialAngle !== null) {
        dialElement.style.transform = `rotate(${initialAngle}deg)`;
    }

    // Input events
    bindPointerDrag(
        wrapper,
        (e) => { // Start
            wrapper.classList.add("active");
            document.body.style.userSelect = "none";
            document.body.style.cursor = "grabbing";
            // Parse current rotation
            startAngle = getCurrentRotation();
            startValue = parseFloat(dial.value);
            fullRotations = 0;
        },
        (e) => { // Move
            const center = getCenterPoint();
            const delta = {
                x: e.current.x - center.x,
                y: e.current.y - center.y
            };
            const angle = Math.atan2(delta.y, delta.x) * (180 / Math.PI) + 90;
            if (angle < 0 && lastAngle > 0 || angle > 0 && lastAngle < 0) {
                // Likely a rotation, check if the angles are close to 360 degrees apart
                if (Math.abs(angle - lastAngle) > 345) {
                    fullRotations += angle > 0 ? -1 : 1;
                }
            }
            const rotationCorrectedAngle = angle + (fullRotations * 360);
            const boundedAngle = Math.min(
                Math.max(
                    rotationCorrectedAngle,
                    rangeStartAngle === null
                        ? rotationCorrectedAngle
                        : rangeStartAngle
                ),
                rangeEndAngle === null
                    ? rotationCorrectedAngle
                    : rangeEndAngle
            );
            const deltaDegrees = boundedAngle - startAngle;
            if (rangeDegrees !== Infinity) {
                const valueDelta = (rangeEndValue - rangeStartValue) * (deltaDegrees / rangeDegrees);
                const newValue = Math.min(
                    Math.max(
                        rangeStartValue,
                        startValue + valueDelta
                    ),
                    rangeEndValue
                );
                dial.value = newValue;
            } else if(rangeStartValue !== null && rangeEndValue !== null) {
                const valueDelta = (rangeEndValue - rangeStartValue) * (deltaDegrees / 360);
                const newValue = Math.min(
                    Math.max(
                        rangeStartValue,
                        startValue + valueDelta
                    ),
                    rangeEndValue
                );
                dial.value = newValue;
            } else {
                dial.value = boundedAngle;
            }
            lastAngle = angle;
            dialElement.style.transform = `rotate(${boundedAngle}deg)`;
            dial.dispatchEvent(new Event("change"));
        },
        (e) => { // End
            wrapper.classList.remove("active");
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }
    );
});

// solari boards
const solariValues = [
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z", " ", "-", ".", "/"
];
const solariTransitionTime = 20;
const solariBoards = document.querySelectorAll("input.solari-board");
solariBoards.forEach((board) => {
    // Grab data from input
    const initialValue = board.value;
    const maxLength = board.maxLength ? parseInt(board.maxLength) : initialValue.length;
    let valueNumber = 0;

    // Wrap input in div
    const wrapper = document.createElement("div");
    wrapper.classList.add("solari-board-wrapper");
    wrapper.id = `wrapper-${board.id}`;
    board.parentNode.insertBefore(wrapper, board);
    wrapper.appendChild(board);

    const boardContainer = document.createElement("div");
    boardContainer.classList.add("solari-board");
    wrapper.appendChild(boardContainer);

    for (let i = 0; i < maxLength; i++) {
        const boardElementContainer = document.createElement("div");
        const boardElementTop = document.createElement("div");
        const boardElementBottom = document.createElement("div");
        const boardElementFlap = document.createElement("div");
        boardElementContainer.classList.add("solari-board-element-container");
        boardElementTop.classList.add("solari-board-element-top");
        boardElementBottom.classList.add("solari-board-element-bottom");
        boardElementFlap.classList.add("solari-board-element-flap");
        boardElementFlap.style.display = "none";

        const boardElementValue = initialValue[i] || " ";
        boardElementTop.innerHTML = boardElementValue;
        boardElementBottom.innerHTML = boardElementValue;
        boardElementContainer.appendChild(boardElementTop);
        boardElementContainer.appendChild(boardElementBottom);
        boardElementContainer.appendChild(boardElementFlap);
        boardContainer.appendChild(boardElementContainer);
    }

    const transitionElement = async (index, value) => {
        const transitionNumber = valueNumber;
        const element = boardContainer.children[index];
        const top = element.children[0];
        const bottom = element.children[1];
        const flap = element.children[2];
        let startValue = top.innerText;
        if (startValue === "") {
            startValue = " ";
        }
        if (value === "") {
            value = " ";
        }
        if (startValue === value) {
            return;
        }
        const setValue = (value) => {
            return new Promise((resolve) => {
                flap.innerText = startValue;
                flap.classList.add("middle");
                flap.style.display = "block";
                top.innerText = value;
                setTimeout(() => {
                    flap.innerText = value;
                    flap.classList.remove("middle");
                    flap.classList.add("bottom");
                    setTimeout(() => {
                        bottom.innerText = value;
                        flap.classList.remove("bottom");
                        flap.style.display = "none";
                        resolve();
                    }, solariTransitionTime);
                }, solariTransitionTime);
            });
        };
        const startValueIndex = solariValues.indexOf(startValue);
        const endValueIndex = solariValues.indexOf(value);
        let valueArray = [];
        if (startValueIndex < endValueIndex) {
            valueArray = solariValues.slice(startValueIndex, endValueIndex + 1);
        } else if (endValueIndex < startValueIndex) {
            // wrap around
            valueArray = solariValues.slice(startValueIndex, solariValues.length).concat(solariValues.slice(0, endValueIndex + 1));
        }
        for (let value of valueArray) {
            if (transitionNumber !== valueNumber) {
                return;
            }
            await setValue(value);
        }
    };

    const transitionValue = async (value) => {
        valueNumber++;
        const valueArray = value.toUpperCase().split("");
        const promises = [];
        for (let i = 0; i < maxLength; i++) {
            if (i < valueArray.length) {
                promises.push(transitionElement(i, valueArray[i]));
            } else {
                promises.push(transitionElement(i, " "));
            }
        }
        await Promise.all(promises);
    }

    board.addEventListener("change", (e) => {
        transitionValue(board.value);
    });
});

// wheels
const wheels = document.querySelectorAll("input.wheel");
const tickTime = 100;
wheels.forEach((wheel) => {
    // Wrap input in div
    const wrapper = document.createElement("div");
    wrapper.classList.add("wheel-wrapper");
    wrapper.id = `wrapper-${wheel.id}`;
    wheel.parentNode.insertBefore(wrapper, wheel);
    wrapper.appendChild(wheel);

    const wheelContainer = document.createElement("div");
    wheelContainer.classList.add("wheel");
    wrapper.appendChild(wheelContainer);

    const wheelElement = document.createElement("div");
    wheelElement.classList.add("wheel-element");
    wheelContainer.appendChild(wheelElement);

    const wheelSpecular = document.createElement("div");
    wheelSpecular.classList.add("wheel-specular");
    wheelContainer.appendChild(wheelSpecular);

    const wheelShadow = document.createElement("div");
    wheelShadow.classList.add("wheel-shadow");
    wrapper.appendChild(wheelShadow);

    const moveRate = 2;
    const deadZone = 10;
    const pixelsPerRate = wheel.dataset.pixelsPerRate ? parseInt(wheel.dataset.pixelsPerRate) : 40;
    const removeClasses = () => {
        wheelContainer.classList.remove("up");
        wheelContainer.classList.remove("down");
    };

    let lastPosition, nextPosition, wheelTime;

    wrapper.addEventListener("wheel", (e) => {
        const thisWheelTime = new Date().getTime();
        e.preventDefault();
        if (wheelTime !== undefined && thisWheelTime - wheelTime < tickTime) {
            return;
        }
        wheelTime = thisWheelTime;
        if (lastPosition === undefined) {
            lastPosition = {
                x: e.clientX,
                y: e.clientY
            };
        }
        if (nextPosition === undefined) {
            nextPosition = {...lastPosition};
        }
        nextPosition.y += e.deltaY > 0 ? pixelsPerRate : -pixelsPerRate;
    });

    const tick = () => {
        if (lastPosition === undefined || nextPosition === undefined) {
            setTimeout(tick, tickTime);
            return;
        }
        const delta = nextPosition.y - lastPosition.y;
        removeClasses();
        if (Math.abs(delta) < deadZone) {
            setTimeout(tick, tickTime);
            return;
        }
        const deltaRate = Math.floor(Math.abs(delta) / pixelsPerRate);
        if (delta > 0) {
            wheelContainer.classList.add("down");
            wheel.value = -deltaRate;
            wheel.dispatchEvent(new MouseEvent("click"));
        } else {
            wheelContainer.classList.add("up");
            wheel.value = deltaRate;
            wheel.dispatchEvent(new MouseEvent("click"));
        }
        wheelElement.style.animationDuration = `${10/Math.abs(delta)}s`;
        lastPosition = {
            x: lastPosition.x,
            y: lastPosition.y + delta / moveRate
        };
        setTimeout(tick, tickTime);
    };
    requestAnimationFrame(tick);

    bindPointerDrag(
        wrapper,
        (e) => { // Start
            if (lastPosition === undefined) {
                lastPosition = e.start;
            }
            wrapper.style.cursor = "grabbing";
        },
        (e) => { // Move
            if (lastPosition === undefined) {
                lastPosition = e.start;
            }
            nextPosition = e.current;
        },
        (e) => { // End
            wrapper.style.cursor = "";
        }
    );
});

// 7-segments
const segments = document.querySelectorAll("input.seven-segment");
segments.forEach((segment) => {
    // Wrap input in div
    const wrapper = document.createElement("div");
    wrapper.classList.add("seven-segment-wrapper");
    wrapper.id = `wrapper-${segment.id}`;
    segment.parentNode.insertBefore(wrapper, segment);
    wrapper.appendChild(segment);

    const reflection = document.createElement("div");
    reflection.classList.add("reflection");
    wrapper.appendChild(reflection);

    const reflectionDodge = document.createElement("div");
    reflectionDodge.classList.add("reflection");
    reflectionDodge.classList.add("dodge");
    wrapper.appendChild(reflectionDodge);

    const segmentContainer = document.createElement("div");
    segmentContainer.classList.add("seven-segment");
    wrapper.appendChild(segmentContainer);

    const defaultValue = segment.value ? parseInt(segment.value) : 0;
    const maxValue = segment.max ? parseInt(segment.max) : 9;
    const numDigits = maxValue.toString().length;

    for (let i = 0; i < numDigits; i++) {
        const segmentElement = document.createElement("div");
        segmentElement.classList.add("seven-segment-element");
        segmentContainer.appendChild(segmentElement);
        
        for (let j = 0; j < 7; j++) {
            const segmentPart = document.createElement("div");
            segmentPart.classList.add(`segment-${j}`);
            segmentElement.appendChild(segmentPart);
        }
    }

    const updateSegment = (segmentIndex, value) => {
        const segmentElement = segmentContainer.children[segmentIndex];
        const segmentParts = segmentElement.children;
        const enabledSegments = [
            [0, 1, 2, 4, 5, 6],
            [2, 5],
            [0, 2, 3, 4, 6],
            [0, 2, 3, 5, 6],
            [1, 2, 3, 5],
            [0, 1, 3, 5, 6],
            [0, 1, 3, 4, 5, 6],
            [0, 2, 5],
            [0, 1, 2, 3, 4, 5, 6],
            [0, 1, 2, 3, 5, 6]
        ];
        for (let i = 0; i < 7; i++) {
            if (enabledSegments[value].includes(i)) {
                segmentParts[i].classList.add("on");
            } else {
                segmentParts[i].classList.remove("on");
            }
        }
    }

    const updateSegments = (value) => {
        const valueString = value.toString().padStart(numDigits, "0");
        for (let i = 0; i < numDigits; i++) {
            updateSegment(i, parseInt(valueString[i]));
        }
    }

    updateSegments(defaultValue);

    segment.addEventListener("change", (e) => {
        updateSegments(parseInt(segment.value));
    });
});

// sliders
const sliders = document.querySelectorAll("input.slider");
sliders.forEach((slider) => {
    // Wrap input in div
    const wrapper = document.createElement("div");
    wrapper.classList.add("slider-wrapper");
    wrapper.id = `wrapper-${slider.id}`;
    slider.parentNode.insertBefore(wrapper, slider);
    wrapper.appendChild(slider);

    const sliderContainer = document.createElement("div");
    sliderContainer.classList.add("slider");
    wrapper.appendChild(sliderContainer);

    const sliderElement = document.createElement("div");
    sliderElement.classList.add("slider-element");
    sliderContainer.appendChild(sliderElement);

    const rangeStartValue = isEmpty(slider.min) ? 0 : parseFloat(slider.min);
    const rangeEndValue = isEmpty(slider.max) ? 100 : parseFloat(slider.max);
    const range = rangeEndValue - rangeStartValue;
    const valueStep = isEmpty(slider.step) ? 1 : parseFloat(slider.step);
    const numDecimal = valueStep.toString().split(".")[1] ? valueStep.toString().split(".")[1].length : 0;
    const numLabels = isEmpty(slider.dataset.labels) ? 2 : parseInt(slider.dataset.labels);

    for (let i = 0; i < numLabels; i++) {
        const labelValue = i === 0
            ? rangeStartValue
            : i === numLabels - 1
                ? rangeEndValue
                : (rangeEndValue - rangeStartValue) / (numLabels - 1) * i + rangeStartValue;
        const labelLeft = document.createElement("div");
        const labelRight = document.createElement("div");
        labelLeft.classList.add("label");
        labelLeft.classList.add("left");
        labelRight.classList.add("label");
        labelRight.classList.add("right");
        labelLeft.innerText = labelValue.toFixed(numDecimal);
        labelRight.innerText = labelLeft.innerText;
        labelLeft.style.top = `${100 - (i / (numLabels - 1) * 100)}%`;
        labelRight.style.top = labelLeft.style.top;
        sliderContainer.appendChild(labelLeft);
        sliderContainer.appendChild(labelRight);
    }

    const updateSlider = () => {
        const value = parseFloat(slider.value);
        const inverseValue = rangeEndValue - value + rangeStartValue;
        const percentage = inverseValue / range * 100;
        sliderElement.style.top = `${percentage}%`;
    };

    updateSlider();

    slider.addEventListener("change", (e) => {
        updateSlider();
    });

    bindPointerDrag(
        sliderElement,
        (e) => { // Start
            wrapper.classList.add("active");
            document.body.style.userSelect = "none";
            document.body.style.cursor = "grabbing";
        },
        (e) => { // Move
            const rect = sliderContainer.getBoundingClientRect();
            const percentage = (e.current.y - rect.top) / rect.height;
            const inversePercentage = 1 - percentage;
            const value = rangeStartValue + (rangeEndValue - rangeStartValue) * inversePercentage;
            slider.value = Math.min(
                Math.max(
                    rangeStartValue,
                    value
                ),
                rangeEndValue
            );
            slider.dispatchEvent(new Event("change"));
        },
        (e) => { // End
            wrapper.classList.remove("active");
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }
    );
});

// Info button
const infoContainer = document.querySelector("#info");
const infoContent = document.querySelector("#info-content");
const infoButton = document.querySelector("#info-button");
infoButton.addEventListener("click", (e) => {
    const isActive = infoContainer.classList.contains("active");
    if (isActive) {
        infoButton.innerText = "i";
        infoContainer.classList.remove("active");
    } else {
        infoButton.innerText = "×";
        infoContainer.classList.add("active");
    }
    e.stopPropagation();
});
infoContent.addEventListener("click", (e) => {
    e.stopPropagation();
});
infoContainer.addEventListener("click", (e) => {
    infoButton.dispatchEvent(new Event("click"));
});
