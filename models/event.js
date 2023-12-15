const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({

    name: {
        type: String,
        trim: true,
        required: true,
        maxLength: 30,
        minLength: 8
    },

    admin: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: ('User'),
        required: true
    },

    attendedGuests: [{
        user: {
            type: mongoose.Schema.Types.ObjectId, 
            ref: ('User')
        },

        foods: [{
            type: String,
            trim: true,
            maxLength: 30
        }],
        drinks: [{
            type: String,
            trim: true,
            maxLength: 30
        }],
        other: [{
            type: String,
            trim: true,
            maxLength: 30
        }]
    }],

    pendingGuests: [{
        type: mongoose.Schema.Types.ObjectId, 
        ref: ('User')
    }],

    address: {
        type: String,
        trim: true,
        maxLength: 100
    },

    accessDetails: {
        type: String,
        trim: true,
        maxLength: 100
    },

    date: {
        type: Date,
        required: true
    }
})

eventSchema.virtual('displayDate').get(function() {

    const options = {
        timeZone: 'Europe/Paris', // Set your local timezone (GMT+2 for Paris)
        weekday: 'long', // Include the day of the week
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      };

    const localizedDateString = this.date.toLocaleString('en-En', options);
      
      // Capitalize the first letter of the day
    const capitalizedDateString =
        localizedDateString.charAt(0).toUpperCase() +
        localizedDateString.slice(1);

    return capitalizedDateString

})

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;