require('dotenv').config();
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
const { getDatabase} = require('firebase/database');
const { initializeApp } = require('firebase/app');

let firebaseApp;
let database;
let db;

function initializeFirebase() {
    console.log('Initializing Firebase...');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    db = admin.database();

    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    firebaseApp = initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
}

module.exports = { 
    initializeFirebase, 
    getRootDatabase: () => database, 
    getDb: () => db 
};