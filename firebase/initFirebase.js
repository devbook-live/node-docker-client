const admin = require('firebase-admin');
const functions = require('firebase-functions');
const path = require('path');
const fs = require('fs');

if (process.env.SERVICE_ACCOUNT_KEY) {
  fs.writeFileSync(path.join(__dirname, '..', 'serviceAccountKey.json'), process.env.SERVICE_ACCOUNT_KEY, (err) => {
    if (err) throw err;
  });
}

const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://codesnippets-c9eee.firebaseio.com"
});

const db = admin.firestore();

module.exports = { admin, functions, db };
