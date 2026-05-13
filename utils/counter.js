import { Counter } from "../models/Counter.js";

export const getNextSequence = async (key) => {
    const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return counter.seq;
};