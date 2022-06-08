const { Trips } = await import("./database.mjs");

import { Op } from "sequelize";

const getTrips = async () => {
    let trips = await Trips.findAll({
        where: {
            data_poczatku: {
                [Op.gt]: new Date(),
            },
        },
        order: [["data_poczatku", "ASC"]],
    });
    return trips;
};

export { getTrips };
