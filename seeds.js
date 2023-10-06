const mongoose = require('mongoose');
const Event = require('./models/event');
const User = require('./models/user');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/partyPlanner');
      console.log("MONGO CONNECTION OPEN !");
  }

main().catch(err => console.log('MONGO CONNECTION ERROR !', err));



const seedUsers = [
    {
        userName: 'Didier',

        password: 'AirSlasher',

        attendedEvents: [],

        pendingEvents: []
    },

    {
        userName: 'Zangief',

        password: '123SuperPileDriver',

        attendedEvents: [],

        pendingEvents: []
    },

    {
        userName: 'Juri',

        password: 'FengShuiEngine',

        attendedEvents: [],

        pendingEvents: []
    },
]

User.insertMany(seedUsers)
    .then(res => {
        console.log(res);
    })
    .catch(e => {
        console.log(e);
    })


async function getAdminId() {
    try {
        const user = await User.findOne({userName: 'Didier'}, '_id');

        if(user) {
            return user._id;
        } else {
            console.log('User not found.')
        }
        
    } catch (error) {
        console.error('Error retrieving user:', error);
    }
}




async function seedEvents() {
    try {

        const adminId = await getAdminId();

        if(adminId) {
            const seedEvents = [ 
                {
                    name: 'Street Fighter partay',
            
                    admin: adminId,
            
                    guests: [],
            
                    address: '4 rue de Shadaloo',
            
                    accessDetails: `Code: 1234, sonner à l'interphone et dire "MAXIMUM"`,
            
                    date: Date.now(),
            
                    foods: [],
            
                    drinks: [],
            
                    other: []
                },
            
                {
                    name: 'Street Fighter partay',
            
                    admin: adminId,
            
                    guests: [],
            
                    address: '4 rue de Shadaloo',
            
                    accessDetails: `Code: 1234, sonner à l'interphone et dire "MAXIMUM"`,
            
                    date: Date.now(),
            
                    foods: [],
            
                    drinks: [],
            
                    other: []
                },
            
                {
                    name: 'Street Fighter partay',
            
                    admin: adminId,
            
                    guests: [],
            
                    address: '4 rue de Shadaloo',
            
                    accessDetails: `Code: 1234, sonner à l'interphone et dire "MAXIMUM"`,
            
                    date: Date.now(),
            
                    foods: [],
            
                    drinks: [],
            
                    other: []
                },       
            ]

            Event.insertMany(seedEvents)
                .then(res => {
                    console.log(res);
                })
                .catch(e => {
                    console.log(e);
                })
        }
    } catch (error) {

        console.error('Error seeding events:', error)
        
    }
}

seedEvents();

const events = Event.find({}).populate