var nodemailer = require('nodemailer');
var smtpTransport= require('nodemailer-smtp-transport');
var async= require('async');

var crypto = require('crypto');
var User = require('../models/user');
var Company = require('../models/company');
var secret = require('../secret/secret');

module.exports = (app, passport) => {

    app.get('/', (req, res, next) => {

        if(req.session.cookie.originalMaxAge !== null) {
            res.redirect('/home');
        }
        else {
            Company.find({}, (err, result) => {
                res.render('index', {title: 'Index || RateMe',data: result});
            });
        }
    });

    app.get('/signup', (req, res) => {
        var errors = req.flash('error');
        res.render('user/signup', {title: 'Sign Up || RateMe', messages: errors, hasErrors: errors.length > 0});
    });

    app.post('/signup', validate, passport.authenticate('local.signup', {
        successRedirect: '/',
        failureRedirect: '/signup',
        failureFlash: true
    }));

    app.get('/login', (req, res) => {
        var errors = req.flash('error');
        res.render('user/login', {title: 'Login || RateMe', messages: errors, hasErrors: errors.length > 0});
    });

    app.post('/login', loginValidation, passport.authenticate('local.login', {
        //successRedirect: '/home',
        failureRedirect: '/login',
        failureFlash: true
    }), (req, res) => {
        if(req.body.rememberme) {
            req.session.cookie.maxAge = 30*24*60*60*1000; // 30 days
        }
        else {
            req.session.cookie.expires = null;
        }

        res.redirect('/home');
    });

    app.get('/auth/facebook', passport.authenticate('facebook', {scope: 'email'}));

    app.get('/auth/facebook/callback', passport.authenticate('facebook', {
        successRedirect: '/home',
        failureRedirect: '/login',
        failureFlash: true
    }));

    app.get('/home', isLoggedIn, (req, res) => {
        res.render('home', {title: 'Home || RateMe', user: req.user});
    });

    app.get('/forgot', (req, res) => {
        var errors = req.flash('error');
        var info = req.flash('info');        
        res.render('user/forgot', {
            title: 'Request Password Reset',
            messages: errors, hasErrors: errors.length > 0,
            info: info, noErrors: info.length > 0
        });
    });

    app.post('/forgot', (req, res, next) => {
        async.waterfall([
            //randomly generate a length of 20 chars string
            function(callback) {
                
                crypto.randomBytes(20, (err, buf) => {
                    //save the random string to var rand
                    var rand = buf.toString('hex');
                    callback(err, rand);
                });
            },

            //check the email is exist or not 
            function(rand, callback) {
                //find(): return an array with objects
                //findOne(): return an object
                //req.body.'email': according to input's name attr
                
                User.findOne({'email': req.body.email}, (err, user) => {
                    if(!user) {
                        req.flash('error', 'No account with that email exist or email is invalid');
                        return res.redirect('/forgot');
                    }

                    user.passwordResetToken = rand;
                    //passwordResetToken will be invalid after 1 hr
                    //60*60*1000(ms) = 1(hr) 
                    user.passwordResetExpires = Date.now() + 60*60*1000;

                    user.save((err) => {
                        callback(err, rand, user);
                    });
                });
            },

            //send the email to the user
            function(rand, user, callback) {
                var smtpTransport = nodemailer.createTransport({
                    service: 'Gmail',
                    //the email which the server send the emails to the user
                    auth: {
                        user: secret.auth.user,
                        pass: secret.auth.pass
                    }
                });

                var mailOptions = {
                    to: user.email,
                    from: 'RateMe <' + secret.auth.user + '>',
                    subject: 'RateMe Application Password Reset Token',
                    text: 'You have request for password reset token. \n\n' +
                        'Please click on the link to complete the process: \n\n' +
                        'http://localhost:3000/reset/' + rand + '\n\n'
                };

                smtpTransport.sendMail(mailOptions, (err, response) => {
                    req.flash('info', 'A password reset token has been sent to ' + user.email);
                    return callback(err, user);
                });
            }
        ], (err) => {
            if(err) {
                return next(err);
            }

            res.redirect('/forgot');
        })
    });

    app.get('/reset/:token', (req, res) => {
        
        //$gt: greater than
        User.findOne({
            passwordResetToken:req.params.token,
            passwordResetExpires: {$gt: Date.now()}},
            (err, user) => {
            if(!user){
                req.flash('error', 'Password reset token has expired or is invalid. Enter your email to get a new token.');
                return res.redirect('/forgot');
            }
            var errors = req.flash('error');
            var success = req.flash('success');
            
            res.render('user/reset', {
                title: 'Reset Your Password',
                messages: errors, hasErrors: errors.length > 0,
                success: success, noErrors: success.length > 0
            });
        });
    });

    app.post('/reset/:token', (req, res) => {
        async.waterfall([
            function(callback) {
                User.findOne({
                    passwordResetToken:req.params.token,
                    passwordResetExpires: {$gt: Date.now()}},
                    (err, user) => {
                    if(!user){
                        req.flash('error', 'Password reset token has expired or is invalid. Enter your email to get a new token.');
                        return res.redirect('/forgot');
                    }

                    //password validation
                    req.checkBody('password', 'Password is required').notEmpty();
                    req.checkBody('password', 'Password must not be less than 5').isLength({ min: 5 });
                    req.check("password", "Password Must Contain at least 1 Number.").matches(/^(?=.*\d)(?=.*[a-z])[0-9a-z]{5,}$/, "i");
                    
                    var errors = req.validationErrors();

                    //check if password & confirm password is equal
                    if(req.body.password == req.body.cpassword) {
                        if(errors) {
                            var messages = [];
                            errors.forEach((error) => {
                                messages.push(error.msg);
                            });

                            var errors = req.flash('error');
                            res.redirect('/reset/' + req.params.token);
                        }
                        //save new password
                        else {
                            user.password = user.encryptPassword(req.body.password);
                            //del the reset token & expires
                            user.passwordResetToken = undefined;
                            user.passwordResetExpires = undefined;

                            user.save((err) => {
                                req.flash('success', 'Your password has been successfully updated.');
                                callback(err, user);
                            });
                        }
                    }
                    else {
                        req.flash('error', 'Password and confirm password are not equal.');
                        res.redirect('/reset/' + req.params.token);
                    }
                });
            },

            //send email to the user  that the password has been updated
            function(user, callback) {
                var smtpTransport = nodemailer.createTransport({
                    service: 'Gmail',
                    //the email which the server send the emails to the user
                    auth: {
                        user: secret.auth.user,
                        pass: secret.auth.pass
                    }
                });

                var mailOptions = {
                    to: user.email,
                    from: 'RateMe <' + secret.auth.user + '>',
                    subject: 'Your password has been updated',
                    text: 'this is a confirmation that you updated the password for ' + user.email
                };

                smtpTransport.sendMail(mailOptions, (err, response) => {
                    callback(err, user);

                    var error = req.flash('error');
                    var success = req.flash('success');

                    res.render('user/reset', {
                        title: 'Reset Your Password',
                        messages: error, hasErrors: error.length > 0,
                        success: success, noErrors: success.length > 0
                    });
                });
            }
        ]);
    });

    app.get('/logout', (req, res) => {
        //logout() is passport's method
        req.logout();

        //destroy the session
        req.session.destroy((err) => {
            res.redirect('/');
        });
    });
}

