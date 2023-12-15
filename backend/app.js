const express = require('express');
const session= require('express-session');
const MongoStore = require('connect-mongo');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const morgan = require('morgan');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoSanitize = require('express-mongo-sanitize');
const sanitizeHtml = require("sanitize-html");
const dbUrl = process.env.dbUrl;

// Require models
const Event = require('./models/event');
const User = require('./models/user');
const { debug } = require('console');


main().catch(err => console.log('MONGO CONNECTION ERROR !', err));


// mongodb://127.0.0.1:27017/partyPlanner
async function main() {
    await mongoose.connect(dbUrl);
    console.log("MONGO CONNECTION OPEN !");
}

const generateSessionSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Html cleanup function
const clean = function (dirty) {

    return sanitizeHtml(dirty, {
        allowedTags: [],
        allowedAttributes: {}
    });

}

// Password hashing

const passwordHash = async (password, saltRounds) => {
    try {
      const salt = await bcrypt.genSalt(saltRounds);
      return await bcrypt.hash(password, salt);
    } catch (err) {
      console.log(err);
    }
    return null;
  };

// Delete Event function
const deleteEvent = async function(id) {

    try {
        const event = await Event.findById(id)
        .populate({
            path: 'attendedGuests.user',
            select: 'attendedEvents userName'
        })
        .populate({
            path: 'pendingGuests',
            select: 'pendingEvents'
        });
        console.log("DELETING EVENT : ", event);
    
        // DELETE EVENT FROM USERS EVENT LIST
        for (let attendedGuest of event.attendedGuests) {
            console.log("ATTENDED GUEST :", attendedGuest.user);
            for (let attendedEvent of attendedGuest.user.attendedEvents) {
                console.log("COMPARING IDS :", id, attendedEvent._id.toString());
                if (id === attendedEvent._id.toString()) {
                    // attendedGuest.user.attendedEvents.splice(attendedGuest.user.attendedEvents.indexOf(attendedEvent), 1);
                    attendedGuest.user.attendedEvents.pull(id);
                    console.log(`${attendedGuest.user.userName} ATTENDED EVENTS :`, attendedGuest.user.attendedEvents)
                    console.log(`Event ${id} removed from ${attendedGuest.user.userName} attended events.`)
                }
            }
    
            await attendedGuest.user.save();
        }
    
        for (let pendingGuest of event.pendingGuests) {
            for (let pendingEvent of pendingGuest.pendingEvents) {
                if (id === pendingEvent._id.toString()) {
                    // pendingGuest.user.pendingEvents.splice(pendingGuest.user.pendingEvents.indexOf(pendingEvent), 1);
                    pendingGuest.pendingEvents.pull(id);
                    console.log(`${pendingGuest.user.userName} PENDING EVENTS :`, pendingGuest.user.pendingEvents)
                    console.log(`Event ${id} removed from ${pendingGuest.user.userName} pending events.`)
                }
    
            }     
    
            await pendingGuest.save();
        }
    
        await event.deleteOne();
          
        console.log('EVENT DELETED :');
        console.log(event);

        } catch (e) {
            console.log("ERROR DELETING EVENT :", e);
        }    
}

// Middleware
const store = MongoStore.create({
    mongoUrl: dbUrl,
    touhAfter: 24 * 60 * 60,
    crypto: {
        secret: generateSessionSecret()
    }
})

app.use(
    session({
        name: "PartyPlanner",
        secret: generateSessionSecret(),
        resave: false,
        saveUninitialized: false,
        store: store,
        cookie : {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
      }
    })
  );

app.use(express.static('../frontend/public'));
app.set('views', [path.join(__dirname, '../frontend/views'), path.join(__dirname, 'views/includes')]);
app.set('view engine', 'ejs');
app.engine('ejs', ejsMate);
app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use(morgan('tiny'));
app.use(mongoSanitize());

