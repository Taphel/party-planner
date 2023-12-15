const mongoose = require('mongoose');
const Event = require('./event');

const userSchema = new mongoose.Schema({

    displayName: {
        type: String,
        trim: true,
        required: true,
        maxLength: 15,
        minLength: 1
    },

    userName: {
        type: String,
        required: true,
        maxLength: 15,
        minLength: 4
    },

    password: {
        type: String,
        required: true
    },



    attendedEvents: [{type: mongoose.Schema.Types.ObjectId, ref: ('Event')}], // EVENEMENTS

    pendingEvents: [{type: mongoose.Schema.Types.ObjectId, ref: ('Event')}] // EVENEMENTS
})

const User = mongoose.model('User', userSchema);

module.exports = User;