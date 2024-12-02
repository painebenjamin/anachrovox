/** @module alert */
const alertFadeDuration = 1000;

let alertContainer;

/**
 * Send an alert message to the user.
 * @param {string} message - The message to display.
 * @param {number} [timeout=5000] - The time in milliseconds before the alert is removed.
 */
export const sendAlert = (alertType, alertMessage = "", timeout = 10000) => {
    if (alertType instanceof Error) {
        alertMessage = alertType.message;
        if (/^(\w+):/.test(alertMessage)) {
            alertType = alertMessage.match(/^(\w+):/)[1];
            alertMessage = alertMessage.replace(/^(\w+):/, "");
        } else {
            alertType = "Error";
        }
    }
    const alertElement = document.createElement("div");
    const alertRemoveButton = document.createElement("button");
    const alertProgressBar = document.createElement("div");
    const alertHeader = document.createElement("h2");
    const alertBody = document.createElement("p");
    alertElement.classList.add("alert");
    alertRemoveButton.innerHTML = "&times;";
    alertRemoveButton.classList.add("close");
    alertProgressBar.classList.add("progress-bar");
    alertProgressBar.style.animationDuration = `${timeout}ms`;
    alertHeader.innerText = alertType;
    alertBody.innerText = alertMessage;
    alertElement.appendChild(alertHeader);
    alertElement.appendChild(alertBody);
    alertElement.appendChild(alertRemoveButton);
    alertElement.appendChild(alertProgressBar);

    if (!alertContainer) {
        alertContainer = document.createElement("div");
        alertContainer.classList.add("alert-container");
        document.body.appendChild(alertContainer);
    }

    alertContainer.appendChild(alertElement);

    const removeAlert = () => {
        alertElement.classList.add("hiding");
        setTimeout(() => {
            alertElement.remove();
        }, alertFadeDuration);
    };

    const removeTimeout = setTimeout(removeAlert, timeout);

    alertRemoveButton.onclick = () => {
        clearTimeout(removeTimeout);
        removeAlert();
    };
};
