var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var form = document.querySelector("form");
var titleInput = document.querySelector("#title");
var locationInput = document.querySelector("#location");

var videoPlayer = document.querySelector("#player");
var canvasElement = document.querySelector("#canvas");
var captureButton = document.querySelector("#capture-btn");
var imagePicker = document.querySelector("#image-picker");
var imagePickerArea = document.querySelector("#pick-image");
var picture;

var locationButton = document.querySelector('#location-btn');
var locationLoader = document.querySelector("#location-loader");
var fetchedLocation;

locationButton.addEventListener('click', function (event) {
  locationButton.style.display = 'none';
  locationLoader.style.display = 'block';

  event.preventDefault();

  navigator.geolocation.getCurrentPosition(function (position) {
    fetchedLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    console.log(position);

    fetch('https://geocode.xyz/' + fetchedLocation.lat + ',' + fetchedLocation.lng + '}?json=1&auth=180947445731522388161x2832')
      .then(function (response) {
        return response.json();
      })
      .then(function (loc) {
        var address = loc.city;

        if (loc.osmtags && loc.osmtags.name) {
          address += ", " + loc.osmtags.name;
          locationInput.value = address;
          locationInput.parentElement.classList.add('is-focused');
          locationLoader.style.display = 'none';
        }
        console.log(loc);
      })
      .catch(function (err) {
        console.log(err);
      })


    //locationInput.value = fetchedLocation.lat + ", " + fetchedLocation.lng;
    //locationInput.parentElement.classList.add('is-focused');

  }, function (err) {
    console.log("Error getting location", err);
    locationButton.style.display = 'inline';
    locationLoader.style.display = 'none';
    fetchedLocation = { lat: null, lng: null };
    alert("Could not fetch location, please enter manually!");
  }, { timeout: 15000 });

  return;
});

function initLocation() {
  if (!('geolocation' in navigator)) {
    locationButton.style.display = 'none';
  }
}

function initMedia() {
  // Checks Camera/Mic access API in browser
  if (!('mediaDevices' in navigator)) {
    navigator.mediaDevices = {};
  }

  if (!('getUserMedia' in navigator.mediaDevices)) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented'));
      }

      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      })
    };
  }

  //
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(function (stream) {
      videoPlayer.srcObject = stream;
      videoPlayer.style.display = 'block';

    })
    .catch(function (err) {
      // Error me occur due to
      // - User denied the access to camera
      // - Devide does not have the camera
      // - browser does not support the camera access
      imagePickerArea.style.display = 'block';
    })
}

captureButton.addEventListener('click', function (event) {
  canvasElement.style.display = 'block';
  captureButton.style.display = 'none';
  videoPlayer.style.display = 'none';

  var canvasContext = canvasElement.getContext('2d');
  var imageWidth = canvasElement.width;
  var imageHeight = videoPlayer.videoHeight / (videoPlayer.videoWidth / canvasElement.width);

  canvasContext.drawImage(videoPlayer, 0, 0, imageWidth, imageHeight);

  if (videoPlayer && videoPlayer.srcObject) {
    videoPlayer.srcObject.getVideoTracks().forEach(function (track) {
      track.stop();
    });
  }

  picture = dataURItoBlob(canvasElement.toDataURL())
});

imagePicker.addEventListener("change", function (event) {
  picture = event.target.files[0];
});

function openCreatePostModal() {
  createPostArea.style.transform = 'translateY(0vh)';
  captureButton.style.display = 'inline';

  initMedia();
  initLocation();

  if (defferedPrompt) {
    defferedPrompt.prompt(); //showing Add to Home Popup

    // Below code executes when user reacts to Add to Home Popup
    defferedPrompt.userChoice.then(function (userChoice) {
      console.log(userChoice.outcome);

      // Track user choise
      if (userChoice.outcome === "dismissed") {
        console.log("User cancelled installation");
      } else {
        console.log("User added PWA App to Home Screen");
      }
    });

    defferedPrompt = null; // Set this to null as Chrome anyway would not show the popup again
  }
}

function closeCreatePostModal() {
  //createPostArea.style.display = 'none';
  createPostArea.style.transform = 'translateY(100vh)';
  imagePickerArea.style.display = 'none';
  videoPlayer.style.display = 'none';
  canvasElement.style.display = 'none';
  locationButton.style.display = 'inline-block';
  locationLoader.style.display = 'none';

  titleInput.value = "";
  locationInput.value = "";

  if (videoPlayer && videoPlayer.srcObject) {
    videoPlayer.srcObject.getVideoTracks().forEach(function (track) {
      track.stop();
    });
  }
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

function createCards(data) {
  var sharedMoments = document.querySelector("#shared-moments");
  var $cards = "";

  // reverse data to render latest first
  data = data.reverse();

  // Empty Existing Cards 
  sharedMoments.innerHTML = "";

  for (var i = 0; i < data.length; i++) {
    $cards += '<div class="shared-moment-card mdl-card mdl-shadow--2dp">' +
      '<div class="mdl-card__body card-body">' +
      '<img src="' + data[i].picture + '" />' +
      '</div>' +
      '<div class="mdl-card__supporting-text mdl-typography--text-center">' + data[i].title + ' (' + data[i].location + ')</div>' +
      '</div>';
  }

  sharedMoments.innerHTML += $cards;
}

var postApiUrl = 'https://pwa-picnick.firebaseio.com/posts.json';
var networkDataReceived = false;

fetch(postApiUrl)
  .then(function (response) { return response.json() })
  .then(function (data) {
    console.log('From Network', data);
    var posts = [];

    networkDataReceived = true;

    for (key in data) {
      posts.push(data[key]);
    }
    createCards(posts);
  });

if ('indexedDB' in window) {
  readAllData('posts')
    .then(function (data) {
      if (!networkDataReceived) {
        console.log('From indexDB', data);
        createCards(data);
      }
    })
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  // Validation
  if (!titleInput.value.trim().length || !locationInput.value.trim().length) {
    alert("Please enter valid data!");
    return;
  }

  var post = {
    id: new Date().toISOString(),
    title: titleInput.value.trim(),
    location: locationInput.value.trim(),
    picture: picture
  };

  // Close modal
  closeCreatePostModal();

  // Register SyncManager
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then(function (sw) {
        // save data to indexedDB
        writeData('sync-posts', post)
          .then(function () {
            sw.sync.register('sync-new-post');
          })
          .then(function () {
            var snackbar = document.querySelector("#confirmation-toast");
            var data = { message: 'Your post is saved for syncing!' };
            snackbar.MaterialSnackbar.showSnackbar(data);
          })
          .catch(function (err) {
            console.log(err);
          });


      })
  } else {
    sendData(post)
  }

});

function sendData(post) {
  var postData = new FormData();

  postData.append('id', post.id);
  postData.append('title', post.title);
  postData.append('location', post.location);
  postData.append('file', post.picture, post.id + '.png');

  fetch('https://us-central1-pwa-picnick.cloudfunctions.net/storePostData', {
    method: 'POST',
    body: postData//JSON.stringify(post)
  })
    .then(function (res) {
      console.log('Send data', res);
    })
}