const checkSession = (req, res, next) => {
    if(req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

const checkNoSession = (req, res, next) => {
    if(!req.session.userId) {
        next();
    } else {
        res.redirect('/events');
    }
}

const checkPendingGuest = async (req, res, next) => {
    const { id } = req.params;

    try {
        const event = await Event.findById(id)
        .populate('pendingGuests');

        for (let guest of event.pendingGuests) {
            if (guest._id.toString() === req.session.userId) {
                return next();
            }
        }
        res.redirect('/events');

    } catch (e) {
        res.redirect('/events');
    }
    
}

const checkAttendedGuest = async (req, res, next) => {

    const { id } = req.params;

    try {
        const event = await Event.findById(id)
        .populate({
            path: 'attendedGuests',
            select: 'user'
        });

        for (let guest of event.attendedGuests) {
            if (guest.user._id.toString() === req.session.userId) {
                return next();
            }
        }
        res.redirect('/events');

    } catch (e) {
        res.redirect('/events');
    }
}

const checkAdmin = async (req, res, next) => {

    const { id } = req.params;

    try {
        const event = await Event.findById(id)
        .populate("admin");

        if (event.admin._id.toString() === req.session.userId) {
            next();
        } else {
            res.redirect('/events');
        }       
    } catch (e) {
        res.redirect('/events');
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

app.get('/home', checkNoSession, async (req, res) => {
    const session = req.session;
    res.render('home', {session});
})

app.get('/login', checkNoSession, async (req, res) => {
    const session = req.session;
    const errorMessage = "";
    res.render('login', {session, errorMessage});
})

app.post('/login', checkNoSession, async (req, res) => {
    const {userName, password} = req.body;
    const user = await User.findOne({userName: userName});

    if (user) {
        const matchFound = await bcrypt.compare(password, user.password);

        if (matchFound) {
            req.session.userId = user._id;
            req.session.userName = user.userName;
            req.session.displayName = user.displayName;
            res.redirect('/events');
        } else {
            const errorMessage = "Incorrect username or password."
            res.render('login', {session, errorMessage});
        }
    } else {
        const errorMessage = "Incorrect username or password."
        res.render('login', {session, errorMessage});
    }

    
})

app.get('/register', checkNoSession, async (req, res) => {
    const session = req.session;
    const formData = {
        userName: "",
        errorMessages: []
    }
    res.render('register', {formData, session});
})

app.post('/register', checkNoSession, async (req, res) => {
    let {userName, password, confirmPassword} = req.body;

    // Cleaning inputs
    cleanUserName = clean(userName);
    cleanPassword = clean(password);

    // Username and password Regex
    const whitespaceRegex = /\s/;
    const passwordRegex = /^(?=\S*[\d])(?=\S*[!@#$%^&*()_+{}\[\]:;,.?~\\/-])\S*$/;

    const errorMessages = [];

    // Check if username is taken
    const takenUserName = await User.findOne({userName: cleanUserName});
    
    if (whitespaceRegex.test(userName)) {
        errorMessages.push("Username must not contain whitespaces.")
    }

    if(!passwordRegex.test(password)) {
        errorMessages.push("Password must contain at least one digit and one special character (excluding < or >)");
    }

    if (takenUserName) {
        errorMessages.push("This user name is already taken.")
    }

    if (password !== confirmPassword) {
        errorMessages.push("Passwords do not match.")
    }

    if(password.length > 30 || password.length < 8) {
        errorMessages.push("Password must be between 8 and 30 characters.")
    }

    if(userName.length > 15|| userName.length < 4) {
        errorMessages.push("Username must be between 4 and 15 characters.")
    }

    if(cleanUserName !== userName || cleanPassword !== password) {
        errorMessages.push("Username or password must not contain HTML tags.")
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

        // Hash the request password
        const hashedPassword = await passwordHash(cleanPassword, 10);

        const newUser = new User({
            displayName: userName.toLowerCase(),
            userName: userName,
            password: hashedPassword
        })

        try {
            await newUser.save();
            console.log("USER ADDED :");
            console.log(newUser);

            req.session.userId = newUser._id;
            req.session.userName = newUser.userName;
            req.session.displayName = newUser.displayName;
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
    delete req.session.displayName
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

    // Sanitize name input
    newEvent.name = clean(newEvent.name);

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

app.get('/events/:id', checkAttendedGuest, async (req, res) => {
    const session = req.session;
    const { id } = req.params;
    const event = await Event.findById(id).populate(['admin', 'attendedGuests.user', 'pendingGuests']);
    res.render('events/show', {event, session});
})

// WORK IN PROGRESS

app.patch('/events/:id/attend', checkPendingGuest, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    try {

        const event = await Event.findById(id).populate(['admin', 'attendedGuests', 'attendedGuests.user', 'pendingGuests']);
        const loggedUser = await User.findById(session.userId).populate((['attendedEvents', 'pendingEvents']));
        console.log("LOGGED IN USER :", loggedUser);

        // delete the user from event's pending guests and add it to attended guests
        for(let pendingGuest of event.pendingGuests) {
            if(pendingGuest._id.toString() === loggedUser._id.toString()) {
                event.pendingGuests.splice(event.pendingGuests.indexOf(pendingGuest), 1);
            }
        }
        
        // Create new attending guest and push it into the array
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

app.patch('/events/:id/decline', checkPendingGuest, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    try {

        const event = await Event.findById(id).populate(['admin', 'attendedGuests', 'pendingGuests']);
        const user = await User.findById(session.userId).populate((['attendedEvents', 'pendingEvents']));

        // delete the event from user's pending events
        user.pendingEvents.splice(user.pendingEvents.indexOf(event), 1);

        // delete the user from the event pending guests
        event.pendingGuests.splice(event.pendingGuests.indexOf(user), 1);

        // Save User & event
        await user.save();
        await event.save();


        // Redirect to event index
        res.redirect(`/events`);

    } catch (e) {
        console.log(e);
        res.redirect('/events');
    }
        
})

app.patch('/events/:id/leave', checkAttendedGuest, async (req, res) => {
    const session = req.session;
    const { id } = req.params;

    try {

        const event = await Event.findById(id)
        .populate({
            path: 'attendedGuests',
            select: 'user'
        })
        const user = await User.findById(session.userId).populate((['attendedEvents', 'pendingEvents']));

        // delete the event from user's attended events
        user.attendedEvents.splice(user.attendedEvents.indexOf(event), 1);

        // delete the user from the event attended guests
        for (let guest of event.attendedGuests) {

            if (guest.user._id.toString() === session.userId) {
                event.attendedGuests.splice(event.attendedGuests.indexOf(guest), 1);
            }
        }
        
        // Save User & event
        await user.save();
        await event.save();


        // Redirect to event index
        res.redirect(`/events`);

    } catch (e) {
        console.log(e);
        res.redirect('/events');
    }
        
})


app.get('/events/:id/items', checkAttendedGuest, async (req, res) => {
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

app.get('/events/:id/address', checkAdmin, async (req, res) => {
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

app.patch('/events/:id/invite', checkAdmin, async(req, res) => {
    const {id} = req.params;
    try {
        const event = await Event.findById(id);
        const guest = await User.findOne({userName: req.body.pendingGuest});

        console.log("GUEST :", guest);

        event.pendingGuests.push(guest);
        await event.save();

        guest.pendingEvents.push(event);
        await guest.save();
        
        console.log('EVENT UPDATED :');
        console.log(event);
        res.redirect(`/events/${event._id}`);
    } catch (e) {
        console.log(e);
        res.redirect(`/events`);
    }
    
})

app.patch('/events/:id/items', checkAttendedGuest, async(req, res) => {
    const {id} = req.params;

    try {
        const event = await Event.findById(id).populate('attendedGuests.user');
        const user = await User.findById(req.body.user);

        // Clean up empty array indexes
        for (let i = req.body.foods.length - 1; i >= 0; i--) {

            if (!req.body.foods[i]) {
                req.body.foods.splice(i, 1);
            } else {
                console.log("BROWSING FOOD :", req.body.foods[i]);
                req.body.foods[i] = clean(req.body.foods[i]);
            }
        }

        for (let i = req.body.drinks.length - 1; i >= 0; i--) {

            if (!req.body.drinks[i]) {
                req.body.drinks.splice(i, 1);
            } else {
                req.body.drinks[i] = clean(req.body.drinks[i]);
            }
        }

        for (let i = req.body.other.length - 1; i >= 0; i--) {

            if (!req.body.other[i]) {
                req.body.other.splice(i, 1);
            } else {
                req.body.other[i] = clean(req.body.other[i]);
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

app.patch('/events/:id/address', checkAdmin, async(req, res) => {
    const {id} = req.params;

    try {
        const event = await Event.findById(id)
        event.address = clean(req.body.address);
        event.accessDetails = clean(req.body.accessDetails);

        await event.save();
        console.log("EVENT UPDATED :", event);
        res.redirect(`/events/${event._id}`);
        
    } catch (e) {
        console.log(e);
        res.redirect(`/events`);
    }
    
})

app.delete('/events/:id', checkAdmin, async(req, res) => {
    const {id} = req.params;

    try {
        await deleteEvent(id);
        res.redirect("/events");
    } catch (e) {
        console.log(e)
        res.redirect("/events");
    }
    
})

app.get('/users', async (req, res) => {
    try {
      const query = req.query.q;
      const eventId = req.query.e;

      const users = await User.find({ userName: new RegExp(query, 'i') });
      console.log("USERS FOUND :", users);
      const event = await Event.findById(eventId)
      .populate('pendingGuests')
      .populate({
        path: 'attendedGuests',
        select: 'user'
      });

      console.log("USERS FOUND", users)

      console.log("ATTENDED GUESTS", event.attendedGuests);
      console.log("PENDING GUESTS :", event.pendingGuests);

      const filteredUsers = users.filter((user) => {

        let sameUserCount = 0;

        console.log("CHECKING IF THIS USER IS AN ATTENDED GUEST :", user);

            for (let attendedGuest of event.attendedGuests) {
                
                console.log("COMPARING IDs :", user._id, attendedGuest.user._id);
                if (user._id.toString() === attendedGuest.user._id.toString()) sameUserCount++;
    
            }

            console.log("CHECKING IF THIS USER IS A PENDING GUEST :", user);
    
            for (let pendingGuest of event.pendingGuests) {
                
                console.log("COMPARING IDs :", user._id, pendingGuest._id);
                if (user._id.toString() === pendingGuest._id.toString()) sameUserCount++;
    
            }

        return sameUserCount === 0;

      })

      res.json(filteredUsers);

      console.log("FILTERED USERS :", filteredUsers);
    } catch (err) {
      console.error(err);
      res.redirect("/home");
    }

  });


app.get('/users/edit', checkSession, async (req, res) => {

    const session = req.session;
    const formData = {
        userName: "",
        errorMessages: []
    }
    res.render('settings', {formData, session});

})


app.patch('/users', checkSession, async (req, res) => {
    try {
        const { displayName, password, confirmPassword, user } = req.body;
        const updatedUser = await User.findById(user);

        // Cleaning inputs
        cleanDisplayName = clean(displayName);
        cleanPassword = clean(password);

        console.log(`DISPLAY NAME : ${displayName} | CLEAN DISPLAY NAME : ${cleanDisplayName}`);
        console.log(`PASSWORD : ${password} | CLEAN PASSWORD : ${cleanPassword}`);

        // password Regex
        const passwordRegex = /^(?=\S*[\d])(?=\S*[!@#$%^&*()_+{}\[\]:;,.?~\\/-])\S*$/;

        const errorMessages = [];

        if (displayName) {

            if (displayName.length > 15 || displayName.length < 4) {
                errorMessages.push("Username must be between 4 and 15 characters.")
            }

        }

        if (password) {

            if (!passwordRegex.test(password)) {
                errorMessages.push("Password must contain at least one digit and one special character (excluding < or >)");
            }

            if (password !== confirmPassword) {
                errorMessages.push("Passwords do not match.")
            }

            if (password.length > 30 || password.length < 8) {
                errorMessages.push("Password must be between 8 and 30 characters.")
            }
        }

        if (cleanDisplayName !== displayName || cleanPassword !== password) {
            errorMessages.push("Username or password must not contain HTML tags.")
        }

        console.log(errorMessages);

        const formData = {
            displayName: displayName,
            errorMessages: errorMessages
        }

        if (errorMessages.length > 0) {
            const session = req.session;
            res.render('settings', { formData, session });
        } else {

            if (cleanDisplayName) {

                updatedUser.displayName = cleanDisplayName;

            }

            if (cleanPassword) {

                const hashedPassword = await passwordHash(cleanPassword, 10);
                updatedUser.password = hashedPassword;

            }

            await updatedUser.save();
            res.redirect("/events");
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/users', checkSession, async (req, res) => {

    const id = req.body.user;

    try {
        let user = await User.findById(id)
            .populate({
                path: 'attendedEvents',
                select: 'attendedGuests.user admin'
            })
            .populate({
                path: 'pendingEvents',
                select: 'pendingGuests'
            });


        // Remove any event created by the user
        for (let event of user.attendedEvents) {
            if (event.admin._id.toString() === user._id.toString()) {
                await deleteEvent(event._id.toString());
            }
        }

        // update user post deletion of admin events
        user = await User.findById(id)
            .populate({
                path: 'attendedEvents',
                select: 'attendedGuests.user admin'
            })
            .populate({
                path: 'pendingEvents',
                select: 'pendingGuests'
            });


        // Remove deleted user from its events
        for (let event of user.attendedEvents) {
            for (let guest of event.attendedGuests) {

                console.log("AGUEST ID :", guest.user._id.toString());
                console.log("USER ID :", user._id.toString());

                if (guest.user._id.toString() === user._id.toString()) {
                    event.attendedGuests.pull(guest.user._id.toString());
                }
            }
            await event.save();
        }

        for (let event of user.pendingEvents) {
            for (let guest of event.pendingGuests) {

                console.log("PGUEST ID :", guest._id.toString());
                console.log("USER ID :", user._id.toString());

                if (guest._id.toString() === user._id.toString()) {
                    event.pendingGuests.pull(guest._id.toString());
                }
            }
            await event.save();
        }

        // Delete user and clear session
        await user.deleteOne();
        console.log("USER DELETED :", user);
        delete req.session.userId;
        delete req.session.userName;
        delete req.session.displayName;

        res.redirect('/home');

    } catch (e) {
        console.log(e);
        res.redirect("/events");
    }

})

app.get('/', async (req, res) => {
    res.redirect('/home');
})


app.use((req, res) => {
    res.send('404 NOT FOUND!');
})


app.listen(3000, () => {
    console.log('App listening on port 3000.')
});

