const express = require('express');
const session= require('express-session');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const morgan = require('morgan');
const crypto = require('crypto');

const generateSessionSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Require models
const Event = require('./models/event');
const User = require('./models/user');
const { debug } = require('console');

let  = undefined;

main().catch(err => console.log('MONGO CONNECTION ERROR !', err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/partyPlanner');
    console.log("MONGO CONNECTION OPEN !");
}

// Middleware
app.use(
    session({
      secret: generateSessionSecret(),
      resave: false,
      saveUninitialized: false,
    })
  );
  

app.use(express.static('public'));
app.set('views', [path.join(__dirname, 'views'), path.join(__dirname, 'views/includes')]);
app.set('view engine', 'ejs');
app.engine('ejs', ejsMate);
app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use(morgan('tiny'));

const checkSession = (req, res, next) => {
    if(req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

const parseId = (req, res, next) => {
    console.log(req.body.admin);
    const id = req.body.admin;
    console.log(`PARSING ID: ${id}`);
    req.body.admin =  new mongoose.Types.ObjectId(id);
    next();
}

// Access

app.get('/home', async (req, res) => {
    const session = req.session;
    res.render('home', {session});
})

app.get('/login', async (req, res) => {
    const session = req.session;
    res.render('login', {session});
})

app.post('/login', async (req, res) => {
    const {userName, password} = req.body;
    const user = await User.findOne({userName: userName});
    if (user && user.password === password) {
        req.session.userId = user._id;
        req.session.userName = user.userName;
        res.redirect('/events');
    } else {
        res.redirect('/login');
    }
})

app.get('/register', async (req, res) => {
    const session = req.session;
    const formData = {
        userName: "",
        errorMessages: []
    }
    res.render('register', {formData, session});
})

app.post('/register', async (req, res) => {
    const {userName, password, confirmPassword} = req.body;
    const errorMessages = [];
    const takenUserName = await User.findOne({userName: userName});
    if (takenUserName) {
        errorMessages.push("This user name is already taken.")
    }
    if (password !== confirmPassword) {
        errorMessages.push("Passwords do not match.")
    }
    console.log(errorMessages);

    const formData = {
        userName: userName,
        errorMessages: errorMessages
    }

    if (errorMessages.length > 0) {
        const session = req.session;
        res.render('register', {formData, session});
    } else {
        const newUser = new User({
            displayName: userName.toLowerCase(),
            userName: userName,
            password: password
        })

        try {
            await newUser.save();
            console.log("USER ADDED :");
            console.log(newUser);

            req.session.userId = newUser._id;
            req.session.userName = newUser.userName;
            res.redirect('/events');
        } catch (e) {
            console.log(e);
            res.redirect('/register', {formData});
        }

    }    
})

app.get('/logout', async (req, res) => {

    delete req.session.userId;
    delete req.session.userName;
    res.redirect('/home');

})

app.get('/events', checkSession, async (req, res) => {
    const session = req.session;
    const user = await User.findOne({_id: req.session.userId})
        .populate([
            {
                path: 'attendedEvents',
                populate: {
                    path: 'admin'
                }
            },
            {
                path: 'pendingEvents',
                populate: {
                    path: 'admin'
                }
            }
        ])

    const attendedEvents = user.attendedEvents;
    attendedEvents.sort((a, b) => a.date - b.date);
    const pendingEvents = user.pendingEvents;
    pendingEvents.sort((a, b) => a.date - b.date);
    res.render('events/index', {attendedEvents, pendingEvents, session});
});

app.get('/events/new', checkSession, (req, res) => {
    const session = req.session;
    res.render('events/new', {session});
})

app.post('/events', parseId, async (req, res) => {
    const newEvent = new Event(req.body);
    console.log(req.body.time);
    const hours = parseInt(req.body.time.substring(0, 2));
    const minutes = parseInt(req.body.time.substring(3));
    newEvent.date.setHours(hours);
    newEvent.date.setMinutes(minutes);

    try {
        // Add created event to admin's attended events
        const eventAdmin = await User.findById(newEvent.admin);
        eventAdmin.attendedEvents.push(newEvent);

        // Add admin to attended guests
        const adminGuest = {
            user: eventAdmin,
            foods: [],
            drinks: [],
            other: []
        }

        newEvent.attendedGuests.push(adminGuest);

        // Save to database 

        await eventAdmin.save();
        await newEvent.save();
        console.log('EVENT ADDED :');
        console.log(newEvent);

        

        // Redirect to event page
        res.redirect(`/events/${newEvent._id}`);
    } catch (e) {
        console.log(e);
        res.redirect('/events');
    }
    
})

app.get('/events/:id', checkSession, async (req, res) => {
    const session = req.session;
    const { id } = req.params;
    const event = await Event.findById(id).populate(['admin', 'attendedGuests.user', 'pendingGuests']);
    res.render('events/show', {event, session});
})

// WORK IN PROGRESS

app.patch('/events/:id/attend', checkSession, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    try {

        const event = await Event.findById(id).populate(['admin', 'attendedGuests', 'attendedGuests.user', 'pendingGuests']);
        const loggedUser = await User.findById(session.userId).populate((['attendedEvents', 'pendingEvents']));
        console.log("LOGGED IN USER :", loggedUser);

        // delete the user from event's pending guests and add it to attended guests
        event.pendingGuests.splice(event.pendingGuests.indexOf(loggedUser), 1);

        const attendingGuest = {
            user: loggedUser,
            foods: [],
            drinks: [],
            other: []
        }

        event.attendedGuests.push(attendingGuest);

        // Update Event
        // await Event.findByIdAndUpdate(event._id, event, {new: true, runValidators: true});
        await event.save();


        // delete the event from user's pending events and add it to attended events;
        loggedUser.pendingEvents.splice(loggedUser.pendingEvents.indexOf(event), 1);
        loggedUser.attendedEvents.push(event);

        console.log("UPDATED PENDING EVENTS :", loggedUser.pendingEvents);
        console.log("UPDATED ATTENDED EVENTS :", loggedUser.attendedEvents);

        // Update User
        // await User.findByIdAndUpdate(loggedUser._id, loggedUser, {new: true, runValidators: true});
        await loggedUser.save();
        console.log("USER UPDATED :", loggedUser);
        // Redirect to event page
        res.redirect(`/events/${event._id}`);

    } catch (e) {
        console.log(e);
        res.redirect('/events');
    }
        
})

app.patch('/events/:id/decline', checkSession, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    try {

        const event = await Event.findById(id).populate(['admin', 'attendedGuests', 'pendingGuests']);
        const user = await User.findById(session.userId).populate((['attendedEvents', 'pendingEvents']));

        // delete the event from user's pending events
        user.pendingEvents.splice(user.pendingEvents.indexOf(event), 1);

        // Update User
        await User.findByIdAndUpdate(user._id, user, {new: true, runValidators: true});

        // Redirect to event index
        res.redirect(`/events`);

    } catch (e) {
        console.log(e);
        res.redirect('/events');
    }
        
})

// WORK IN PROGRESS

app.get('/events/:id/items', checkSession, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    // Retrieve event and user
    const event = await Event.findById(id).populate(['admin', 'attendedGuests', 'attendedGuests.user']);
    let editGuest = null;

    // Find logged in user
    for (let guest of event.attendedGuests) {

        if (guest.user.userName === session.userName) {
            
            editGuest = guest;

        }

    }

    if (editGuest) {


        const foods = editGuest.foods;
        const drinks = editGuest.drinks;
        const other = editGuest.other;

        res.render('events/editItems', {event, session, foods, drinks, other});
    } else {
        res.redirect('/events');
    }

    
})

