var async = require('async');
var User = require('../models/user');
var Message = require('../models/message');

module.exports = (app) => {
    //id: id of userTo
    app.get('/message/:id', isLoggedIn, (req, res) => {
        async.parallel([
            function(callback) {
                User.findById({'_id': req.params.id}, (err, result1) => {
                    callback(err, result1);
                });
            },
            
            function(callback) {
                Message.find({
                    '$or': [{
                        'userFrom': req.user._id,
                        'userTo': req.params.id
                    }, {
                        'userFrom': req.params.id,
                        'userTo': req.user._id
                    }]
                }, (err, result2) => {
                    
                    callback(err, result2);
                });

            }
        ], (err, results) => {
            console.log(results);
            res.render('messages/message', {
                title: 'Private Message',
                user: req.user,
                data: results[0],//userTo
                chats: results[1]//messages
            });
        });
    });

    app.post('/message/:id', (req, res) => {  
        User.findOne({'_id': req.params.id}, (err, data) => {
            var newMessage = new Message();
            newMessage.userFrom = req.user._id;
            newMessage.userTo = req.params.id;
            newMessage.userFromName = req.user.fullname;
            newMessage.userToName = data.fullname;
            newMessage.body = req.body.message;
            newMessage.createAt = new Date();

            newMessage.save((err) => {
                res.redirect('/message/' + req.params.id);
            })
        });
    });
};

function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()) {
        next();
    }
    else {
        res.redirect('/');
    }
}