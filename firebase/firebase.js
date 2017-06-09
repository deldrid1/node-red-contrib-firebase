const firebase = require ("firebase/app");
require ("firebase/auth");
require ("firebase/database"); 

//import firebase from 'firebase/app';
//import 'firebase/auth';
//import 'firebase/database';


exports.mainApp = firebase.initializeApp({databaseURL: firebaseurl});

//module.exports.mainApp = mainApp.database();


