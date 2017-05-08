module.exports = function(RED) {
    'use strict';
    var Firebase = require('firebase');

    function FirebaseCreateUser(n) {
      RED.nodes.createNode(this, n);

      this.users = n.users;
      this.config = RED.nodes.getNode(n.firebaseconfig);
      this.completeInterval = null;

      this.createUser = function(fbRef, email, password, results) {
        fbRef.createUser({ email: email, password: password }, function(error, userData) {
          if (error) {
            switch (error.code) {
              case "EMAIL_TAKEN":
                console.log("The new user account cannot be created because the email (\""+email+"\") is already in use.");
                break;
              case "INVALID_EMAIL":
                console.log("The specified email (\""+email+"\") is not a valid email.");
                break;
              default:
                console.log("Error creating user (\""+email+"\"): ", error);
            }

            results.push({email: email, error: error});
            // this.send({payload: error});
          } else {
            results.push({email: email, uid: userData.uid});
            // this.send({payload: "Successfully created user account (uid: \""+userData.uid+"\") with email \""+email+"\""});
          }
        }.bind(this));
      }

      this.on('input', function(msg) {

        if (this.config == null || this.config.firebaseurl == null) {
          // this.send({payload: "Must set Firebase in Create User node first"});
          console.error("Must set Firebase in Create User node first")
          return;
        }

        var users = (msg.users == null ? this.users : msg.users);
        // var fbRef = new Firebase('https://'+this.config.firebaseurl+'.firebaseio.com');

        //Building the results array is done in a dirty way that could be cleaned up with a Promise.loop
        var numUsers = users.length;
        var results = [];

        for (var i = 0; i < users.length; i++) {
          this.createUser(this.config.fbConnection.fbRef, users[i].email, users[i].password, results);
        }

        clearInterval(this.completeInterval);
        this.completeInterval = setInterval(function(){
          if (results.length == numUsers) {
            clearInterval(this.completeInterval);
            this.send({payload: results});
          }
        }.bind(this), 100);
      });

      this.on('close', function() {
        //Nothing to do here?
      });

    }
    RED.nodes.registerType('firebase.createUser', FirebaseCreateUser);
};
