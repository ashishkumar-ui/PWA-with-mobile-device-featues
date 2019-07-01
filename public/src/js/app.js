// Register service worker
if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
            console.info("Service Worker registered", registration.scope);
        })
        .catch(err => {
            console.info("Service Worker could not be registered", err);
        });
}

// Unregistering Service Worker
/* navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
        registration.unregister()
    }
}); */

// Customizing ADD TO HOME 
var defferedPrompt; // this variable is being set to window scope so that this can be accessed via other JS files when required

window.addEventListener("beforeinstallprompt", event => {
    // Prevent Chrome to prompt ADD to HOME SCREEN pop up
    event.preventDefault();

    defferedPrompt = event;
    //return false;
});

// Push Notifications
var notificationButtons = document.querySelectorAll('.enable-notifications');

if ('Notification' in window) {
    for (let i = 0; i < notificationButtons.length; i++) {
        let button = notificationButtons[i];

        button.style.display = 'inline-block';
        button.addEventListener('click', requestNotificationPermission)
    }
}

function requestNotificationPermission(event) {
    Notification.requestPermission(userChoice => {
        if (userChoice !== 'granted') {
            console.log("Notification permission denied by user!");
        } else {
            console.log("Notification permission accepted by user!");
            configurePushSubscription();
            //displayConfirmNotification();
        }
    });
}

function displayConfirmNotification() {
    // Many of the notification features are not supported by many devices
    var options = {
        body: 'You have successfully subscribed app notification !',
        icon: '/src/images/icons/my-app-icon-96-96.png',
        image: '/src/images/tour-img.jpg',
        dir: 'ltr', // default
        lang: 'en-US', //default (supports BCP 47 format)
        vibrate: [100, 50, 200], // vibration-time (in ms) > pause > vibration-time
        badge: '/src/images/icons/my-app-icon-96-96.png', // icon for mobiles in in notification bar
        tag: 'confirm-notification', // notification with same tag stacks over each other in mobile device
        renotify: false, // flag for vibration
        actions: [
            { action: 'confirm', title: 'Okay', icon: '/src/images/icons/my-app-icon-96-96.png' },
            { action: 'cancel', title: 'Cancel', icon: '/src/images/icons/my-app-icon-96-96.png' }
        ]
    };

    //  new Notification('Notification granted!', options);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then(swRegistration => {
                swRegistration.showNotification('[SW] Notification granted!', options)
            })
    }
}

function configurePushSubscription() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    var registration;

    navigator.serviceWorker.ready
        .then(swRegistration => {
            registration = swRegistration;
            return swRegistration.pushManager.getSubscription();
        })
        .then(subcription => {
            if (subcription === null) {
                // create a new subscription
                let vapidPublicKey = 'BIzqU-Np3ERLPmlGGRHvWNigTK3c4ifoRCn59vzEmvgi2T3oBaYVn0gZK7uWE04ZK86DLIq_IXCQbQTUmfFoBRg';
                let convertedVapidPublicKey = urlBase64ToUint8Array(vapidPublicKey);

                return registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidPublicKey
                });
            } else {
                // we have a subscription
            }
        })
        .then(newSubscription => {
            console.log(newSubscription);
            return fetch('https://pwa-picnick.firebaseio.com/subscriptions.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(newSubscription)
            });
        })
        .then(res => {
            if (res.ok) {
                displayConfirmNotification();
            }
        })
        .catch(err => {
            console.log(err);
        });
}