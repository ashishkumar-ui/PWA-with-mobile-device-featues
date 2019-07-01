importScripts("https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js");
importScripts("/src/js/idb.js");
importScripts("/src/js/utility.js");

workbox.routing.registerRoute(/.*(?:firebasestorage.googleapis)\.com.*$/, new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'post-images',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 15,
            maxAgeSeconds: 30 * 24 * 60 * 60
        })
    ]
}));

workbox.routing.registerRoute(/.*(?:googleapis|gstatic)\.com.*$/, new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'google-fonts',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 3,
            maxAgeSeconds: 30 * 24 * 60 * 60
        })
    ]
}));

workbox.routing.registerRoute('https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.pink-blue.min.css', new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'material-css',
    plugins: [
        new workbox.expiration.Plugin({
            maxEntries: 1,
            maxAgeSeconds: 30 * 24 * 60 * 60
        })
    ]
}));

/**
 * Storing things in IndexedDB instead of browser cache
 */
workbox.routing.registerRoute('https://pwa-picnick.firebaseio.com/posts.json', function (args) {
    return fetch(args.event.request)
        .then(function (res) {
            var clonedRes = res.clone();
            clearAllData('posts')
                .then(function () {
                    return clonedRes.json();
                })
                .then(function (data) {
                    for (var key in data) {
                        writeData('posts', data[key])
                    }
                });
            return res;
        });
});

/**
 * Responding with non-available HTML pages when offline
 */
workbox.routing.registerRoute(function (routeData) {
    // identifying html requests
    return (routeData.event.request.headers.get('accept').includes('text/html'));
}, function (args) {
    return caches.match(args.event.request)
        .then(function (response) {
            if (response) {
                return response;
            } else {
                return fetch(args.event.request)
                    .then(function (res) {
                        return caches.open('dynamic')
                            .then(function (cache) {
                                cache.put(args.event.request.url, res.clone());
                                return res;
                            })
                    })
                    .catch(function (err) {
                        return caches.match('/offline.html')
                            .then(function (res) {
                                return res;
                            });
                    });
            }
        })
});

workbox.precaching.precacheAndRoute([]);

// Sync
self.addEventListener('sync', event => {
    console.log('[Service Worker] background syncing');

    if (event.tag === 'sync-new-post') {
        console.log('[Service Worker] syncing new post');
        event.waitUntil(
            readAllData('sync-posts')
                .then(data => {

                    for (var post of data) {
                        let postData = new FormData();

                        postData.append('id', post.id);
                        postData.append('title', post.title);
                        postData.append('location', post.location);
                        postData.append('file', post.picture, post.id + '.png');

                        fetch('https://us-central1-pwa-picnick.cloudfunctions.net/storePostData', {
                            method: 'POST',
                            body: postData,
                        })
                            .then(res => {
                                console.log('Send data', res);

                                if (res.ok) {
                                    res.json()
                                        .then(resData => {
                                            clearItemInData('sync-posts', resData.id);
                                        })
                                }
                            })
                            .catch(err => {
                                console.log("Error while syncing post", err);
                            });
                    }
                })
        );
    }
});

// Notification Click
self.addEventListener('notificationclick', event => {
    var notification = event.notification;
    var action = event.action;

    console.log(notification);

    if (action === 'confirm') {
        console.log('[Notification] confirmed');
    } else {
        console.log(action);

        event.waitUntil(
            clients.matchAll()
                .then(clis => {
                    let client = clis.find(client => {
                        return client.visibilityState === 'visible';
                    });

                    // Ensure to open the link in existing window
                    // if no window opened, open the same in browser
                    if (client) {
                        client.navigate(notification.data.url);
                        client.focus();
                    } else {
                        clients.openWindow(notification.data.url);
                    }

                    notification.close();
                })
        );
    }
});

// Notification Close
self.addEventListener('notificationclose', event => {
    console.log(event);
});

// Listening server side Push evenets
self.addEventListener('push', event => {

    let data = {
        title: 'New Activity!',
        content: 'Something new happened !',
        url: '/'
    };

    if (event.data) {
        data = JSON.parse(event.data.text())
    }

    let options = {
        body: data.content,
        icon: 'src/images/icons/my-app-icon-96-96.png',
        badge: '/src/images/icons/my-app-icon-96-96.png',
        data: {
            url: data.link
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )
});