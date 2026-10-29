import { json, error } from "@sveltejs/kit";
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
import { sepolia, hoodi } from "viem/chains";
import {
  db,
  getGroup,
  saveGroup,
  listGroups,
  type Group,
} from "$lib/server/db";
import { env } from "$env/dynamic/private";
const networks = [sepolia, hoodi];
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function validChain(id: number) {
  const chain = networks.find((n) => n.id === id);
  if (!chain) error(400, "Red no compatible.");
  return chain;
}
function session(cookies: Parameters<RequestHandler>[0]["cookies"]) {
  const token = cookies.get("jc_session");
  if (!token) error(401, "Inicia sesión firmando con tu wallet.");
  const row = db
    .prepare("SELECT address FROM sessions WHERE token=? AND expires>?")
    .get(digest(token), Date.now()) as { address: string } | undefined;
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
export const GET: RequestHandler = async ({ params, cookies, url, fetch }) => {
  const path = params.path;
  if (path === "session") {
    try {
      const address = session(cookies);
      const profile = db
        .prepare("SELECT name FROM profiles WHERE address=?")
        .get(address) as { name: string } | undefined;
      return json({
        address,
        name: profile?.name || "",
        groups: listGroups(address),
      });
    } catch {
      return json({ address: "", name: "", groups: [] });
    }
  }
  if (path === "invitation") {
    const g = getGroup(url.searchParams.get("id") || "");
    if (!g) error(404, "No encontramos esta junta.");
    return json(publicGroup(g));
  }
  if (path === "history") {
    const address = url.searchParams.get("address") || "";
    if (!isAddress(address)) error(400, "Dirección inválida.");
    const chain = validChain(Number(url.searchParams.get("chainId")));
    try {
      if (env.ETHERSCAN_API_KEY) {
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
        if (!Array.isArray(data.result))
          throw new Error("Explorador no disponible");
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
          limited: false,
        });
      }
      const base =
        chain.id === sepolia.id
          ? "https://eth-sepolia.blockscout.com"
          : "https://eth-hoodi.blockscout.com";
      const response = await fetch(
        `${base}/api/v2/addresses/${address}/transactions`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (response.status === 404)
        return json({ items: [], source: "Blockscout", limited: false });
      if (!response.ok) throw new Error("Explorador no disponible");
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error("Respuesta inválida");
      return json({
        items: data.items
          .slice(0, 30)
          .map((t: any) => ({
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
        source: "Blockscout",
        limited: !!data.next_page_params,
      });
    } catch {
      error(
        503,
        "El indexador no responde en este momento. Puedes consultar el explorador o volver a intentar.",
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
  const path = params.path;
  if (path === "challenge") {
    if (typeof body.address !== "string" || !isAddress(body.address))
      error(400, "Dirección inválida.");
    const address = body.address.toLowerCase();
    const nonce = randomBytes(24).toString("hex");
    const message = `JuntaChain · Inicio de sesión\n\nDominio: ${url.host}\nWallet: ${address}\nCódigo único: ${nonce}\nEmitido: ${new Date().toISOString()}\n\nEsta firma inicia tu sesión. No autoriza pagos ni mueve fondos.`;
    db.prepare("DELETE FROM challenges WHERE expires<?").run(Date.now());
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO challenges VALUES(?,?,?,?)").run(
      nonce,
      address,
      message,
      Date.now() + 300000,
    );
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
    const row = db
      .prepare("SELECT * FROM challenges WHERE nonce=? AND expires>?")
      .get(nonce, Date.now()) as
      { address: `0x${string}`; message: string } | undefined;
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
    const deleted = db
      .prepare("DELETE FROM challenges WHERE nonce=?")
      .run(nonce);
    if (!deleted.changes) error(401, "Firma ya utilizada.");
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      row.address,
      Date.now() + 86400000,
    );
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
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    cookies.delete("jc_session", { path: "/" });
    return json({ ok: true });
  }
  const address = session(cookies);
  if (path === "profile") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 50)
      error(400, "El nombre debe tener entre 2 y 50 caracteres.");
    db.prepare("INSERT OR REPLACE INTO profiles VALUES(?,?)").run(
      address,
      name,
    );
    return json({ ok: true });
  }
  if (path === "groups") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const capacity = Number(body.capacity);
    const frequency = Number(body.frequency);
    const chainId = Number(body.chainId);
    validChain(chainId);
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
        "Revisa el nombre, la cuota (hasta 1 ETH), los cupos y la frecuencia.",
      );
    if (listGroups(address).filter((g) => g.owner === address).length >= 30)
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
    saveGroup(g);
    return json(g, { status: 201 });
  }
  const g = getGroup(String(body.id || ""));
  if (!g) error(404, "Junta no encontrada.");
  if (path === "join") {
    if (g.members.includes(address)) return json(g);
    if (g.members.length >= g.capacity)
      error(409, "La junta ya está completa.");
    g.members.push(address);
    if (g.members.length === g.capacity)
      g.roundStarted = new Date().toISOString();
    saveGroup(g);
    return json(g);
  }
  if (!g.members.includes(address)) error(403, "No perteneces a esta junta.");
  if (path === "payment") {
    if (g.members.length < g.capacity || g.round >= g.capacity)
      error(409, "La junta no está recibiendo aportes.");
    const round = g.round;
    const recipient = g.members[round];
    if (recipient === address)
      error(400, "En tu turno recibes los aportes de los demás miembros.");
    if (g.payments.some((p) => p.round === round && p.from === address))
      error(409, "Ya pagaste esta ronda.");
    if (typeof body.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.hash))
      error(400, "Hash inválido.");
    const chain = validChain(g.chainId);
    const rpc =
      g.chainId === sepolia.id ? env.SEPOLIA_RPC_URL : env.HOODI_RPC_URL;
    const client = createPublicClient({
      chain,
      transport: http(rpc || undefined, { timeout: 15000, retryCount: 1 }),
    });
    let tx, receipt, block;
    try {
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
    // Re-read after RPC calls: another request may have updated the round.
    const latest = getGroup(g.id)!;
    if (
      latest.round !== round ||
      latest.payments.some((p) => p.round === round && p.from === address)
    )
      error(409, "La ronda cambió o el aporte ya fue registrado.");
    const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT INTO payments VALUES(?,?,?,?,?)").run(
        body.hash.toLowerCase(),
        g.id,
        address,
        round,
        timestamp,
      );
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
      saveGroup(latest);
      db.exec("COMMIT");
    } catch {
      db.exec("ROLLBACK");
      error(409, "Este comprobante ya está registrado.");
    }
    return json(latest);
  }
  error(404, "Recurso no encontrado.");
};
