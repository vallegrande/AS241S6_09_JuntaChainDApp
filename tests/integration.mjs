import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { parseEther } from "viem";
const fixtures = new Map();
const rpc = createServer(async (req,res)=>{
 let text='';for await(const chunk of req)text+=chunk;
 const input=JSON.parse(text);
 const run=(call)=>{
  const fixture=fixtures.get(call.params?.[0]);let result=null;
  if(call.method==='eth_getTransactionByHash')result=fixture?.tx||null;
  if(call.method==='eth_getTransactionReceipt')result=fixture?.receipt||null;
  if(call.method==='eth_getBlockByNumber')result={number:'0x1',hash:'0x'+'11'.repeat(32),parentHash:'0x'+'00'.repeat(32),timestamp:'0x'+Math.floor(Date.now()/1000+60).toString(16),transactions:[],gasLimit:'0x1c9c380',gasUsed:'0x5208',baseFeePerGas:'0x1',extraData:'0x',difficulty:'0x0',size:'0x1',uncles:[]};
  return {jsonrpc:'2.0',id:call.id,result};
 };res.setHeader('content-type','application/json');res.end(JSON.stringify(Array.isArray(input)?input.map(run):run(input)));
});
await new Promise(resolve=>rpc.listen(4182,'127.0.0.1',resolve));
function transaction(from,to,value,index,success=true){
 const hash='0x'+index.toString(16).padStart(64,'0');
 const tx={hash,from,to,value:'0x'+parseEther(value).toString(16),blockHash:'0x'+'11'.repeat(32),blockNumber:'0x1',transactionIndex:'0x0',gas:'0x5208',gasPrice:'0x1',input:'0x',nonce:'0x0',type:'0x0',chainId:'0xaa36a7',v:'0x1b',r:'0x'+'01'.repeat(32),s:'0x'+'02'.repeat(32)};
 fixtures.set(hash,{tx,receipt:{transactionHash:hash,from,to,blockHash:tx.blockHash,blockNumber:'0x1',transactionIndex:'0x0',gasUsed:'0x5208',cumulativeGasUsed:'0x5208',effectiveGasPrice:'0x1',status:success?'0x1':'0x0',type:'0x0',logs:[],logsBloom:'0x'+'00'.repeat(256),contractAddress:null}});return hash;
}
const base = "http://127.0.0.1:4181";
const directory = resolve("work");
mkdirSync(directory, { recursive: true });
const database = resolve(directory, `qa-${Date.now()}.sqlite`);
let server;
async function start() {
  server = spawn(process.execPath, ["build"], {
    env: {
      ...process.env,
      PORT: "4181",
      HOST: "127.0.0.1",
      ORIGIN: base,
      DATABASE_PATH: database,
      SEPOLIA_RPC_URL:'http://127.0.0.1:4182',
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stderr.on("data", (chunk) => (output += chunk));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Servidor no disponible: " + output)),
      20000,
    );
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("Servidor terminó: " + code + " " + output));
    });
  });
}
async function stop() {
  if (!server) return;
  await new Promise((resolve) => {
    server.once("exit", resolve);
    server.kill();
  });
  server = null;
}
function browser() {
  const jar = new Map();
  return async (path, body, origin = base) => {
    const response = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin,
        "content-type": "application/json",
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [entry] = cookie.split(";");
      const index = entry.indexOf("=");
      jar.set(entry.slice(0, index), entry.slice(index + 1));
    }
    return { status: response.status, data: await response.json() };
  };
}
let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  console.log("PASS " + label);
  passed++;
}
async function login(client, account) {
  const challenge = await client("challenge", { address: account.address });
  check("Desafío válido", challenge.status === 200);
  const signature = await account.signMessage({
    message: challenge.data.message,
  });
  const result = await client("login", { signature });
  check("Inicio firmado", result.status === 200);
  check(
    "Firma no reutilizable",
    (await client("login", { signature })).status === 401,
  );
}
try {
  await start();
  const a = privateKeyToAccount(generatePrivateKey()),
    b = privateKeyToAccount(generatePrivateKey()),
    c = privateKeyToAccount(generatePrivateKey());
  const alice = browser(),
    bob = browser(),
    charlie = browser(),
    visitor = browser();
  check(
    "Creación requiere sesión",
    (await visitor("groups", { name: "Sin sesión" })).status === 401,
  );
  check(
    "Origen ajeno rechazado",
    (await visitor("challenge", { address: a.address }, "https://otro.example"))
      .status === 403,
  );
  await login(alice, a);
  await login(bob, b);
  await login(charlie, c);
  check(
    "Perfil validado",
    (await alice("profile", { name: "A" })).status === 400,
  );
  check(
    "Perfil guardado",
    (await alice("profile", { name: "Participante QA" })).status === 200,
  );
  check(
    "Monto inválido rechazado",
    (
      await alice("groups", {
        name: "Junta QA",
        capacity: 2,
        frequency: 7,
        chainId: 11155111,
        amount: "-1",
      })
    ).status === 400,
  );
  const created = await alice("groups", {
    name: "Junta QA",
    capacity: 2,
    frequency: 7,
    chainId: 11155111,
    amount: "0.001",
  });
  check("Junta persistida", created.status === 201);
  const id = created.data.id;
  check(
    "Invitación pública válida",
    (await visitor(`invitation?id=${id}`)).data.count === 1,
  );
  check(
    "Miembro ajeno no puede registrar pagos",
    (await charlie("payment", { id, hash: "0x123" })).status === 403,
  );
  check(
    "Inscripción completa activa la ronda",
    (await bob("join", { id })).data.roundStarted.length > 0,
  );
  check(
    "Inscripción duplicada es idempotente",
    (await bob("join", { id })).data.members.length === 2,
  );
  check(
    "Cupos completos protegidos",
    (await charlie("join", { id })).status === 409,
  );
  check(
    "Beneficiario no se paga a sí mismo",
    (await alice("payment", { id, hash: "0x123" })).status === 400,
  );
  check(
    "Comprobante inválido rechazado",
    (await bob("payment", { id, hash: "0x123" })).status === 400,
  );
  check(
    "Sesión muestra solo sus juntas",
    (await charlie("session")).data.groups.length === 0,
  );
  const wrongAmount=transaction(b.address,a.address,'0.002',1);
  check('Monto diferente al pactado rechazado',(await bob('payment',{id,hash:wrongAmount})).status===422);
  const failedTx=transaction(b.address,a.address,'0.001',2,false);
  check('Transacción revertida rechazada',(await bob('payment',{id,hash:failedTx})).status===422);
  const wrongRecipient=transaction(b.address,c.address,'0.001',3);
  check('Beneficiario incorrecto rechazado',(await bob('payment',{id,hash:wrongRecipient})).status===422);
  const validTx=transaction(b.address,a.address,'0.001',4);
  const payment=await bob('payment',{id,hash:validTx});
  check('Aporte válido registrado y ronda avanza',payment.status===200&&payment.data.round===1&&payment.data.payments.length===1);
  const secondTx=transaction(a.address,b.address,'0.001',5);
  const final=await alice('payment',{id,hash:secondTx});
  check('Junta finaliza cuando todos cobran',final.status===200&&final.data.round===2&&final.data.payments.length===2);
  check('No acepta aportes tras finalizar',(await bob('payment',{id,hash:validTx})).status===409);
  await stop();
  await start();
  const restored = await alice("session");
  check(
    "Perfil y juntas sobreviven reinicio",
    restored.data.name === "Participante QA" &&
      restored.data.groups[0].id === id,
  );
  check(
    "Logout revoca sesión",
    (await alice("logout", {})).status === 200 &&
      (await alice("session")).data.address === "",
  );
  check(
    "Historial rechaza redes no permitidas",
    (await visitor(`history?address=${a.address}&chainId=1`)).status === 400,
  );
  console.log(
    `\n${passed} comprobaciones correctas. Base QA aislada; no se enviaron fondos.`,
  );
} finally {
  await stop();
  await new Promise(resolve=>rpc.close(resolve));
}