function validate(req, res, next) {
    req.checkBody('fullname', 'Fullname is Required').notEmpty();
    req.checkBody('fullname', 'Fullname must not be less than 5').isLength({ min: 5 });
    req.checkBody('email', 'Email is required').notEmpty();
    req.checkBody('email', 'Email is invalid').isEmail();
    req.checkBody('password', 'Password is required').notEmpty();
    req.checkBody('password', 'Password must not be less than 5').isLength({ min: 5 });
    req.check("password", "Password Must Contain at least 1 Number.").matches(/^(?=.*\d)(?=.*[a-z])[0-9a-z]{5,}$/, "i");

    var errors = req.validationErrors();

    if(errors) {
        var messages = [];
        errors.forEach((error) => {
            messages.push(error.msg);
        });

        req.flash('error', messages);
        res.redirect('/signup');
    }
    else {
        //move to the next callback
        return next();
    }
}

function loginValidation(req, res, next) {
    req.checkBody('email', 'Email is required').notEmpty();
    req.checkBody('email', 'Email is invalid').isEmail();
    req.checkBody('password', 'Password is required').notEmpty();
    req.checkBody('password', 'Password must not be less than 5 characters').isLength({ min: 5 });
    req.check("password", "Password Must Contain at least 1 Number.").matches(/^(?=.*\d)(?=.*[a-z])[0-9a-z]{5,}$/, "i");

    var loginErrors = req.validationErrors();

    if(loginErrors) {
        var messages = [];
        loginErrors.forEach((error) => {
            messages.push(error.msg);
        });

        req.flash('error', messages);
        res.redirect('/login');
    }
    else {
        //move to the next callback
        return next();
    }
}

function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()) {
        next();
    }
    else {
        res.redirect('/');
    }
}