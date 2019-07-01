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

workbox.precaching.precacheAndRoute([
  {
    "url": "404.html",
    "revision": "0a27a4163254fc8fce870c8cc3a3f94f"
  },
  {
    "url": "favicon.ico",
    "revision": "29cf8efac9aa72f6f6d0e894d62d3849"
  },
  {
    "url": "index.html",
    "revision": "f61d9de51ec48ffbad5fe52642d9132c"
  },
  {
    "url": "manifest.json",
    "revision": "142f62bd56fc93f89a78335d1beb4948"
  },
  {
    "url": "offline.html",
    "revision": "f573a1e274c25246bc15bc0aec5c1456"
  },
  {
    "url": "service-worker.js",
    "revision": "dfe111376f8fa8590f46cf9805669680"
  },
  {
    "url": "src/css/app.css",
    "revision": "11a283baa62cd33735a8543ae46d8884"
  },
  {
    "url": "src/css/feed.css",
    "revision": "3e33e421b5185a76d653b609b2cc82ac"
  },
  {
    "url": "src/css/help.css",
    "revision": "1c6d81b27c9d423bece9869b07a7bd73"
  },
  {
    "url": "src/js/app.js",
    "revision": "d0538a96820756d0dc2d95ddcfa5104a"
  },
  {
    "url": "src/js/feed.js",
    "revision": "cd27e711fca75949c3aa7c153e049aa7"
  },
  {
    "url": "src/js/idb.js",
    "revision": "017ced36d82bea1e08b08393361e354d"
  },
  {
    "url": "src/js/material.min.js",
    "revision": "713af0c6ce93dbbce2f00bf0a98d0541"
  },
  {
    "url": "src/js/utility.js",
    "revision": "e4599607e33aaba483b962c42e4256f2"
  },
  {
    "url": "sw-base.js",
    "revision": "7a652d5356de04ad4c9043fe74e0c6ec"
  },
  {
    "url": "src/images/image-not-loaded.jpg",
    "revision": "6d223a249029dd0078d0f162fa825b05"
  },
  {
    "url": "src/images/main-image-lg.png",
    "revision": "c08fa0fc195c0ba1f0504b89b2a8d734"
  },
  {
    "url": "src/images/main-image-sm.png",
    "revision": "543332ec46c825d679c67e79025940f4"
  },
  {
    "url": "src/images/main-image.png",
    "revision": "742a736f11ef02b3fdadf9956c09ca66"
  }
]);

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