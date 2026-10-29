import { defineChain } from "viem";
import { sepolia, hoodi } from "viem/chains";
export const zkSys = defineChain({
  id: 57057,
  name: "zkSYS Genesis Testnet",
  nativeCurrency: { name: "Test Syscoin", symbol: "SYS", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-zk.tanenbaum.io"] } },
  blockExplorers: {
    default: {
      name: "zkSYS Explorer",
      url: "https://explorer-zk.tanenbaum.io",
    },
  },
  testnet: true,
});
export const networks = [sepolia, hoodi, zkSys];
export const networkIds = networks.map((n) => String(n.id));
export const findNetwork = (id: number | string) =>
  networks.find((n) => n.id === Number(id));
export const getNetwork = (id: number | string) => {
  const n = findNetwork(id);
  if (!n)
    throw new Error("Red no compatible. Selecciona Sepolia, Hoodi o zkSYS.");
  return n;
};
export const symbolFor = (id: number | string) =>
  findNetwork(id)?.nativeCurrency.symbol || "—";
export const nameFor = (id: number | string) =>
  findNetwork(id)?.name || "Red no compatible";
export const explorerFor = (id: number | string) =>
  getNetwork(id).blockExplorers.default.url;
export const historyBases: Record<number, string> = {
  11155111: "https://eth-sepolia.blockscout.com",
  560048: "https://eth-hoodi.blockscout.com",
  57057: "https://explorer-zk.tanenbaum.io",
};
export interface WalletProvider {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
}
export async function switchOrAddNetwork(
  provider: WalletProvider,
  id: number | string,
) {
  const n = getNetwork(id);
  const chainId = `0x${n.id.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (e) {
    const err = e as {
      code?: number;
      data?: { originalError?: { code?: number } };
    };
    if (err.code !== 4902 && err.data?.originalError?.code !== 4902) throw e;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: n.name,
          nativeCurrency: n.nativeCurrency,
          rpcUrls: [...n.rpcUrls.default.http],
          blockExplorerUrls: [n.blockExplorers.default.url],
        },
      ],
    });
    // Some wallets add the network but do not select it.
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }
  const actual = await provider.request({ method: "eth_chainId" });
  if (Number.parseInt(actual, 16) !== n.id)
    throw new Error(
      "La wallet no cambió a la red solicitada. Selecciónala y vuelve a intentar.",
    );
  return n;
}