app.get('/events/:id/address', checkSession, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    // Retrieve event and user
    const event = await Event.findById(id).populate(['admin', 'attendedGuests', 'attendedGuests.user']);
    let editGuest = null;

    if (session.userName === event.admin.userName) {


        const address = event.address;
        const accessDetails = event.accessDetails;

        res.render('events/editAddress', {event, session, address, accessDetails});
    } else {
        res.redirect('/events');
    }

    
})

app.patch('/events/:id/invite', async(req, res) => {
    const {id} = req.params;
    try {
        const event = await Event.findById(id);
        const guest = await User.findOne({userName: req.body.pendingGuest});

        event.pendingGuests.push(guest);
        await Event.findByIdAndUpdate(id, event, {new: true, runValidators: true})

        guest.pendingEvents.push(event);
        await User.findByIdAndUpdate(guest._id, guest, {new: true, runValidators: true})
        
        console.log('EVENT UPDATED :');
        console.log(event);
        res.redirect(`/events/${event._id}`);
    } catch (e) {
        console.log(e);
        res.redirect(`/events`);
    }
    
})

app.patch('/events/:id/items', async(req, res) => {
    const {id} = req.params;

    try {
        const event = await Event.findById(id).populate('attendedGuests.user');
        const user = await User.findById(req.body.user);

        // Clean up empty array indexes
        for (let food of req.body.foods) {

            if (food === "") {
                req.body.foods.splice(req.body.foods.indexOf(food), 1);
            }
        }

        for (let drink of req.body.drinks) {

            if (drink === "") {
                req.body.drinks.splice(req.body.drinks.indexOf(drink), 1);
            }
        }

        for (let other of req.body.other) {

            if (other === "") {
                req.body.other.splice(req.body.other.indexOf(other), 1);
            }
        }

        // Edit event guest item list
        for (let guest of event.attendedGuests) {

            if (guest.user.userName === user.userName) {

                guest.foods = req.body.foods;
                guest.drinks = req.body.drinks;
                guest.other = req.body.other;

            }
        }

        await event.save();
        console.log("EVENT UPDATED :", event);
        res.redirect(`/events/${event._id}`);
        
    } catch (e) {
        console.log(e);
        res.redirect(`/events`);
    }
    
})

