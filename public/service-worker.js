importScripts("/src/js/idb.js");
importScripts("/src/js/utility.js");

var CACHE_STATIC = "app-shell-v3";
var CACHE_DYNAMIC = "on-the-go-v1";
var AppShell = [
    "/",
    "/index.html",
    "/offline.html",
    "/src/js/idb.js",
    "/src/js/utility.js",
    "/src/js/app.js",
    "/src/js/feed.js",
    "/src/js/material.min.js",
    "/src/css/app.css",
    "src/css/feed.css",
    "src/images/main-image.png",
    "src/images/offline.svg",
    "/src/images/image-not-loaded.jpg",
    "https://fonts.googleapis.com/css?family=Roboto:400,700",
    "https://fonts.googleapis.com/icon?family=Material+Icons",
    "https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.pink-blue.min.css"
];

function trimCache(cacheName, maxItems) {
    caches.open(cacheName)
        .then(cache => {
            return cache.keys().then(keys => {
                if (keys.length >= maxItems) {
                    cache.delete(keys[0])
                        .then(trimCache(cacheName, maxItems));
                }
            });
        });
}

function removeAllCache() {
    navigator.serviceWorker.getRegistrations()
        .then(registrations => {
            for (let i = 0; i < registrations.length; i++) {
                registrations[i].unregister();
            }
        })
}

// Install
self.addEventListener("install", event => {
    console.log("[Service Worker] Installing...");
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache => {
                console.log("[Service Worker] Precaching App Shell...");
                cache.addAll(AppShell);
            })
    );
});

// Activate
self.addEventListener("activate", event => {
    console.log("[Service Worker] Activating...");

    // Deleting Old Cache
    event.waitUntil(
        caches.keys()
            .then(keyList => {
                return Promise.all(keyList.map(key => {
                    if (key != CACHE_STATIC && key !== CACHE_DYNAMIC) {
                        console.log("[Service Worker] Removing old cache", key);
                        return caches.delete(key);
                    }
                }));
            })
    );
    return self.clients.claim();
});

// Fetch
self.addEventListener("fetch", event => {
    trimCache(CACHE_DYNAMIC, 20);

    // Dynamic Caching
    if (event.request.url.indexOf("https://pwa-picnick.firebaseio.com/posts") !== -1) {
        //strategies.cacheFirst(event);
        strategies.indexedDb(event);
    } else if (AppShell.indexOf(event.request.url) !== -1) {
        strategies.cacheOnly(event);
    } else {
        strategies.cacheToNetworkToOffline(event);
    }
});

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
                            .then(err => {
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

// Caching Strategies
var strategies = {
    /**
     * @method
     * @desc Cache only Strategy
     */
    cacheOnly: event => {
        event.respondWith(
            caches.match(event.request)
        );
    },

    /**
     * @method
     * @desc Network only Strategy
     */
    networkOnly: event => {
        event.respondWith(
            caches.match(event.request)
        );
    },

    /**
     * @method
     * @desc Cache Fallback to Network Strategy
     */
    cacheFirst: event => {
        event.respondWith(
            caches.open(CACHE_DYNAMIC)
                .then(cache => {
                    return fetch(event.request)
                        .then(res => {
                            cache.put(event.request, res.clone());
                            return res;
                        });
                })
        )
    },

    /**
     * @method
     * @desc Cache Fallback to Network Strategy with additional showing an offline page when both fails
     */
    cacheToNetworkToOffline: event => {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        // retrun from caches
                        return response;
                    } else {
                        // Making the network request not cache not available
                        return fetch(event.request).then(res => {

                            // Adding this to cache dynamically
                            return caches.open(CACHE_DYNAMIC)
                                .then(cache => {
                                    cache.put(event.request.url, res.clone());
                                    return res;
                                })
                                .catch(err => {
                                    return caches.open(CACHE_STATIC)
                                        .then(cache => {

                                            let requestType = event.request.headers.get("accept");

                                            // Show offline page of HTML requests
                                            if (requestType.includes("text/html")) {
                                                return cache.match("/offline.html");

                                                // any image type, ex: image/jpeg, image/png, image/gif, image/svg
                                            } else if (requestType.includes("image/")) {
                                                return cache.match("/src/images/image-not-loaded.jpg");
                                            }
                                        });
                                });
                        });
                    }
                })
        );
    },

    /**
     * @method
     * @desc Network Fallback to Cache
     */
    networkFirst: event => {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    return caches.open(CACHE_DYNAMIC)
                        .then(cache => {
                            cache.put(event.request.url, res.clone());
                            return res;
                        })
                })
                .catch(err => {
                    return caches.match(event.request);
                })
        )
    },

    /**
     * @method
     * @desc Cache Fallback to Network Strategy
     */
    indexedDb: event => {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    var responseCopy = res.clone();

                    // clear all data
                    // then convert JSON format of data
                    // then write new data to indexedDB
                    clearAllData('posts')
                        .then(() => {
                            return responseCopy.json();
                        })
                        .then(data => {
                            for (var key in data) {
                                writeData('posts', data[key]);
                            }
                        });

                    return res;
                })
        )
    },
};
