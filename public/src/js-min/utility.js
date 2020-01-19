var dbPromise=idb.open("posts-store",1,function(t){t.objectStoreNames.contains("posts")||t.createObjectStore("posts",{keyPath:"id"}),t.objectStoreNames.contains("sync-posts")||t.createObjectStore("sync-posts",{keyPath:"id"})});function writeData(r,n){return dbPromise.then(function(t){var e=t.transaction(r,"readwrite");return e.objectStore(r).put(n),e.complete})}function readAllData(e){return dbPromise.then(function(t){return t.transaction(e,"readonly").objectStore(e).getAll()})}function clearAllData(r){return dbPromise.then(function(t){var e=t.transaction(r,"readwrite");return e.objectStore(r).clear(),e.complete})}function clearItemInData(r,n){return dbPromise.then(function(t){var e=t.transaction(r,"readwrite");return e.objectStore(r).clear(n),e.complete})}function urlBase64ToUint8Array(t){for(var e=(t+"=".repeat((4-t.length%4)%4)).replace(/\-/g,"+").replace(/_/g,"/"),r=window.atob(e),n=new Uint8Array(r.length),o=0;o<r.length;++o)n[o]=r.charCodeAt(o);return n}function dataURItoBlob(t){for(var e=atob(t.split(",")[1]),r=t.split(",")[0].split(":")[1].split(";")[0],n=new ArrayBuffer(e.length),o=new Uint8Array(n),a=0;a<e.length;a++)o[a]=e.charCodeAt(a);return new Blob([n],{type:r})}