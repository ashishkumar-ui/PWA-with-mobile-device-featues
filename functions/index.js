const functions = require('firebase-functions');
const admin = require("firebase-admin");
const cors = require('cors')({ origin: true });
const webpush = require('web-push');
const formidable = require('formidable');
const fs = require('fs');
const UUID = require('uuid-v4');
const googleClouseStorage = require('@google-cloud/storage');
var os = require("os");
var Busboy = require("busboy");
var path = require('path');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//

var gcConfig = {
    projectId: 'pwa-picnick',
    keyFilename: 'pwa-picnick-firebase-key.json'
};

var gcs = googleClouseStorage(gcConfig);

var serviceAccount = require("./pwa-picnick-firebase-key.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://pwa-picnick.firebaseio.com/'
});

exports.storePostData = functions.https.onRequest((request, response) => {
    cors(request, response, () => {
        var uuid = UUID();
        const busboy = new Busboy({ headers: request.headers });
        // These objects will store the values (file + fields) extracted from busboy
        let upload;
        const fields = {};

        // This callback will be invoked for each file uploaded
        busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
            console.log(
                `File [${fieldname}] filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`
            );
            const filepath = path.join(os.tmpdir(), filename);
            upload = { file: filepath, type: mimetype };
            file.pipe(fs.createWriteStream(filepath));
        });

        // This will invoked on every field detected
        busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
            fields[fieldname] = val;
        });


        // This callback will be invoked after all uploaded files are saved.
        busboy.on("finish", () => {
            var bucket = gcs.bucket("pwa-picnick.appspot.com");
            bucket.upload(
                upload.file,
                {
                    uploadType: "media",
                    metadata: {
                        metadata: {
                            contentType: upload.type,
                            firebaseStorageDownloadTokens: uuid
                        }
                    }
                },
                function (err, uploadedFile) {
                    if (err) {
                        console.log("ERROR uploading image", err);
                        return;
                    }
                    var pictureURL = 'https://firebasestorage.googleapis.com/v0/b/' + bucket.name + '/o/' + encodeURIComponent(uploadedFile.name) + '?alt=media&token=' + uuid;

                    admin
                        .database()
                        .ref('posts')
                        .push({
                            id: fields.id,
                            title: fields.title,
                            location: fields.location,
                            picture: pictureURL
                        })
                        .then(() => {
                            webpush.setVapidDetails(
                                'mailto:ashish.kumar@tadigital.com',
                                'BIzqU-Np3ERLPmlGGRHvWNigTK3c4ifoRCn59vzEmvgi2T3oBaYVn0gZK7uWE04ZK86DLIq_IXCQbQTUmfFoBRg',
                                'NorPuHh0LMewclidrGtw_He5PQ8mEqy9aumwFcoiiDE'
                            );

                            return admin
                                .database()
                                .ref('subscriptions')
                                .once('value');
                        })
                        .then(subscriptions => {
                            subscriptions.forEach(subcription => {
                                var pushConfig = {
                                    endpoint: subcription.val().endpoint,
                                    keys: {
                                        auth: subcription.val().keys.auth,
                                        p256dh: subcription.val().keys.p256dh
                                    }
                                };

                                webpush.sendNotification(pushConfig, JSON.stringify({
                                    title: 'Post saved',
                                    content: 'New post added to PicNick!',
                                    link: '/' // also takes absolute path like 'https://pwa-picnick.web.app' 
                                }))
                                    .catch(err => {
                                        console.log(err);
                                    })
                            })
                            response.status(201).json({
                                message: 'Data stored',
                                id: fields.id
                            })
                        })
                        .catch(err => {
                            response.status(500).json({
                                error: err
                            })
                        })
                })
        });

        // The raw bytes of the upload will be in request.rawBody.  Send it to busboy, and get
        // a callback when it's finished.
        busboy.end(request.rawBody);
    })
});
