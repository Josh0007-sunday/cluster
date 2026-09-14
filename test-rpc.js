import { createSolanaRpc } from '@solana/kit';
const rpc = createSolanaRpc('http://localhost:5173/rpc/helius');
rpc.getAccountInfo('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', { encoding: 'base64' }).send().then(console.log).catch(console.error);
