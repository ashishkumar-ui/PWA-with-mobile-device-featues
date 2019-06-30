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

      return new Promise((resolve, reject) => {
        getUserMedia.call(navigator, constraints, resolve, reject);
      })
    };
  }

  //
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoPlayer.srcObject = stream;
      videoPlayer.style.display = 'block';

    })
    .catch(err => {
      // Error me occur due to
      // - User denied the access to camera
      // - Devide does not have the camera
      // - browser does not support the camera access
      imagePickerArea.style.display = 'block';
    })
}

captureButton.addEventListener('click', event => {
  canvasElement.style.display = 'block';
  captureButton.style.display = 'none';
  videoPlayer.style.display = 'none';

  var canvasContext = canvasElement.getContext('2d');
  var imageWidth = canvasElement.width;
  var imageHeight = videoPlayer.videoHeight / (videoPlayer.videoWidth / canvasElement.width);

  canvasContext.drawImage(videoPlayer, 0, 0, imageWidth, imageHeight);
  videoPlayer.srcObject.getVideoTracks().forEach(track => track.stop());

  picture = dataURItoBlob(canvasElement.toDataURL())
});

function openCreatePostModal() {
  createPostArea.style.transform = 'translateY(0vh)';

  initMedia();

  if (defferedPrompt) {
    defferedPrompt.prompt(); //showing Add to Home Popup

    // Below code executes when user reacts to Add to Home Popup
    defferedPrompt.userChoice.then(userChoice => {
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
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

function createCards(data) {
  var sharedMoments = document.querySelector("#shared-moments");
  var $cards = "";

  sharedMoments.innerHTML = "";

  for (let i = 0; i < data.length; i++) {
    $cards += `<div class="shared-moment-card mdl-card mdl-shadow--2dp">
      <div class="mdl-card__title card-title" style="background-image: url(${data[i].picture})">
        <h2 class="mdl-card__title-text" style="color: white">${data[i].title}</h2>
      </div>
      <div class="mdl-card__supporting-text mdl-typography--text-center">${data[i].location}</div>
    </div>`;
  }

  sharedMoments.innerHTML += $cards;
}

var postApiUrl = 'https://pwa-picnick.firebaseio.com/posts.json';
var networkDataReceived = false;

fetch(postApiUrl)
  .then(response => { return response.json() })
  .then(data => {
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
    .then(data => {
      if (!networkDataReceived) {
        console.log('From indexDB', data);
        createCards(data);
      }
    })
}

form.addEventListener("submit", event => {
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
      .then(sw => {
        // save data to indexedDB
        writeData('sync-posts', post)
          .then(() => {
            sw.sync.register('sync-new-post');
          })
          .then(() => {
            var snackbar = document.querySelector("#confirmation-toast");
            var data = { message: 'Your post is saved for syncing!' };
            snackbar.MaterialSnackbar.showSnackbar(data);
          })
          .catch(err => {
            console.log(err);
          });


      })
  } else {
    sendData(post)
  }

});

function sendData(post) {
  let postData = new FormData();

  postData.append('id', post.id);
  postData.append('title', post.title);
  postData.append('location', post.location);
  postData.append('file', post.picture, post.id + '.png');

  fetch('https://us-central1-pwa-picnick.cloudfunctions.net/storePostData', {
    method: 'POST',
    body: postData//JSON.stringify(post)
  })
    .then(res => {
      console.log('Send data', res);
    })
}
