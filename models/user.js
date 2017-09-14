var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');


var userSchema = mongoose.Schema({
    fullname: { type: String, require: true },
    email: { type: String, require: true },
    password: { type: String},//if sign up with fb, then pasword isn't require
    role: { type: String, default: '' },
    company: {
        name: { type: String, default: '' },
        image: { type: String, default: '' }
    },
    passwordResetToken: { type: String, default: '' },
    passwordResetExpires: { type: Date, default: Date.now },
    facebook: { type: String, default: '' },
    tokens: Array
});

userSchema.methods.encryptPassword = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
}

//because the keyword 'this', use normal function, not arrow function
userSchema.methods.validPassword = function(password) {
    //password: the password user typed
    //this.password: the password in database
    return bcrypt.compareSync(password, this.password);
}

module.exports = mongoose.model('User', userSchema);