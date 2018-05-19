const admin = require('firebase-admin');
const functions = require('firebase-functions');
const serviceAccount = process.env.SERVICE_ACCOUNT_KEY ? process.env.SERVICE_ACCOUNT_KEY : require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://codesnippets-c9eee.firebaseio.com"
});

const db = admin.firestore();

module.exports = { admin, functions, db };