app.patch('/events/:id/address', async(req, res) => {
    const {id} = req.params;

    try {
        const event = await Event.findById(id).populate('attendedGuests.user');
        event.address = req.body.address;
        event.accessDetails = req.body.accessDetails;

        await event.save();
        console.log("EVENT UPDATED :", event);
        res.redirect(`/events/${event._id}`);
        
    } catch (e) {
        console.log(e);
        res.redirect(`/events`);
    }
    
})

app.delete('/events/:id', async(req, res) => {
    const {id} = req.params;
    const event = await Event.findByIdAndDelete(id, req.body, {new: true})
    // DELETE EVENT FROM USER EVENT LIST
    console.log('EVENT DELETED :');
    console.log(event);
    res.redirect(`/events`);
})

app.get('/users', async (req, res) => {
    try {
      const query = req.query.q;
      const eventId = req.query.e;

      const users = await User.find({ userName: new RegExp(query, 'i') });
      const event = await Event.findById(eventId).populate(['admin', 'attendedGuests', 'pendingGuests']);

      let allGuests = [];
      allGuests = [...event.attendedGuests, ...event.pendingGuests];
      allGuests.push(event.admin);

      const filteredUsers = users.filter((user) => {

        let sameUserNameCount = 0;

        for (let guest of allGuests) {
            
            if (user.userName === guest.userName) sameUserNameCount++;

        }

        return sameUserNameCount === 0;

      })

      res.json(filteredUsers);

      console.log("FILTERED USERS :", filteredUsers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/', async (req, res) => {
    res.redirect('/home');
  })


app.use((req, res) => {
    res.send('404 NOT FOUND!');
})


app.listen(3000, () => {
    console.log('App listening on port 3000.')
});

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

