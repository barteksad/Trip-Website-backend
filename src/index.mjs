// eslint-disable-next-line no-unused-vars
const { database, Trips, Reservations, Users } = await import("./database.mjs");

import express from "express";
import cors from "cors";
import { Op, Transaction } from "sequelize";
import bodyParser from "body-parser";
import { body, validationResult } from "express-validator";
import session from "express-session";

const { createHmac } = await import("node:crypto");

const app = express();
const port = 3333;
const secret = "abcdefg";

app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
        credentials: true,
    })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set("trust proxy");
app.use(
    session({
        secret: "keyboard cat",
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false, maxAge: null, sameSite: "strict" },
    })
);

app.use(function (req, res, next) {
    res.set("Access-Control-Allow-Origin", "http://localhost:3000");
    res.set("Access-Control-Allow-Credentials", true);
    res.set(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});

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
    getTrips().then((trips) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(trips));
    });
});

app.post("/logout", (req, res) => {
    if(req.session.userId == null) {
        req.status = 404;
        return;
    }

    console.log("logout!");
    req.session.destroy();
});

app.post(
    "/login",
    body("email").isEmail(),
    body("password").isLength({ min: 1 }),
    async (req, res) => {
        if(req.session.userId != null) {
            req.status = 404;
            return;
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const email = req.body.email;
        const password = createHmac("sha256", secret)
            .update(req.body.password)
            .digest("hex");

        const user = await Users.findOne({ where: { email: email } });
        if (user == null) {
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({ userId: null, error: "Invalid password!" })
            );
            return;
        }
        const match = password == user.password;
        if (match) {
            req.session.userId = user.id;
            req.session.name = user.name;
            req.session.last_name = user.last_name;
            console.log(req.session);

            res.set("Content-Type", "application/json");
            res.end(JSON.stringify({ userId: user.id }));
        } else {
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({ userId: null, error: "Invalid password!" })
            );
        }
    }
);

app.post(
    "/signin",
    body("name").isLength({ min: 1 }),
    body("last_name").isLength({ min: 1 }),
    body("email").isEmail(),
    body("password").isLength({ min: 1 }),
    async (req, res) => {

        if(req.session.userId != null) {
            req.status = 404;
            return;
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const name = req.body.name;
        const last_name = req.body.last_name;
        const email = req.body.email;
        const password = createHmac("sha256", secret)
            .update(req.body.password)
            .digest("hex");

        try {
            const new_user = await Users.create({
                name: name,
                last_name: last_name,
                email: email,
                password: password,
            });

            await new_user.save();

            req.session.userId = new_user.id;
            req.session.name = name;
            req.session.last_name = last_name;
            req.session.email = email;
            console.log(req.session);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ userId: new_user.id }));
        } catch (e) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ userId: null, error: "Database error!" }));
        }
    }
);

app.post(
    "/reserve",
    body("count").isInt(),
    body("tripId").isInt(),
    async (req, res) => {

        if(req.session.userId == null) {
            res.status=404;
            return;
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        } 

        const count = req.body.count;
        const tripId = req.body.tripId;

        const name = req.session.name;
        const last_name = req.session.last_name;
        const email = req.session.email;

        try {
            await database.transaction(
                { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
                async (t) => {
                    await Trips.decrement(
                        { available_places: count },
                        { where: { id: tripId }, transaction: t }
                    );
                    const reservation = await Reservations.build(
                        {
                            name: name,
                            last_name: last_name,
                            email: email,
                            number_of_seats: count,
                        },
                        { transaction: t }
                    );
                    await reservation.save(t);
                }
            );
        } catch (err) {
            console.log(err);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Not enough available places!" }));
            return;
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: null }));
    }
);

app.get("/account", async (req, res) => {

    if (req.session.userId == null) {
        res.status = 404;
        return;
    }

    const userId = req.session.userId;

    try {
        const user = await Users.findOne({
            where: { id: userId },
        });
        const reservations = await user.getReservations();
        res.setHeader("Content-Type", "application/json");
        res.json({ reservations: reservations });
        console.log(reservations);
    } catch (err) {
        console.log(err);
    }
});

app.listen(port, () => {
    console.log(`app listens on port ${port}`);
});
