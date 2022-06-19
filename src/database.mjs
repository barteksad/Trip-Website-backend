import { Sequelize, DataTypes } from "sequelize";

// ssh -L 11212:lkdb:5432 bs429589@students.mimuw.edu.pl

const database = new Sequelize("bd", "bs429589", "iks", {
    host: "localhost",
    port: "11212",
    dialect: "postgres",
});

const Trip = database.define("Trip", {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.STRING,
    },
    short_description: { type: DataTypes.STRING },
    image: {
        type: DataTypes.STRING,
    },
    price: {
        type: DataTypes.INTEGER,
    },
    begin_date: {
        type: DataTypes.DATE,
    },
    end_date: {
        type: DataTypes.DATE,
        validate: {
            isAfterBeginning(value) {
                if (this.begin_date > value) {
                    throw new Error(
                        "End date must be greater than beginning date!"
                    );
                }
            },
        },
    },
    available_places: {
        type: DataTypes.INTEGER,
        validate: {
            mustBePositive(value) {
                if (value < 0) {
                    throw new Error(
                        "Available places count can not be negative!"
                    );
                }
            },
        },
    },
});

const User = database.define("User", {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isUnique(value) {
                return User.findOne({ where: { email: value } }).then(
                    (email) => {
                        if (email) {
                            throw new Error(
                                "Account with this email already exists!"
                            );
                        }
                    }
                );
            },
        },
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const Reservation = database.define("Reservation", {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    number_of_seats: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

try {
    await database.authenticate();

    Trip.hasMany(Reservation);
    User.hasMany(Reservation);
    Reservation.belongsTo(Trip);
    Reservation.belongsTo(User);

    await User.sync({ force: true });
    await Trip.sync({ force: true });
    await Reservation.sync({ force: true });
} catch (err) {
    console.log(err);
}

try {
    const trip1 = await Trip.build({
        id: 0,
        name: "Szczyt wszystkiego",
        description: "krótka wycieczka z wejściem na ten właśnie szczyt",
        short_description: "krótka z wejściem na szczyt",
        image: "https://www.waszaturystyka.pl/wp-content/uploads/2019/05/eba98af1fb28de58d1acc5b799bd7a50.jpg",
        price: 100,
        begin_date: new Date("2022.06.20"),
        end_date: new Date("2022.06.22"),
        available_places: 10,
    });

    await trip1.save();

    const trip2 = await Trip.build({
        name: "Dalekie morze",
        description: "bardzo ciekawa wycieczka do dalekich mórz",
        short_description: "nad morze!",
        image: "https://i.nocimg.pl/d9/389/146-wakacje-nad-morzem-zobacz-gdzie.jpg",
        price: 19191,
        begin_date: new Date("2022.07.20"),
        end_date: new Date("2022.08.22"),
        available_places: 200,
    });

    await trip2.save();

    const trip3 = await Trip.build({
        name: "Magiczna kraina",
        description: "wyprawa do tej właśnie krainy",
        short_description: "spróbuj już dziś",
        image: "https://4rooms.com.pl/environment/cache/images/500_500_productGfx_1279cded36c5a39ffac5a8b86ffa654c.jpg",
        price: 2030,
        begin_date: new Date("2022.08.05"),
        end_date: new Date("2022.09.17"),
        available_places: 49,
    });

    await trip3.save();
} catch (err) {
    console.log(err);
}

export { database, Trip, Reservation, User };
