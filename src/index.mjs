const { database, Trip, Reservation, User } = await import("./database.mjs");
const { createHmac } = await import("node:crypto");

import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import session from "express-session";
import { body, validationResult } from "express-validator";
import { Op, Transaction } from "sequelize";

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

app.set("trust proxy", 1);
app.use(
    session({
        secret: "keyboard cat",
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false, maxAge: null, sameSite: "strict" },
    })
);

const getTrip = async () => {
    let trip = await Trip.findAll({
        where: {
            begin_date: {
                [Op.gt]: new Date(),
            },
        },
        order: [["begin_date", "ASC"]],
    });
    return trip;
};

app.get("/trips", (req, res) => {
    getTrip().then((trip) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(trip));
    });
});

app.post("/logout", (req, res) => {
    if (req.session.userId == null) {
        res.status(404);
    } else {
        req.session.destroy();
        res.status(200);
    }
    res.send();
});

app.post(
    "/login",
    body("email").isEmail(),
    body("password").isLength({ min: 1 }),
    async (req, res) => {
        if (req.session.userId != null) {
            res.status(404).send("User already logged in!");
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

        const user = await User.findOne({ where: { email: email } });
        if (user == null) {
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({ loggedIn: false, error: "Invalid password!" })
            );
            return;
        }
        const match = password == user.password;
        if (match) {
            req.session.userId = user.id;
            req.session.name = user.name;
            req.session.last_name = user.last_name;
            req.session.email = user.email;
            console.log(req.session);

            res.set("Content-Type", "application/json");
            res.end(JSON.stringify({ loggedIn: true }));
        } else {
            res.setHeader("Content-Type", "application/json");
            res.end(
                JSON.stringify({ loggedIn: false, error: "Invalid password!" })
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
        if (req.session.userId != null) {
            res.status(404).send("User already signed in!");
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
            const new_user = await User.create({
                name: name,
                last_name: last_name,
                email: email,
                password: password,
            });

            await new_user.save();
            console.log(new_user);

            req.session.userId = new_user.id;
            req.session.name = name;
            req.session.last_name = last_name;
            req.session.email = email;
            console.log(req.session);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ userId: new_user.id }));
        } catch (e) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ userId: null, error: e.message }));
        }
    }
);

app.post(
    "/reserve",
    body("count").isInt(),
    body("tripId").isInt(),
    async (req, res) => {
        if (req.session.userId == null) {
            res.status(404).send("User not logged in!");
            return;
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const count = req.body.count;
        const tripId = req.body.tripId;

        const userId = req.session.userId;
        const name = req.session.name;
        const last_name = req.session.last_name;
        const email = req.session.email;

        try {
            await database.transaction(
                { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
                async (t) => {
                    const trip = await Trip.findByPk(tripId);
                    const user = await User.findByPk(userId);
                    if (trip.available_places - count < 0) {
                        t.rollback();
                        throw new Error("Not enought places!");
                    }
                    await trip.decrement(
                        { available_places: count },
                        { transaction: t }
                    );
                    const reservation = await Reservation.create(
                        {
                            name: name,
                            last_name: last_name,
                            email: email,
                            number_of_seats: count,
                        },
                        { transaction: t }
                    );
                    await user.addReservation(reservation, { transaction: t });
                    await trip.addReservation(reservation, { transaction: t });
                    await reservation.setTrip(trip, { transaction: t });
                    await reservation.setUser(user, { transaction: t });
                    await reservation.save(t);
                    await trip.save(t);
                    await user.save(t);
                }
            );
        } catch (err) {
            console.log(err);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.toString() }));
            return;
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: null }));
    }
);

app.get("/account", async (req, res) => {
    if (req.session.userId == null) {
        res.status(404).send("User not logged in!");
        return;
    }

    const userId = req.session.userId;

    try {
        const user = await User.findByPk(userId, { include: Reservation });
        const reservations = await user.getReservations({ nest: true });
        res.setHeader("Content-Type", "application/json");
        res.json({ reservations });
    } catch (err) {
        console.log(err);
    }
});

app.listen(port, () => {
    console.log(`app listens on port ${port}`);
});
