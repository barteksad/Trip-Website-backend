import { Sequelize, DataTypes } from "sequelize";

// ssh -L 11212:lkdb:5432 bs429589@students.mimuw.edu.pl

const database = new Sequelize("bd", "bs429589", "iks", {
    host: "localhost",
    port: "11212",
    dialect: "postgres",
});

const Trip = database.define("Trip", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.STRING,
    },
    short_description: { type: DataTypes.STRING, },
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
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
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
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const Reservation = database.define("Reservation", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
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
    Trip.hasMany(Reservation, {
        foreignKey: "id",
    });
    User.hasMany(Reservation, {
        foreignKey: "id",
    }); 
    Reservation.belongsTo(Trip, {
        foreignKey: "id",
    });
    Reservation.belongsTo(User, {
        foreignKey: "id",
    });

    await database.authenticate();
    await Trip.sync({ force: true });
    await Reservation.sync({ force: true });
    await User.sync({ force: true });
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
} catch (err) {
    console.log(err);
}

export { database, Trip, Reservation, User };
