// eslint-disable-next-line no-unused-vars
const { Trips, Reservations, Users } = await import("./database.mjs");

import express from "express";
import cors from "cors";
import { Op } from "sequelize";
import bodyParser from "body-parser";
import { body, validationResult } from "express-validator";
import session  from "express-session";

import pkg from 'bcrypt';
const {bcrypt} = pkg;
const {  genuuid } = pkg;

const app = express();
const port = 3333;
const saltRounds = 10;

app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('trust proxy', 1)
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true, maxAge: 60000 }
  }))
app.use(session({
// eslint-disable-next-line no-unused-vars
genid: function(_req) {
    return genuuid() // use UUIDs for session IDs
},
secret: 'keyboard cat'
}))


const getTrips = async () => {
let trips = await Trips.findAll({
    where: {
        begin_date: {
            [Op.gt]: new Date(),
        },
    },
    order: [["begin_date", "ASC"]],
});
return trips;
};

app.get("/trips", (req, res) => {
    console.log("/trips request!");
    getTrips().then((trips) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(trips));
    });
});

app.get('/logout',(req,res) => {
    req.session.destroy();
    res.status = 200;
});

app.post("/login",
    body("email").isEmail(),
    body("password").isLength({ min: 1 }),
    async (req, res) => {
        const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
        console.log("/login");
        const email = req.body.email;
        const password = await bcrypt.hash(req.body.password, saltRounds);

        const user = await Users.findOne({where : {email : email}});
        if(user == null) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({id : null}));
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if(match) {
            req.session.userid = user.id;
            req.session.name = user.name;
            req.session.last_name = user.last_name;
            console.log(req.session);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({id : user.id}));
        } else {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({id : null}));
        }
    }
)

app.post("/signin",
    body("name").isLength({ min: 1 }),
	body("last_name").isLength({ min: 1 }),
	body("email").isEmail(),
	body("password").isLength({ min: 1 }),
    async (req, res) => {
        const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}
        console.log("/signin");
		const name = req.body.name;
		const last_name = req.body.last_name;
		const email = req.body.email;
        const password = await bcrypt.hash(req.body.password, saltRounds);
        
        try {
            const new_user = await Users.create({
                name: name,
                last_name: last_name,
				email: email,
				password: password,
            })

            await new_user.save();

            console.log("user created");
            console.log(new_user);

            req.session.userid = new_user.id;
            req.session.name = name;
            req.session.last_name = last_name;
            console.log(req.session);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({id : new_user.id}));
        } catch(e) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({error : e}));
        }
})

app.listen(port, () => {
    console.log(`app listens on port ${port}`);
});
