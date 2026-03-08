export function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }

    if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

export function sendNotification(title: string, body: string) {
    if (Notification.permission === "granted") {
        new Notification(title, { body });
    }
}
