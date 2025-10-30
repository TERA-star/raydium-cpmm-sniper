import { PublicKey } from "@solana/web3.js";
import { parseTransaction } from "./utils/utils";
import { RAYDIUM_CPMM_PROGRAM_ID, solanaConnection } from "./constants";
import { connectDB, GEYSER_RPC, tickers, X_TOKEN } from "./config";
import { ClientDuplexStream } from "@grpc/grpc-js";
import Client, {
    CommitmentLevel,
    SubscribeRequest,
    SubscribeUpdate,
    SubscribeUpdateTransaction,
} from "@triton-one/yellowstone-grpc";
import base58 from "bs58";
import TokenListModel from "./model/tokenList";

let subscriptionId: number;

const parseLaunchLog = (log: string) => {
    const logBuffer = Buffer.from(log);
    let offset = 8; // discriminator

    const symbolLen = logBuffer[offset];

    offset += 4; // empty space

    const nameBuffer = logBuffer.slice(offset, offset + symbolLen);
    const name = nameBuffer.toString();

    offset += symbolLen;
    const nameLen = logBuffer[offset];

    offset += 4;
    const symbolBuffer = logBuffer.slice(offset, offset + nameLen);
    const symbol = symbolBuffer.toString();

    offset += nameLen;
    const uriLen = logBuffer[offset];

    offset += 4;
    const uriBuffer = logBuffer.slice(offset, offset + uriLen);
    const uri = uriBuffer.toString();

    offset += uriLen;

    const mintBuffer = new PublicKey(logBuffer.subarray(offset, offset + 32));
    const mint = mintBuffer.toBase58();

    return {
        name,
        symbol,
        uri,
        mint,
    };
};


function sendSubscribeRequest(
    stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>,
    request: SubscribeRequest
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        stream.write(request, (err: Error | null) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function createSubscribeRequest(): SubscribeRequest {
    return {
        accounts: {},
        slots: {},
        transactions: {
            launch: {
                accountInclude: [],
                accountExclude: [
                    // "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // pumpfun AMM
                ],
                accountRequired: [
                    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
                    // "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // pumpfun CA
                    // "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s", // Metaplex metadata
                    // "DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6"
                ],
            },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        commitment: CommitmentLevel.CONFIRMED,
        accountsDataSlice: [],
        ping: undefined,
    };
}

function handleStreamEvents(
    stream: ClientDuplexStream<SubscribeRequest, SubscribeUpdate>
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        stream.on("data", async (data) => {
            if (data.filters[0] === "launch") {
                handleLaunchData(data);
            }
        });

        stream.on("error", (error: Error) => {
            console.error("Stream error:", error);
            reject(error);
            stream.end();
        });

        stream.on("end", () => {
            console.log("Stream ended");
            resolve();
        });

        stream.on("close", () => {
            console.log("Stream closed");
            subscribeGeyser();
            resolve();
        });
    });
}

function isSubscribeUpdateTransaction(
    data: SubscribeUpdate
): data is SubscribeUpdate & { transaction: SubscribeUpdateTransaction } {
    return (
        "transaction" in data &&
        typeof data.transaction === "object" &&
        data.transaction !== null &&
        "slot" in data.transaction &&
        "transaction" in data.transaction
    );
}

async function handleLaunchData(data: SubscribeUpdate) {
    if (!isSubscribeUpdateTransaction(data)) {
        return;
    }
    const transaction = data.transaction?.transaction;
    // console.log("🚀 ~ handleLaunchData ~ transaction:", transaction)
    const slot = data.transaction.slot;
    const meta = data.transaction.transaction?.meta;
    const instructions = transaction?.transaction?.message?.instructions;
    if (!transaction || !slot || !instructions || !meta || !data.createdAt)
        return;

    const bufferIx = Buffer.from(transaction.signature);
    const signature = base58.encode(bufferIx);
    console.log("🚀 ~ handleLaunchData ~ signature:", signature)

    let flag = false,
        launchIndex = 0;
    for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        try {
            const hexDt = Buffer.from(instruction?.data).toString("hex");
            if (hexDt.includes("181ec828051c0777")) {
                flag = true;
                launchIndex = i;
            }
        } catch (error) { }
    }

    let tokenLaunchIxFlag = false,
        migrateIx: any[] = [];

    for (let i = 0; i < meta?.innerInstructions.length; i++) {
        const innerInstructions = meta?.innerInstructions[i].instructions;
        if (innerInstructions.length === 15) {
            tokenLaunchIxFlag = true;
            migrateIx = innerInstructions;
        }
    }

    if (flag && tokenLaunchIxFlag) {
        try {
            const accountKeys: any = transaction?.transaction?.message?.accountKeys;
            const creatorBuffer = Buffer.from(accountKeys[0]);
            const creator = new PublicKey(base58.encode(creatorBuffer));
            const ix: any =
                transaction?.transaction?.message?.instructions[launchIndex];
            const tokenInfo = {
                creator: creator.toBase58(),
                ...parseLaunchLog(ix.data),
            };
            if (
                !tokenInfo.creator ||
                !tokenInfo.name ||
                !tokenInfo.symbol ||
                !tokenInfo.uri ||
                !tokenInfo.mint
            )
                return;

            const lowercaseTickers = tickers.map((ticker) => ticker.toLowerCase());
            const findIndex = lowercaseTickers.findIndex(
                (ticker) => tokenInfo.symbol.toLowerCase().indexOf(ticker) !== -1
            );

            if (findIndex === -1) return;

            const tokenDocument = await TokenListModel.findOne(tokenInfo);

            if (!tokenDocument) {
                const tokenData = new TokenListModel(tokenInfo);
                await tokenData.save();
            }
        } catch (error) {
            console.log("error", error);
        }
    }
}

