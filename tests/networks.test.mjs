import test from "node:test";
import assert from "node:assert/strict";
import {
  networks,
  zkSys,
  getNetwork,
  symbolFor,
  switchOrAddNetwork,
  explorerFor,
} from "../src/lib/networks.ts";
test("Configuración incluye Sepolia, Hoodi y zkSYS sin mezclar monedas", () => {
  assert.deepEqual(
    networks.map((n) => n.id),
    [11155111, 560048, 57057],
  );
  assert.equal(symbolFor(57057), "SYS");
  assert.equal(symbolFor(11155111), "ETH");
  assert.equal(zkSys.rpcUrls.default.http[0], "https://rpc-zk.tanenbaum.io");
  assert.equal(explorerFor(57057), "https://explorer-zk.tanenbaum.io");
  assert.throws(() => getNetwork(1));
});
for (const network of networks) {
  test(`Cambia a ${network.name} cuando ya existe`, async () => {
    const methods = [];
    await switchOrAddNetwork(
      {
        request: async ({ method }) => {
          methods.push(method);
          return method === "eth_chainId"
            ? `0x${network.id.toString(16)}`
            : null;
        },
      },
      network.id,
    );
    assert.deepEqual(methods, ["wallet_switchEthereumChain", "eth_chainId"]);
  });
  test(`Añade y selecciona ${network.name} cuando falta`, async () => {
    let switches = 0;
    const calls = [];
    await switchOrAddNetwork(
      {
        request: async (call) => {
          calls.push(call);
          if (call.method === "wallet_switchEthereumChain" && switches++ === 0)
            throw { code: 4902 };
          return call.method === "eth_chainId"
            ? `0x${network.id.toString(16)}`
            : null;
        },
      },
      network.id,
    );
    assert.deepEqual(
      calls.map((c) => c.method),
      [
        "wallet_switchEthereumChain",
        "wallet_addEthereumChain",
        "wallet_switchEthereumChain",
        "eth_chainId",
      ],
    );
    const metadata = calls[1].params[0];
    assert.equal(metadata.nativeCurrency.symbol, network.nativeCurrency.symbol);
    assert.equal(metadata.rpcUrls[0], network.rpcUrls.default.http[0]);
    assert.equal(
      metadata.blockExplorerUrls[0],
      network.blockExplorers.default.url,
    );
  });
}
test("Cancelación no intenta añadir una red", async () => {
  const calls = [];
  await assert.rejects(
    switchOrAddNetwork(
      {
        request: async ({ method }) => {
          calls.push(method);
          throw { code: 4001 };
        },
      },
      57057,
    ),
  );
  assert.deepEqual(calls, ["wallet_switchEthereumChain"]);
});
test("No confirma el cambio si la wallet permanece en otra red", async () => {
  await assert.rejects(
    switchOrAddNetwork(
      {
        request: async ({ method }) =>
          method === "eth_chainId" ? "0x1" : null,
      },
      57057,
    ),
    /no cambió/,
  );
});
