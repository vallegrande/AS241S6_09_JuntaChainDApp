import { json, error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { randomBytes, createHash } from "node:crypto";
import {
  verifyMessage,
  isAddress,
  parseEther,
  createPublicClient,
  http,
  formatEther,
} from "viem";
import { getNetwork, networks, historyBases, zkSys } from "$lib/networks";
import {
  run,
  one,
  write,
  getGroup,
  saveGroup,
  listGroups,
  remoteDatabase,
  type Group,
} from "$lib/server/db";
import { env } from "$env/dynamic/private";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function validChain(id: number) {
  try {
    return getNetwork(id);
  } catch {
    error(400, "Red no compatible.");
  }
}
async function session(cookies: Parameters<RequestHandler>[0]["cookies"]) {
  const token = cookies.get("jc_session");
  if (!token) error(401, "Inicia sesión firmando con tu wallet.");
  const row = await one<{ address: string }>(
    "SELECT address FROM sessions WHERE token=? AND expires>?",
    [digest(token), Date.now()],
  );
  if (!row) error(401, "Tu sesión venció. Vuelve a conectar la wallet.");
  return row.address;
}
function publicGroup(g: Group) {
  return {
    id: g.id,
    name: g.name,
    chainId: g.chainId,
    amount: g.amount,
    capacity: g.capacity,
    frequency: g.frequency,
    count: g.members.length,
    owner: g.owner,
    round: g.round,
  };
}
const rpcFor = (id: number) =>
  id === 11155111
    ? env.SEPOLIA_RPC_URL
    : id === 560048
      ? env.HOODI_RPC_URL
      : env.ZKSYS_RPC_URL;
export const GET: RequestHandler = async ({ params, cookies, url, fetch }) => {
  const path = params.path;
  if (path === "health") {
    try {
      await run("SELECT 1");
      return json({
        status: "ok",
        storage: remoteDatabase ? "turso" : "sqlite",
        persistent: remoteDatabase || env.RENDER !== "true",
        networks: networks.map((n) => n.id),
      });
    } catch {
      return json(
        {
          status: "unavailable",
          message: "Configura la conexión de base de datos del servidor.",
        },
        { status: 503 },
      );
    }
  }
  if (path === "session") {
    try {
      const address = await session(cookies);
      const profile = await one<{ name: string }>(
        "SELECT name FROM profiles WHERE address=?",
        [address],
      );
      return json({
        address,
        name: profile?.name || "",
        groups: await listGroups(address),
      });
    } catch (e) {
      if (isHttpError(e) && e.status === 401)
        return json({ address: "", name: "", groups: [] });
      error(
        503,
        "No se pudo conectar con la base de datos. Revisa la configuración del servidor.",
      );
    }
  }
  if (path === "invitation") {
    const g = await getGroup(url.searchParams.get("id") || "");
    if (!g) error(404, "No encontramos esta junta.");
    return json(publicGroup(g));
  }
  if (path === "history") {
    const address = url.searchParams.get("address") || "";
    if (!isAddress(address)) error(400, "Dirección inválida.");
    const chain = validChain(Number(url.searchParams.get("chainId")));
    try {
      if (env.ETHERSCAN_API_KEY && chain.id !== zkSys.id) {
        try {
          const query = new URLSearchParams({
            chainid: String(chain.id),
            module: "account",
            action: "txlist",
            address,
            startblock: "0",
            endblock: "99999999",
            page: "1",
            offset: "30",
            sort: "desc",
            apikey: env.ETHERSCAN_API_KEY,
          });
          const response = await fetch(
            `https://api.etherscan.io/v2/api?${query}`,
            { signal: AbortSignal.timeout(15000) },
          );
          const data = await response.json();
          if (response.ok && Array.isArray(data.result))
            return json({
              items: data.result.map((t: any) => ({
                hash: t.hash,
                from: t.from,
                to: t.to || "",
                value: formatEther(BigInt(t.value)),
                timestamp: new Date(Number(t.timeStamp) * 1000).toISOString(),
                status: t.isError === "0" ? "Confirmada" : "Fallida",
              })),
              source: "Etherscan",
              limited: data.result.length === 30,
            });
        } catch {
          /* Fall back to the network's public indexer. */
        }
      }
      const response = await fetch(
        `${(chain.id === 11155111 ? env.SEPOLIA_HISTORY_URL : chain.id === 560048 ? env.HOODI_HISTORY_URL : env.ZKSYS_HISTORY_URL) || historyBases[chain.id]}/api/v2/addresses/${address}/transactions`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) throw new Error("Indexador no disponible");
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error("Respuesta inválida");
      return json({
        items: data.items.slice(0, 30).map((t: any) => ({
          hash: t.hash,
          from: t.from?.hash || "",
          to: t.to?.hash || "",
          value: formatEther(BigInt(t.value || "0")),
          timestamp: t.timestamp,
          status:
            t.status === "ok"
              ? "Confirmada"
              : t.status === "error"
                ? "Fallida"
                : "Pendiente",
        })),
        source: chain.id === zkSys.id ? "zkSYS Blockscout" : "Blockscout",
        limited: !!data.next_page_params || data.items.length > 30,
      });
    } catch {
      error(
        503,
        `El indexador de ${chain.name} no responde. Reintenta o consulta el explorador; no se mostrarán datos de otra red.`,
      );
    }
  }
  error(404, "Recurso no encontrado.");
};
export const POST: RequestHandler = async ({
  params,
  request,
  cookies,
  url,
}) => {
  if (request.headers.get("origin") !== url.origin)
    error(403, "Origen no permitido.");
  if (Number(request.headers.get("content-length") || 0) > 16384)
    error(413, "Solicitud demasiado grande.");
  let body: any;
  try {
    body = await request.json();
  } catch {
    error(400, "Solicitud inválida.");
  }
  if (!body || typeof body !== "object") error(400, "Solicitud inválida.");
  const path = params.path;
  if (path === "challenge") {
    if (typeof body.address !== "string" || !isAddress(body.address))
      error(400, "Dirección inválida.");
    const address = body.address.toLowerCase(),
      nonce = randomBytes(24).toString("hex");
    const message = `JuntaChain · Inicio de sesión\n\nDominio: ${url.host}\nWallet: ${address}\nCódigo único: ${nonce}\nEmitido: ${new Date().toISOString()}\n\nEsta firma inicia tu sesión. No autoriza pagos ni mueve fondos.`;
    await run("DELETE FROM challenges WHERE expires<?", [Date.now()]);
    await run("DELETE FROM sessions WHERE expires<?", [Date.now()]);
    await run("INSERT INTO challenges VALUES(?,?,?,?)", [
      nonce,
      address,
      message,
      Date.now() + 300000,
    ]);
    cookies.set("jc_nonce", nonce, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: url.protocol === "https:",
      maxAge: 300,
    });
    return json({ message });
  }
  if (path === "login") {
    const nonce = cookies.get("jc_nonce") || "";
    const row = await one<{ address: `0x${string}`; message: string }>(
      "SELECT * FROM challenges WHERE nonce=? AND expires>?",
      [nonce, Date.now()],
    );
    if (!row || typeof body.signature !== "string")
      error(401, "La solicitud de inicio de sesión venció.");
    let valid = false;
    try {
      valid = await verifyMessage({
        address: row.address,
        message: row.message,
        signature: body.signature,
      });
    } catch {}
    if (!valid) error(401, "Firma inválida.");
    const token = randomBytes(32).toString("hex");
    await write(async (tx) => {
      const deleted = await run(
        "DELETE FROM challenges WHERE nonce=?",
        [nonce],
        tx,
      );
      if (!deleted.rowsAffected) error(401, "Firma ya utilizada.");
      await run(
        "INSERT INTO sessions VALUES(?,?,?)",
        [digest(token), row.address, Date.now() + 86400000],
        tx,
      );
    });
    cookies.delete("jc_nonce", { path: "/" });
    cookies.set("jc_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: url.protocol === "https:",
      maxAge: 86400,
    });
    return json({ ok: true });
  }
  if (path === "logout") {
    const token = cookies.get("jc_session");
    if (token) await run("DELETE FROM sessions WHERE token=?", [digest(token)]);
    cookies.delete("jc_session", { path: "/" });
    return json({ ok: true });
  }
  const address = await session(cookies);
  if (path === "profile") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 50)
      error(400, "El nombre debe tener entre 2 y 50 caracteres.");
    await run("INSERT OR REPLACE INTO profiles VALUES(?,?)", [address, name]);
    return json({ ok: true });
  }
  if (path === "groups") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const capacity = Number(body.capacity),
      frequency = Number(body.frequency),
      chainId = Number(body.chainId);
    const chain = validChain(chainId);
    let wei = 0n;
    try {
      wei = parseEther(String(body.amount));
    } catch {
      error(400, "Cuota inválida.");
    }
    if (
      name.length < 3 ||
      name.length > 60 ||
      !Number.isInteger(capacity) ||
      capacity < 2 ||
      capacity > 20 ||
      ![7, 15, 30].includes(frequency) ||
      wei <= 0n ||
      wei > parseEther("1")
    )
      error(
        400,
        `Revisa nombre, cupos y cuota (hasta 1 ${chain.nativeCurrency.symbol}).`,
      );
    if (
      (await listGroups(address)).filter((g) => g.owner === address).length >=
      30
    )
      error(400, "Alcanzaste el máximo de juntas.");
    const g: Group = {
      id: randomBytes(12).toString("hex"),
      name,
      owner: address,
      chainId,
      amount: formatEther(wei),
      capacity,
      frequency,
      created: new Date().toISOString(),
      round: 0,
      roundStarted: "",
      members: [address],
      payments: [],
    };
    await saveGroup(g);
    return json(g, { status: 201 });
  }
  if (path === "join")
    return json(
      await write(async (tx) => {
        const g = await getGroup(String(body.id || ""), tx);
        if (!g) error(404, "Junta no encontrada.");
        if (g.members.includes(address)) return g;
        if (g.members.length >= g.capacity)
          error(409, "La junta ya está completa.");
        g.members.push(address);
        if (g.members.length === g.capacity)
          g.roundStarted = new Date().toISOString();
        await saveGroup(g, tx);
        return g;
      }),
    );
  const g = await getGroup(String(body.id || ""));
  if (!g) error(404, "Junta no encontrada.");
  if (!g.members.includes(address)) error(403, "No perteneces a esta junta.");
  if (path === "payment") {
    if (g.members.length < g.capacity || g.round >= g.capacity)
      error(409, "La junta no está recibiendo aportes.");
    const round = g.round,
      recipient = g.members[round];
    if (recipient === address)
      error(400, "En tu turno recibes los aportes de los demás miembros.");
    if (g.payments.some((p) => p.round === round && p.from === address))
      error(409, "Ya pagaste esta ronda.");
    if (typeof body.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.hash))
      error(400, "Hash inválido.");
    const chain = validChain(g.chainId);
    const client = createPublicClient({
      chain,
      transport: http(rpcFor(g.chainId) || undefined, {
        timeout: 15000,
        retryCount: 1,
      }),
    });
    let tx, receipt, block;
    try {
      if ((await client.getChainId()) !== g.chainId)
        throw new Error("El RPC no corresponde a la red de la junta.");
      tx = await client.getTransaction({ hash: body.hash });
      receipt = await client.getTransactionReceipt({ hash: body.hash });
      block = await client.getBlock({ blockNumber: receipt.blockNumber });
    } catch {
      error(
        422,
        "La transacción aún no se puede verificar. Espera su confirmación y vuelve a intentar.",
      );
    }
    if (
      receipt.status !== "success" ||
      tx.from.toLowerCase() !== address ||
      tx.to?.toLowerCase() !== recipient ||
      tx.value !== parseEther(g.amount) ||
      Number(block.timestamp) * 1000 < new Date(g.roundStarted).getTime()
    )
      error(
        422,
        "El pago no coincide con el aportante, beneficiario, monto o ronda actual.",
      );
    const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
    return json(
      await write(async (connection) => {
        const latest = await getGroup(g.id, connection);
        if (
          !latest ||
          latest.round !== round ||
          latest.payments.some((p) => p.round === round && p.from === address)
        )
          error(409, "La ronda cambió o el aporte ya fue registrado.");
        if (
          await one(
            "SELECT hash FROM payments WHERE hash=? OR hash=?",
            [
              body.hash.toLowerCase(),
              `${g.chainId}:${body.hash.toLowerCase()}`,
            ],
            connection,
          )
        )
          error(409, "Este comprobante ya está registrado.");
        try {
          await run(
            "INSERT INTO payments VALUES(?,?,?,?,?)",
            [
              `${g.chainId}:${body.hash.toLowerCase()}`,
              g.id,
              address,
              round,
              timestamp,
            ],
            connection,
          );
        } catch {
          error(409, "Este comprobante ya está registrado.");
        }
        latest.payments.push({
          hash: body.hash,
          from: address,
          to: recipient,
          round,
          value: g.amount,
          timestamp,
        });
        if (
          latest.payments.filter((p) => p.round === round).length ===
          latest.capacity - 1
        ) {
          latest.round++;
          latest.roundStarted = new Date().toISOString();
        }
        await saveGroup(latest, connection);
        return latest;
      }),
    );
  }
  error(404, "Recurso no encontrado.");
};
