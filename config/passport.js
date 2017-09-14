var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var User = require('../models/user');
var secret = require('../secret/secret');

//done is the callback function
passport.serializeUser((user, done) => {
    //save user.id to the session
    done(null, user.id);
});

//retrieve the user date
passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        //if found, save data in user, otherwise error happend
        done(err, user);
    });
});

passport.use('local.signup', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, (req, email, password, done) => {
    User.findOne({ 'email': email }, (err, user) => {
        //this err is not email duplication, maybe connection error
        if(err) {
            return done(err);
        }

        //email duplication
        if(user) {
            return done(null, false, req.flash('error', 'User with email already exist.'));
        }

        //if email check is OK => create new user      
        var newUser = new User();
        newUser.fullname = req.body.fullname;
        newUser.email = req.body.email;
        newUser.password = newUser.encryptPassword(req.body.password);
        
        newUser.save((err) => {
            return done(null, newUser);
        });
    });
}));

passport.use('local.login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
}, (req, email, password, done) => {

    User.findOne({ 'email': email }, (err, user) => {
        //this err is not email duplication, maybe connection error
        if(err) {
            return done(err);
        }

        var messages = [];

        if(!user || !user.validPassword(password)) {
            messages.push('Email does not exist or password is invalid');
            return done(null, false, req.flash('error', messages));
        }

        return done(null, user);
    });
}));

passport.use(new FacebookStrategy(secret.facebook, (req, token, refreshToken, profile, done) => {
    User.findOne({facebook: profile.id}, (err, user) => {
        if(err) {
            return done(err);
        }

        //user has signed up
        if(user) {
            return done(null, user);
        }
        //user has not sign up
        else {
            var newUser = new User();
            newUser.facebook = profile.id;
            newUser.fullname = profile.displayName;
            newUser.email= profile._json.email;
            newUser.tokens.push({token: token});

            newUser.save((err) => {
                return done(null, newUser);
            });
        }
    })
}));