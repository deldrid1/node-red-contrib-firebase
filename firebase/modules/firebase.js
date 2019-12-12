const firebase = require ("firebase/app");
require ("firebase/auth");
require ("firebase/database");

//import firebase from 'firebase/app';
//import 'firebase/auth';
//import 'firebase/database';

//need to change to firebaseurl
exports.mainApp = firebase.initializeApp({databaseURL: "https://testing-19109.firebaseio.com"});

//module.exports.mainApp = mainApp.database();


