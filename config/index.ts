import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

export const tickers = ["Verse", "test", "a", "B"];

export const GEYSER_RPC = "http://quadratically-encounter-mkptthwaoy-dedicated-bypass.helius-rpc.com:2052";
export const X_TOKEN = "93cf25a6-7525-4eed-bf13-0dee1396bcb4";
export const RPC_URL = process.env.RPC_URL || "";

const MONGO_URL = process.env.DB_URL || "";

export const connectDB = async () => {
    const connect = async () => {
        try {
            if (MONGO_URL) {
                const connection = await mongoose.connect(MONGO_URL, {
                    serverSelectionTimeoutMS: 30000, // Increase the server selection timeout (default is 30000ms)
                    socketTimeoutMS: 45000,
                });
                console.log(`MONGODB CONNECTED : ${connection.connection.host}`);
            } else {
                console.log("No Mongo URL");
            }
        } catch (error) {
            console.log(`Error : ${(error as Error).message}`);
            // Attempt to reconnect
            setTimeout(connect, 1000); // Retry connection after 1 seconds
        }
    };

    connect();

    mongoose.connection.on("disconnected", () => {
        console.log("MONGODB DISCONNECTED");
        // Attempt to reconnect
        setTimeout(connect, 1000); // Retry connection after 5 seconds
    });

    mongoose.connection.on("reconnected", () => {
        console.log("MONGODB RECONNECTED");
    });
};