export async function subscribeGeyser() {
    // await connectDB();
    const client = new Client(GEYSER_RPC, X_TOKEN, undefined);
    const stream = await client.subscribe();
    const request = createSubscribeRequest();

    try {
        await sendSubscribeRequest(stream, request);
        console.log("Geyser connection established");
        await handleStreamEvents(stream);
    } catch (error) {
        console.log("Error in subscription process:", error);
        stream.end();
    }
}




const main = () => {
    console.log(`Starting cpmm sniper...`);
    console.log(`Program ID: ${RAYDIUM_CPMM_PROGRAM_ID}`);
    console.log("🚀 ~ RAYDIUM_CPMM_PROGRAM_ID:", RAYDIUM_CPMM_PROGRAM_ID)


    subscribeGeyser();

    // try {
    //     subscriptionId = solanaConnection.onLogs(
    //         new PublicKey(RAYDIUM_CPMM_PROGRAM_ID),
    //         (logs) => {
    //             console.log("🚀 ~ logs:", logs)
    //             const timestamp = new Date().toISOString();
    //             const hasExactInitializeForTargetProgram = () => {
    //                 const logsArray = logs.logs;

    //                 for (let i = 0; i < logsArray.length - 1; i++) {
    //                     const logLine = logsArray[i].trim();
    //                     const nextLogLine = logsArray[i + 1].trim();
    //                     if (
    //                         logLine.startsWith(`Program ${RAYDIUM_CPMM_PROGRAM_ID} invoke`) &&
    //                         nextLogLine.toLowerCase() == "program log: instruction: initialize"
    //                     ) {
    //                         return true;
    //                     }
    //                 }
    //                 return false;
    //             };
    //             if (hasExactInitializeForTargetProgram()) {
    //                 console.log(`\nTransaction ${logs.signature}`);
    //                 console.log(`Time: ${timestamp}`);
    //                 console.log(`Found Pool Create Event`);
    //                 parseTransaction(logs.signature);
    //             }
    //         },
    //         'confirmed'
    //     );
    //     console.log(`Subscribed with ID: ${subscriptionId}`);
    // } catch (err) {
    //     console.error(`Error in main:`, err);
    // }
};

main();