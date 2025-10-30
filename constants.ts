import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { retrieveEnvVariable } from "./utils/utils";
import { raydiumCpSwap } from "./src/idl/raydiumcpmm";
import Raydiumcpmm from "./src/idl/raydiumcpmm.json";
import { Connection, Keypair } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import dotenv from 'dotenv';

dotenv.config();

export const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=e6eb0566-8ed5-4c78-aee0-bdbfc3fa91b8";
console.log("🚀 ~ RPC_ENDPOINT:", RPC_ENDPOINT)
export const RPC_WEBSOCKET_ENDPOINT = "wss://mainnet.helius-rpc.com/?api-key=e6eb0566-8ed5-4c78-aee0-bdbfc3fa91b8";
export const BUY_AMOUNT = 0.01;

export const DELAY = 1000;

export const MIN_LIQUIDITY_SOL = 1.0;

export const TP_LEVELS_PCT1 = process.env.TP_LEVELS_PCT1
export const TP_LEVELS_PCT2 = process.env.TP_LEVELS_PCT2
export const TP_LEVELS_PCT3 = process.env.TP_LEVELS_PCT3

export const TP_SIZE_PCT1 = process.env.TP_SIZE_PCT1
export const TP_SIZE_PCT2 = process.env.TP_SIZE_PCT2
export const TP_SIZE_PCT3 = process.env.TP_SIZE_PCT3
export const TRAIL_DISTANCE_PCT = 10;
export const HARD_STOP_LOSS_PCT = 20;
export const WSOL_AMOUNT = Number(process.env.WSOL_AMOUNT) || 0

export const MAX_SELL_TAX_PCT = 10;
export const MAX_DEV_WALLET_SUPPLY_PCT = 5;

export const REQUIRE_REVOKED_UPGRADE_AUTHORITY = true;

export const solanaConnection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
    commitment: 'confirmed'
});

export const provider = new AnchorProvider(solanaConnection, new NodeWallet(Keypair.generate()));

export const RaydiumCpmmProgram = new Program<raydiumCpSwap>(Raydiumcpmm as raydiumCpSwap, provider);

export const RAYDIUM_CPMM_PROGRAM_ID = "3f7GcQFG397GAaEnv51zR6tsTVihYRydnydDD1cXekxH"
export const PRIVATE_KEY = "2m1rMYNMX4WpSMmX5upxMG7iXC51WR46ahYop512VBEEu3FSwFPTwYQTEFAE7aaupUNRRVo935QxZu8Uee3CCMum"
export const buyerKp = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
console.log("🚀 ~ buyerKp:", buyerKp.publicKey)

export const Psol_Address = "pSoL47GE52V2bgUUyQvs9LSdWQZsokarp2yNsWQaLYy";

export const limitCount = 50

export const JITO_FEE = 0.0001;