<script lang="ts">
  import { onMount } from "svelte";
  import Login from "$lib/Login.svelte";
  let checking = $state(true),
    authStep = $state(""),
    hasWallet = $state(false);
  import {
    Wallet,
    House,
    Users,
    UserRound,
    ArrowUpRight,
    ArrowDownLeft,
    QrCode,
    ShieldCheck,
    Sprout,
    ChevronRight,
    ArrowLeft,
    ExternalLink,
    Copy,
    LogOut,
    RefreshCw,
    Plus,
    Check,
    Clock,
    Download,
  } from "lucide-svelte";
  import {
    createWalletClient,
    custom,
    parseEther,
    formatEther,
    createPublicClient,
    http,
    isAddress,
  } from "viem";
  import {
    networks,
    networkIds,
    getNetwork,
    findNetwork,
    symbolFor,
    nameFor,
    explorerFor,
    switchOrAddNetwork,
  } from "$lib/networks";
  import QRCode from "qrcode";
  type Group = {
    id: string;
    name: string;
    owner: string;
    chainId: number;
    amount: string;
    capacity: number;
    frequency: number;
    created: string;
    round: number;
    roundStarted: string;
    members: string[];
    payments: {
      hash: string;
      from: string;
      to: string;
      round: number;
      value: string;
      timestamp: string;
    }[];
  };
  type Transaction = {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: string;
    status: string;
  };
  type Invitation = {
    id: string;
    name: string;
    chainId: number;
    amount: string;
    capacity: number;
    frequency: number;
    count: number;
    owner: string;
    round: number;
  };
  let tab = $state("Inicio"),
    address = $state(""),
    balance = $state("0"),
    network = $state("11155111"),
    busy = $state(false),
    notice = $state(""),
    success = $state(""),
    name = $state(""),
    profileName = $state(""),
    sessionAddress = $state("");
  let groups = $state<Group[]>([]),
    selected = $state(""),
    recipient = $state(""),
    amount = $state(""),
    hash = $state(""),
    status = $state(""),
    sentChain = $state(11155111 as number),
    paymentGroup = $state(""),
    pendingPayment = $state<{ id: string; hash: string } | null>(null);
  let transactions = $state<Transaction[]>([]),
    historyBusy = $state(false),
    historyError = $state(""),
    historySource = $state(""),
    historyLimited = $state(false),
    historyRequest = 0;
  let receiptHash = $state(""),
    modal = $state(""),
    title = $state(""),
    capacity = $state(4),
    frequency = $state(30),
    quota = $state("0.001"),
    inviteCode = $state(""),
    invitation = $state<Invitation | null>(null),
    qr = $state(""),
    shareLink = $state("");
  const chain = $derived(findNetwork(network) || networks[0]),
    supported = $derived(networkIds.includes(network));
  const authenticated = $derived(
    !!address && sessionAddress === address.toLowerCase(),
  );
  const group = $derived(groups.find((g) => g.id === selected));
  const completed = $derived(
    groups.filter((g) => g.round >= g.capacity).length,
  );
  const myPayments = $derived(
    groups.flatMap((g) =>
      g.payments.filter((p) => p.from === address.toLowerCase()),
    ),
  );
  const volume = $derived(
    groups
      .filter((g) => g.chainId === Number(network))
      .flatMap((g) =>
        g.payments.filter((p) => p.from === address.toLowerCase()),
      )
      .reduce((sum, p) => sum + Number(p.value), 0),
  );
  const displayName = $derived(name || "Mi cuenta");
  const cut = (value: string) =>
    value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Sin conectar";
  const money = (value: string | number) =>
    Number(value).toLocaleString("es-PE", { maximumFractionDigits: 6 });
  const chainName = nameFor;
  const explorer = explorerFor;
  const stateOf = (g: Group) =>
    g.round >= g.capacity
      ? "Finalizada"
      : g.members.length < g.capacity
        ? "Inscripciones abiertas"
        : "En curso";
  function showDialog(node: HTMLDialogElement) {
    node.showModal();
  }
  function provider() {
    return (window as unknown as { ethereum?: any }).ethereum;
  }
  async function api(path: string, body?: unknown) {
    const r = await fetch(
      `/api/${path}`,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await r.json();
    if (!r.ok)
      throw new Error(data.message || "No se pudo completar la operación.");
    return data;
  }
  function fail(e: unknown) {
    const err = e as { shortMessage?: string; message?: string; code?: number };
    notice =
      err.code === 4001
        ? "Cancelaste la solicitud en tu wallet. Puedes volver a intentarlo."
        : err.shortMessage ||
          err.message ||
          "Ocurrió un error. Vuelve a intentar.";
  }
  async function loadSession() {
    const s = await api("session");
    sessionAddress = s.address;
    name = s.name;
    profileName = s.name;
    groups = s.address === address.toLowerCase() ? s.groups : [];
  }
  async function loadHistory() {
    const request = ++historyRequest;
    transactions = [];
    historyError = "";
    historySource = "";
    historyLimited = false;
    if (!address || !supported) return;
    historyBusy = true;
    const account = address,
      chainId = network;
    try {
      const data = await api(`history?address=${account}&chainId=${chainId}`);
      if (request !== historyRequest) return;
      transactions = data.items;
      historySource = data.source;
      historyLimited = data.limited;
    } catch (e) {
      if (request === historyRequest) historyError = (e as Error).message;
    } finally {
      if (request === historyRequest) historyBusy = false;
    }
  }
  async function refresh() {
    const p = provider();
    if (!p) return;
    const accounts = await p.request({ method: "eth_accounts" });
    const next = accounts[0] || "";
    const nextNetwork = String(
      parseInt(await p.request({ method: "eth_chainId" }), 16),
    );
    const changed =
      next.toLowerCase() !== address.toLowerCase() || nextNetwork !== network;
    address = next;
    network = nextNetwork;
    balance = address
      ? formatEther(
          BigInt(
            await p.request({
              method: "eth_getBalance",
              params: [address, "latest"],
            }),
          ),
        )
      : "0";
    if (changed) {
      selected = "";
      paymentGroup = "";
      pendingPayment = null;
      recipient = "";
      amount = "";
      // Preserve the last receipt; its explorer is bound to sentChain.
    }
    await loadSession();
    if (changed || !historySource) void loadHistory();
  }
  async function connect() {
    if (busy) return;
    authStep = "Autoriza la conexión…";
    busy = true;
    notice = "";
    try {
      if (!provider())
        throw new Error(
          "Instala MetaMask o abre JuntaChain en el navegador de tu wallet.",
        );
      await provider().request({ method: "eth_requestAccounts" });
      await refresh();
      authStep = "Confirma la firma de acceso…";
      const challenge = await api("challenge", { address });
      const client = createWalletClient({ transport: custom(provider()) });
      const signature = await client.signMessage({
        account: address as `0x${string}`,
        message: challenge.message,
      });
      authStep = "Verificando tu acceso…";
      await api("login", { signature });
      await loadSession();
      success = "Tu wallet está conectada y tu sesión está verificada.";
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  async function disconnect() {
    try {
      await api("logout", {});
      sessionAddress = "";
      groups = [];
      name = "";
      selected = "";
      success = "";
      notice = "";
      modal = "";
      tab = "Inicio";
    } catch (e) {
      fail(e);
    }
  }
  async function switchNetwork(event: Event) {
    if (busy) return;
    busy = true;
    notice = "";
    const target = (event.target as HTMLSelectElement).value;
    try {
      if (!provider()) throw new Error("Conecta tu wallet primero.");
      await switchOrAddNetwork(provider(), target);
      await refresh();
      success = "Red conectada: " + nameFor(target);
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
      (event.target as HTMLSelectElement).value = network;
    }
  }
  async function createGroup() {
    busy = true;
    notice = "";
    try {
      if (!authenticated)
        throw new Error("Conecta y firma el inicio de sesión primero.");
      if (!supported)
        throw new Error("Selecciona Sepolia, Hoodi o zkSYS en Wallet.");
      const g = await api("groups", {
        name: title,
        amount: quota,
        capacity,
        frequency,
        chainId: Number(network),
      });
      await loadSession();
      selected = g.id;
      tab = "Mis juntas";
      modal = "";
      title = "";
      success =
        "Junta creada. Comparte la invitación para completar los cupos.";
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  async function lookup() {
    busy = true;
    notice = "";
    try {
      let id = inviteCode.trim();
      if (id.includes("://")) id = new URL(id).searchParams.get("join") || "";
      invitation = await api(`invitation?id=${encodeURIComponent(id)}`);
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  async function join() {
    busy = true;
    notice = "";
    try {
      if (!invitation) return;
      if (!authenticated)
        throw new Error("Conecta y verifica tu wallet antes de unirte.");
      const g = await api("join", { id: invitation.id });
      await loadSession();
      selected = g.id;
      tab = "Mis juntas";
      modal = "";
      invitation = null;
      success =
        "Ya eres parte de esta junta. Tu posición define tu turno de cobro.";
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  async function share(g: Group) {
    shareLink = `${location.origin}/?join=${g.id}`;
    qr = await QRCode.toDataURL(shareLink, {
      width: 280,
      margin: 2,
      color: { dark: "#006b4b", light: "#ffffff" },
    });
    modal = "share";
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      success = "Copiado al portapapeles.";
    } catch {
      notice = "No se pudo copiar. Selecciona y copia el enlace manualmente.";
    }
  }
  function preparePayment(g: Group) {
    if (String(g.chainId) !== network) {
      notice = `Cambia a ${chainName(g.chainId)} en Wallet antes de pagar esta junta.`;
      tab = "Wallet";
      return;
    }
    recipient = g.members[g.round];
    amount = g.amount;
    paymentGroup = g.id;
    tab = "Wallet";
    hash = "";
    status = "";
  }
  function review() {
    notice = "";
    try {
      if (!address) throw new Error("Conecta tu wallet primero.");
      if (!supported) throw new Error("Selecciona una red compatible.");
      if (!isAddress(recipient))
        throw new Error("La dirección de destino no es válida.");
      if (recipient.toLowerCase() === address.toLowerCase())
        throw new Error("El destinatario debe ser una dirección diferente.");
      const wei = parseEther(amount);
      if (wei <= 0n) throw new Error("Ingresa un monto mayor a cero.");
      if (wei >= parseEther(balance))
        throw new Error("El saldo debe cubrir el monto y la comisión de red.");
      modal = "confirm";
    } catch (e) {
      fail(e);
    }
  }
  async function registerPayment(id: string, txHash: string) {
    try {
      await api("payment", { id, hash: txHash });
      pendingPayment = null;
      paymentGroup = "";
      await loadSession();
      success = "Aporte confirmado y registrado en tu junta.";
    } catch (e) {
      pendingPayment = { id, hash: txHash };
      throw e;
    }
  }
  async function retryPayment() {
    if (!pendingPayment) return;
    busy = true;
    try {
      await registerPayment(pendingPayment.id, pendingPayment.hash);
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  async function send() {
    busy = true;
    notice = "";
    status = "";
    modal = "";
    hash = "";
    const account = address,
      sendNetwork = Number(network),
      target = recipient,
      value = amount,
      groupId = paymentGroup;
    sentChain = sendNetwork;
    try {
      if (!supported) throw new Error("Selecciona una red compatible.");
      const client = createWalletClient({
        chain,
        transport: custom(provider()),
      });
      status = "Confirma el envío en tu wallet.";
      const tx = await client.sendTransaction({
        account: account as `0x${string}`,
        to: target as `0x${string}`,
        value: parseEther(value),
      });
      hash = tx;
      if (groupId) pendingPayment = { id: groupId, hash: tx };
      status = "Transacción enviada. Esperando confirmación…";
      const receipt = await createPublicClient({
        chain: getNetwork(sendNetwork),
        transport: http(),
      }).waitForTransactionReceipt({ hash: tx, timeout: 180000 });
      if (receipt.status !== "success")
        throw new Error(
          "La transacción fue revertida. No se registró un aporte.",
        );
      status = "Transferencia confirmada en blockchain.";
      if (groupId) await registerPayment(groupId, tx);
      else success = "Transferencia confirmada.";
      await refresh();
      await loadHistory();
    } catch (e) {
      fail(e);
      if (hash)
        status =
          "Consulta el estado en el explorador antes de realizar otro envío.";
      else status = "";
    } finally {
      busy = false;
    }
  }
  async function saveProfile() {
    busy = true;
    try {
      await api("profile", { name: profileName });
      await loadSession();
      success = "Perfil actualizado.";
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  function exportHistory() {
    const rows = [
      ["Fecha", "Hash", "Origen", "Destino", symbolFor(network), "Estado"],
      ...transactions.map((t) => [
        t.timestamp,
        t.hash,
        t.from,
        t.to,
        t.value,
        t.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `juntachain-${network}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  onMount(() => {
    const joinId = new URL(location.href).searchParams.get("join");
    if (joinId) {
      inviteCode = joinId;
      modal = "join";
      lookup();
    }
    const p = provider();
    hasWallet = !!p;
    if (!p) {
      checking = false;
      return;
    }
    const update = () => refresh().catch(fail);
    refresh()
      .catch(fail)
      .finally(() => (checking = false));
    p.on("accountsChanged", update);
    p.on("chainChanged", update);
    return () => {
      p.removeListener("accountsChanged", update);
      p.removeListener("chainChanged", update);
    };
  });
</script>

<svelte:head
  ><title>JuntaChain · Ahorro que nos une</title><meta
    name="description"
    content="Organiza juntas de ahorro, comparte invitaciones y verifica tus aportes en blockchain."
  /></svelte:head
>
{#if !authenticated || checking}
  <Login
    onconnect={connect}
    {busy}
    {checking}
    step={authStep}
    error={notice}
    {address}
    {hasWallet}
    invited={!!inviteCode}
  />
{:else}
  <div class="app">
    <aside>
      <a class="brand" href="/"><Wallet size={28} />JuntaChain<span>®</span></a>
      <div class="aside-label">TU ESPACIO FINANCIERO</div>
      <nav>
        {#each [{ name: "Inicio", icon: House }, { name: "Mis juntas", icon: Users }, { name: "Wallet", icon: Wallet }, { name: "Perfil", icon: UserRound }] as item}<button
            class:active={tab === item.name}
            onclick={() => {
              tab = item.name;
              selected = "";
            }}
            ><item.icon size={21} /><span>{item.name}</span
            >{#if item.name === "Mis juntas"}<small>{groups.length}</small
              >{/if}</button
          >{/each}
      </nav>
      <div class="aside-bottom">
        <div class="secure">
          <ShieldCheck size={24} /><strong>Tu wallet, tu control.</strong>
          <p>Los aportes van directamente al beneficiario de cada ronda.</p>
          <span>VERIFICABLE EN BLOCKCHAIN ↗</span>
        </div>
        <div class="person">
          <div class="avatar"><UserRound size={18} /></div>
          <div>
            <strong>{displayName}</strong><small
              >{authenticated
                ? "Sesión verificada"
                : address
                  ? "Wallet conectada"
                  : "Conecta para comenzar"}</small
            >
          </div>
          {#if authenticated}<button
              class="icon-button"
              aria-label="Cerrar sesión"
              onclick={disconnect}><LogOut size={16} /></button
            >{/if}
        </div>
      </div>
    </aside>
    <div class="workspace">
      <header>
        <span>Tu comunidad. Tu futuro.</span>
        <div class="header-actions">
          <span class="testnet"
            ><i></i>{supported ? chain.name : "Red no compatible"} · Testnet</span
          ><button class="wallet-button" disabled={busy} onclick={connect}
            ><Wallet size={17} />{address
              ? cut(address)
              : "Conectar wallet"}{#if authenticated}<Check
                size={14}
              />{/if}</button
          >
        </div>
      </header>
      <main>
        {#if notice}<div class="notice" role="alert">
            <span>{notice}</span><button
              aria-label="Cerrar aviso"
              onclick={() => (notice = "")}>×</button
            >
          </div>{/if}{#if success}<div class="notice success" role="status">
            <span>{success}</span><button
              aria-label="Cerrar aviso"
              onclick={() => (success = "")}>×</button
            >
          </div>{/if}
        {#if tab === "Inicio"}
          <div class="page-heading">
            <div>
              <div class="eyebrow">AHORRAR SE SIENTE MEJOR EN COMUNIDAD</div>
              <h1>
                {name
                  ? `Hola, ${name.split(" ")[0]}`
                  : "Tu próxima meta empieza aquí"}<span>.</span>
              </h1>
              <p>
                {authenticated
                  ? `Tienes ${groups.filter((g) => g.round < g.capacity).length} juntas en camino. Cada aporte cuenta.`
                  : "Conecta tu wallet y organiza tu ahorro con las personas de tu confianza."}
              </p>
            </div>
            <span class="date">AHORRO / COMUNIDAD</span>
          </div>
          <div class="hero">
            <div>
              <span class="hero-label">JUNTOS LLEGAMOS MÁS LEJOS</span>
              <h2>Grandes metas.<br />Pequeños aportes.</h2>
              <p>
                Un turno para cada persona.<br />Un registro transparente para
                todos.
              </p>
              <button onclick={() => (modal = "create")}
                >Crear mi junta <Plus size={18} /></button
              ><button
                class="hero-secondary"
                onclick={() => {
                  modal = "join";
                  invitation = null;
                }}>Tengo una invitación <ArrowUpRight size={17} /></button
              >
            </div>
            <div class="hero-art">
              <div class="ring r1"></div>
              <div class="ring r2"></div>
              <div class="qr">
                <Users size={65} /><span>LA CONFIANZA NOS UNE</span>
              </div>
              <div class="float-tag">
                <ShieldCheck size={17} /> Aportes verificables
              </div>
            </div>
          </div>
          <div class="dashboard-grid">
            <section>
              <div class="section-heading">
                <h2>
                  Mis juntas <span
                    >{groups.length.toString().padStart(2, "0")}</span
                  >
                </h2>
                <button class="text-button" onclick={() => (tab = "Mis juntas")}
                  >Ver todas <ArrowUpRight size={17} /></button
                >
              </div>
              {#if groups.length}{#each groups.slice(0, 2) as g}<button
                    class="group-card"
                    onclick={() => {
                      selected = g.id;
                      tab = "Mis juntas";
                    }}
                    ><div class="group-top">
                      <div class="group-icon"><Users size={26} /></div>
                      <span class="pill">{stateOf(g)}</span>
                    </div>
                    <h3>{g.name}</h3>
                    <p>
                      {g.members.length} de {g.capacity} miembros · {chainName(
                        g.chainId,
                      )}
                    </p>
                    <div class="pool">
                      <div>
                        <small>APORTE POR RONDA</small><strong
                          >{money(g.amount)}
                          <span>{symbolFor(g.chainId)}</span></strong
                        >
                      </div>
                      <span class="round"
                        >{g.round >= g.capacity
                          ? "Completada"
                          : `Ronda ${g.round + 1} / ${g.capacity}`}</span
                      >
                    </div>
                    <div class="progress">
                      <span style={`width:${(g.round / g.capacity) * 100}%`}
                      ></span>
                    </div>
                    <div class="payment">
                      <small>Cada {g.frequency} días</small><span
                        >Ver junta <ChevronRight size={18} /></span
                      >
                    </div></button
                  >{/each}{:else}<div class="empty-state">
                  <Users size={35} />
                  <h3>Tu comunidad empieza contigo</h3>
                  <p>
                    Crea tu primera junta o acepta una invitación. Aquí podrás
                    seguir los cupos, aportes y turnos.
                  </p>
                  <button class="primary" onclick={() => (modal = "create")}
                    >Crear una junta <Plus size={16} /></button
                  >
                </div>{/if}
            </section>
            <section>
              <div class="section-heading">
                <h2>Tu panorama</h2>
                <span class="muted">Tu actividad registrada</span>
              </div>
              <div class="score-card">
                <div>
                  <ShieldCheck size={25} /><span>CONSTANCIA COMPARTIDA</span>
                </div>
                <strong>{myPayments.length}<span> aportes</span></strong>
                <p>Pagos confirmados y asociados a tus juntas.</p>
                <span class="pill">{completed} juntas completadas</span>
              </div>
              <div class="savings">
                <div>
                  <span>TOTAL APORTADO</span><strong
                    >{money(volume)} {symbolFor(network)}</strong
                  ><small>Aportes verificados en {chain.name}.</small>
                </div>
                <Sprout size={43} />
              </div>
            </section>
          </div>
          <section class="movements">
            <div class="section-heading">
              <h2>Movimientos recientes</h2>
              <button class="text-button" onclick={() => (tab = "Wallet")}
                >Ver historial <ArrowUpRight size={17} /></button
              >
            </div>
            {#if historyBusy}<div class="empty-state compact">
                Consultando blockchain…
              </div>{:else if transactions.length}{#each transactions.slice(0, 3) as t}<a
                  class="movement transaction"
                  href={`${explorer(Number(network))}/tx/${t.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  ><div
                    class="movement-icon"
                    class:incoming={t.to.toLowerCase() ===
                      address.toLowerCase()}
                  >
                    {#if t.to.toLowerCase() === address.toLowerCase()}<ArrowDownLeft
                        size={22}
                      />{:else}<ArrowUpRight size={22} />{/if}
                  </div>
                  <div>
                    <strong
                      >{t.to.toLowerCase() === address.toLowerCase()
                        ? "Transferencia recibida"
                        : "Transferencia enviada"}</strong
                    ><small
                      >{new Date(t.timestamp).toLocaleString("es-PE")} · {t.status}</small
                    >
                  </div>
                  <strong>{money(t.value)} {symbolFor(network)}</strong
                  ><ExternalLink size={14} /></a
                >{/each}{:else}<div class="empty-state compact">
                <Clock size={25} />
                <p>
                  {historyError ||
                    "Tus movimientos aparecerán aquí al conectar una wallet con actividad."}
                </p>
              </div>{/if}
          </section>
        {:else if tab === "Mis juntas"}
          {#if group}
            <button class="text-button" onclick={() => (selected = "")}
              ><ArrowLeft size={16} />Todas mis juntas</button
            >
            <div class="page-heading">
              <div>
                <div class="eyebrow">
                  TU AHORRO COMPARTIDO · {chainName(group.chainId)}
                </div>
                <h1>{group.name}<span>.</span></h1>
                <p>
                  {stateOf(group)} · Cuota cada {group.frequency} días · Orden de
                  cobro por inscripción
                </p>
              </div>
              <button class="primary" onclick={() => share(group)}
                ><QrCode size={18} />Invitar</button
              >
            </div>
            <div class="three-cols">
              <div class="white-card">
                <small>APORTE POR MIEMBRO Y RONDA</small>
                <h2>{money(group.amount)} {symbolFor(group.chainId)}</h2>
              </div>
              <div class="white-card">
                <small>RECEPCIÓN POR TURNO</small>
                <h2>
                  {money(Number(group.amount) * (group.capacity - 1))}
                  {symbolFor(group.chainId)}
                </h2>
                <small>El beneficiario no se transfiere a sí mismo.</small>
              </div>
              <div class="white-card">
                <small>MIEMBROS INSCRITOS</small>
                <h2>{group.members.length} / {group.capacity}</h2>
              </div>
            </div>
            <div class="white-card">
              <div class="section-heading">
                <h2>Progreso de la junta</h2>
                <span class="pill"
                  >{group.round} de {group.capacity} rondas</span
                >
              </div>
              <div class="progress">
                <span style={`width:${(group.round / group.capacity) * 100}%`}
                ></span>
              </div>
              {#if group.members.length < group.capacity}<p class="spaced">
                  Faltan {group.capacity - group.members.length} personas. Los aportes
                  se habilitan al completar los cupos.
                </p>{:else if group.round >= group.capacity}<p class="spaced">
                  Todos los miembros recibieron sus aportes. La junta ha
                  finalizado.
                </p>{:else}<div class="beneficiary">
                  <div>
                    <small>BENEFICIARIO ACTUAL · RONDA {group.round + 1}</small>
                    <h3>
                      {group.members[group.round] === address.toLowerCase()
                        ? "Es tu turno de recibir"
                        : cut(group.members[group.round])}
                    </h3>
                    <p>
                      {group.payments.filter((p) => p.round === group.round)
                        .length} de {group.capacity - 1} aportes recibidos · Vence
                      {new Date(
                        new Date(group.roundStarted).getTime() +
                          group.frequency * 86400000,
                      ).toLocaleDateString("es-PE")}
                    </p>
                  </div>
                  {#if group.members[group.round] !== address.toLowerCase()}{#if group.payments.some((p) => p.round === group.round && p.from === address.toLowerCase())}<span
                        class="pill"
                        ><Check size={13} />Tu aporte está registrado</span
                      >{:else}<button
                        class="primary"
                        disabled={busy}
                        onclick={() => preparePayment(group)}
                        >Aportar {money(group.amount)}
                        {symbolFor(group.chainId)}
                        <ArrowUpRight size={17} /></button
                      >{/if}{/if}
                </div>{/if}
            </div>
            <h2>Participantes y turnos</h2>
            {#each group.members as member, i}<div class="movement">
                <div class="avatar">{i + 1}</div>
                <div>
                  <strong
                    >{member === address.toLowerCase()
                      ? "Tú"
                      : cut(member)}</strong
                  ><small class="address-line">{member}</small>
                </div>
                <span class="pill"
                  >{i < group.round
                    ? "Cobro completado"
                    : i === group.round &&
                        group.members.length === group.capacity
                      ? "Turno actual"
                      : `Turno ${i + 1}`}</span
                >
              </div>{/each}
            <h2 class="spaced">Comprobantes de aportes</h2>
            {#if group.members.length === group.capacity && group.round < group.capacity && group.members[group.round] !== address.toLowerCase() && !group.payments.some((p) => p.round === group.round && p.from === address.toLowerCase())}<form
                class="white-card"
                onsubmit={async (e) => {
                  e.preventDefault();
                  busy = true;
                  try {
                    await registerPayment(group.id, receiptHash);
                    receiptHash = "";
                  } catch (err) {
                    fail(err);
                  } finally {
                    busy = false;
                  }
                }}
              >
                <h3>Registrar una transferencia ya realizada</h3>
                <p>
                  Si enviaste tu cuota y cerraste la página, pega el hash.
                  Verificaremos destinatario, monto, cuenta y ronda sin volver a
                  enviar fondos.
                </p>
                <label for="receipt">Hash de la transacción</label><input
                  id="receipt"
                  bind:value={receiptHash}
                  placeholder="0x…"
                  required
                  pattern="0x[0-9a-fA-F]{64}"
                /><button class="primary spaced" disabled={busy}
                  >Verificar y registrar</button
                >
              </form>{/if}{#if !group.payments.length}<div
                class="empty-state compact"
              >
                <p>
                  Los aportes confirmados aparecerán aquí con su comprobante en
                  blockchain.
                </p>
              </div>{/if}{#each group.payments.toReversed() as p}<a
                class="movement transaction"
                href={`${explorer(group.chainId)}/tx/${p.hash}`}
                target="_blank"
                rel="noreferrer"
                ><ShieldCheck size={22} />
                <div>
                  <strong>Ronda {p.round + 1} · {cut(p.from)}</strong><small
                    >{new Date(p.timestamp).toLocaleString("es-PE")}</small
                  >
                </div>
                <strong>{money(p.value)} {symbolFor(group.chainId)}</strong
                ><ExternalLink size={16} /></a
              >{/each}
            <div class="info">
              <ShieldCheck size={22} />Cada miembro envía su cuota directamente
              al beneficiario. La ronda avanza cuando se verifican todos los
              aportes. El cumplimiento depende de los participantes; no existe
              custodia ni distribución automática de fondos.
            </div>
          {:else}<div class="page-heading">
              <div>
                <div class="eyebrow">TU AHORRO COMPARTIDO</div>
                <h1>Mis juntas<span>.</span></h1>
                <p>
                  Organiza tus metas, comparte la invitación y sigue cada
                  aporte.
                </p>
              </div>
              <button class="primary" onclick={() => (modal = "create")}
                >Crear junta <Plus size={17} /></button
              >
            </div>
            <div class="two-cols">
              {#each groups as g}<button
                  class="group-card"
                  onclick={() => (selected = g.id)}
                  ><div class="group-top">
                    <Users size={26} /><span class="pill">{stateOf(g)}</span>
                  </div>
                  <h3>{g.name}</h3>
                  <p>
                    {g.members.length}/{g.capacity} participantes · {chainName(
                      g.chainId,
                    )}
                  </p>
                  <div class="pool">
                    <strong
                      >{money(g.amount)}
                      <span>{symbolFor(g.chainId)}</span></strong
                    ><ChevronRight />
                  </div>
                  <div class="progress">
                    <span style={`width:${(g.round / g.capacity) * 100}%`}
                    ></span>
                  </div></button
                >{/each}
            </div>
            {#if !groups.length}<div class="empty-state">
                <Users size={42} />
                <h2>Una meta compartida empieza aquí</h2>
                <p>
                  Crea una junta o ingresa el enlace que te compartió tu
                  comunidad.
                </p>
                <button
                  class="primary"
                  onclick={() => {
                    modal = "join";
                    invitation = null;
                  }}>Unirme con invitación</button
                >
              </div>{/if}{/if}
        {:else if tab === "Wallet"}
          <div class="page-heading">
            <div>
              <div class="eyebrow">TU PUERTA A WEB3</div>
              <h1>Mi wallet<span>.</span></h1>
              <p>Saldo y operaciones consultados en la red conectada.</p>
            </div>
            <button
              class="text-button"
              disabled={busy}
              onclick={() => refresh().catch(fail)}
              ><RefreshCw size={16} />Actualizar</button
            >
          </div>
          <div class="two-cols wallet-grid">
            <div>
              <div class="balance-card">
                <Wallet size={28} /><span
                  >SALDO DISPONIBLE · {supported
                    ? chain.name
                    : "RED NO COMPATIBLE"}</span
                ><strong>{money(balance)} {symbolFor(network)}</strong><small
                  >{address ||
                    "Conecta tu wallet para consultar tu saldo."}</small
                ><button onclick={() => (address ? copy(address) : connect())}
                  >{address
                    ? "Copiar mi dirección"
                    : "Conectar MetaMask"}{#if address}<Copy
                      size={17}
                    />{:else}<ArrowUpRight size={17} />{/if}</button
                >
              </div>
              <div class="white-card">
                <label for="network">Red conectada</label><select
                  id="network"
                  value={network}
                  onchange={switchNetwork}
                  disabled={busy}
                  >{#each networks as option}<option value={String(option.id)}
                      >{option.name} · {option.nativeCurrency.symbol}</option
                    >{/each}{#if !supported}<option value={network}
                      >Red no compatible ({network})</option
                    >{/if}</select
                ><small
                  >Entorno académico en testnet. Las transacciones son reales en
                  la red seleccionada; los tokens de prueba no representan soles
                  ni USDC.</small
                >
              </div>
            </div>
            <form
              class="white-card"
              onsubmit={(e) => {
                e.preventDefault();
                review();
              }}
            >
              <h2>{paymentGroup ? "Aportar a mi junta" : "Enviar fondos"}</h2>
              <p>
                {paymentGroup
                  ? "Beneficiario y cuota definidos por tu junta."
                  : "Una transferencia directa de tu wallet a otra dirección."}
              </p>
              <label for="recipient">Dirección del destinatario</label><input
                id="recipient"
                bind:value={recipient}
                readonly={!!paymentGroup}
                required
                placeholder="0x…"
                autocomplete="off"
              /><label for="amount">Monto en {symbolFor(network)}</label><input
                id="amount"
                bind:value={amount}
                readonly={!!paymentGroup}
                required
                placeholder="0.001"
                inputmode="decimal"
              />
              <div class="info">
                <ShieldCheck size={21} />La comisión se muestra en tu wallet
                antes de autorizar el envío.
              </div>
              <button
                class="primary full"
                disabled={busy || !address || !supported}
                >{busy ? "Procesando…" : "Continuar"}<ArrowUpRight
                  size={17}
                /></button
              >{#if paymentGroup}<button
                  class="text-button spaced"
                  type="button"
                  disabled={busy}
                  onclick={() => {
                    paymentGroup = "";
                    recipient = "";
                    amount = "";
                  }}>Cancelar aporte</button
                >{/if}{#if status}<p class="spaced" role="status">
                  {status}
                </p>{/if}{#if hash}<a
                  class="transaction-link"
                  href={`${explorer(sentChain)}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  >Ver comprobante en blockchain <ExternalLink size={17} /></a
                >{/if}{#if pendingPayment}<button
                  type="button"
                  class="primary full"
                  disabled={busy}
                  onclick={retryPayment}>Reintentar registro del aporte</button
                ><small
                  >Esta acción verifica el comprobante; no vuelve a enviar
                  fondos.</small
                >{/if}
            </form>
          </div>
          <div class="white-card">
            <div class="section-heading">
              <div>
                <h2>Historial de transacciones</h2>
                <p>
                  {supported ? chain.name : "Selecciona una red compatible"} · Últimas
                  30 operaciones
                </p>
              </div>
              <div class="inline-actions">
                <button
                  class="text-button"
                  disabled={historyBusy || !address}
                  onclick={loadHistory}
                  ><RefreshCw size={16} />Actualizar</button
                ><button
                  class="text-button"
                  disabled={!transactions.length}
                  onclick={exportHistory}><Download size={16} />CSV</button
                >
              </div>
            </div>
            {#if historyBusy}<div class="empty-state compact" role="status">
                Consultando el historial de tu cuenta…
              </div>{:else if historyError}<div class="info">
                {historyError}
              </div>{:else if !transactions.length}<div
                class="empty-state compact"
              >
                <Clock size={28} />
                <p>
                  {address
                    ? "Esta cuenta todavía no tiene operaciones indexadas en esta red."
                    : "Conecta tu wallet para consultar sus transacciones."}
                </p>
              </div>{/if}{#each transactions as t}<a
                class="movement transaction"
                href={`${explorer(Number(network))}/tx/${t.hash}`}
                target="_blank"
                rel="noreferrer"
                ><div
                  class="movement-icon"
                  class:incoming={t.to.toLowerCase() === address.toLowerCase()}
                >
                  {#if t.to.toLowerCase() === address.toLowerCase()}<ArrowDownLeft
                      size={20}
                    />{:else}<ArrowUpRight size={20} />{/if}
                </div>
                <div>
                  <strong
                    >{t.to.toLowerCase() === address.toLowerCase()
                      ? "Recibido de"
                      : "Enviado a"}
                    {cut(
                      t.to.toLowerCase() === address.toLowerCase()
                        ? t.from
                        : t.to,
                    )}</strong
                  ><small
                    >{new Date(t.timestamp).toLocaleString("es-PE")} · {t.status}</small
                  >
                </div>
                <strong>{money(t.value)} {symbolFor(network)}</strong
                ><ExternalLink size={15} /></a
              >{/each}{#if historySource}<small class="spaced"
                >{historySource === "Etherscan"
                  ? "Powered by Etherscan.io APIs"
                  : "Datos de Blockscout"} · {historyLimited
                  ? "Hay más operaciones disponibles en el explorador."
                  : "El indexador puede tardar en reflejar operaciones nuevas."}</small
              >{/if}{#if address && supported}<a
                class="transaction-link"
                href={`${explorer(Number(network))}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                >Ver todo en el explorador <ExternalLink size={16} /></a
              >{/if}
          </div>
        {:else}
          <div class="page-heading">
            <div>
              <div class="eyebrow">TU IDENTIDAD EN LA COMUNIDAD</div>
              <h1>Mi perfil<span>.</span></h1>
              <p>Tu actividad, respaldada por comprobantes verificables.</p>
            </div>
            <div class="avatar large"><UserRound size={30} /></div>
          </div>
          <div class="two-cols">
            <form
              class="white-card"
              onsubmit={(e) => {
                e.preventDefault();
                saveProfile();
              }}
            >
              <h2>Datos de mi cuenta</h2>
              <label for="name">Nombre para mostrar</label><input
                id="name"
                bind:value={profileName}
                required
                minlength="2"
                maxlength="50"
                placeholder="Tu nombre"
              /><label for="account">Wallet vinculada</label><input
                id="account"
                value={address || "Sin conectar"}
                readonly
              />
              <p>
                {authenticated
                  ? "Identidad verificada mediante firma de wallet."
                  : "Firma el inicio de sesión para guardar tu perfil y administrar tus juntas."}
              </p>
              <button class="primary" disabled={busy || !authenticated}
                >Guardar perfil</button
              >
            </form>
            <div class="white-card profile-score">
              <ShieldCheck size={36} />
              <h2>Tu trayectoria</h2>
              <div class="score-circle">
                {myPayments.length}<small>APORTES VERIFICADOS</small>
              </div>
              <span class="pill"
                >{authenticated
                  ? "Wallet verificada"
                  : "Sin sesión verificada"}</span
              >
              <p>
                Tu trayectoria crece con cada aporte registrado. No se asignan
                puntajes de crédito.
              </p>
            </div>
          </div>
          <div class="three-cols">
            {#each [{ label: "Juntas en las que participas", value: String(groups.length) }, { label: "Juntas completadas", value: String(completed) }, { label: "Total aportado", value: `${money(volume)} ${symbolFor(network)}` }] as stat}<div
                class="white-card"
              >
                <small>{stat.label}</small>
                <h2>{stat.value}</h2>
              </div>{/each}
          </div>
        {/if}
        <footer>
          <span>JuntaChain © 2026 · Ahorro en comunidad</span><span
            >Transparencia en cada aporte <span class="green">↗</span></span
          >
        </footer>
      </main>
    </div>
  </div>
{/if}
{#if modal && authenticated}<div class="modal-backdrop">
    <dialog
      use:showDialog
      class="modal"
      oncancel={(e) => {
        e.preventDefault();
        if (!busy) modal = "";
      }}
      aria-modal="true"
      aria-labelledby="modal-title"
      onkeydown={(e) => {
        if (e.key === "Escape" && !busy) modal = "";
      }}
    >
      <button
        class="close"
        disabled={busy}
        aria-label="Cerrar"
        onclick={() => (modal = "")}>×</button
      >
      {#if modal === "create"}<Users size={32} />
        <h2 id="modal-title">Una meta para compartir.</h2>
        <p>
          Define las reglas. Los turnos se asignan por orden de inscripción y
          comienzan cuando se completan los cupos.
        </p>
        {#if !authenticated}<div class="info">
            Conecta y firma con tu wallet para crear una junta.
          </div>
          <button class="primary full" disabled={busy} onclick={connect}
            >Conectar wallet</button
          >{/if}
        <form
          onsubmit={(e) => {
            e.preventDefault();
            createGroup();
          }}
        >
          <label for="title">Nombre de la junta</label><input
            id="title"
            bind:value={title}
            minlength="3"
            maxlength="60"
            required
            placeholder="Ej. Comerciantes Gamarra"
          />
          <div class="two-cols">
            <div>
              <label for="quota">Cuota en {symbolFor(network)}</label><input
                id="quota"
                bind:value={quota}
                required
                inputmode="decimal"
              />
            </div>
            <div>
              <label for="capacity">Participantes</label><input
                id="capacity"
                type="number"
                min="2"
                max="20"
                bind:value={capacity}
                required
              />
            </div>
          </div>
          <label for="frequency">Plazo para aportar por ronda</label><select
            id="frequency"
            bind:value={frequency}
            ><option value={7}>7 días</option><option value={15}>15 días</option
            ><option value={30}>30 días</option></select
          ><small
            >Red: {supported ? chain.name : "Cambia a una red compatible"} · Cada
            beneficiario recibe {money(Number(quota || 0) * (capacity - 1))}
            {symbolFor(network)} de los demás miembros.</small
          ><button
            class="primary full spaced"
            disabled={busy || !authenticated || !supported}>Crear junta</button
          >
        </form>
      {:else if modal === "join"}<QrCode size={32} />
        <h2 id="modal-title">Tu comunidad te espera.</h2>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
        >
          <label for="invitation">Enlace o código de invitación</label><input
            id="invitation"
            bind:value={inviteCode}
            required
            placeholder="Pega aquí tu invitación"
          /><button class="primary full spaced" disabled={busy}
            >Buscar junta</button
          >
        </form>
        {#if invitation}<div class="invitation-preview">
            <h3>{invitation.name}</h3>
            <p>
              {invitation.count} / {invitation.capacity} miembros · {chainName(
                invitation.chainId,
              )}<br />Cuota: {money(invitation.amount)}
              {symbolFor(invitation.chainId)} · Cada {invitation.frequency}
              días
            </p>
            <p>
              Los turnos siguen el orden de inscripción. Tu cuota va
              directamente al beneficiario de cada ronda.
            </p>
            {#if !authenticated}<button
                class="primary full"
                disabled={busy}
                onclick={connect}>Conectar para participar</button
              >{:else}<button
                class="primary full"
                disabled={busy || invitation.count >= invitation.capacity}
                onclick={join}
                >{invitation.count >= invitation.capacity
                  ? "Cupos completos"
                  : "Aceptar y unirme"}</button
              >{/if}
          </div>{/if}
      {:else if modal === "share"}<QrCode size={32} />
        <h2 id="modal-title">Invita a tu comunidad.</h2>
        <p>
          Comparte este QR o envía el enlace a las personas con las que
          ahorrarás.
        </p>
        <img
          class="share-qr"
          src={qr}
          alt="Código QR de invitación a la junta"
        /><label for="share">Enlace de invitación</label><input
          id="share"
          value={shareLink}
          readonly
        /><button class="primary full spaced" onclick={() => copy(shareLink)}
          ><Copy size={17} />Copiar invitación</button
        >
      {:else}<ShieldCheck size={32} />
        <h2 id="modal-title">Revisa tu transferencia.</h2>
        <p>Comprueba los detalles antes de autorizar en tu wallet.</p>
        <dl class="confirmation">
          <dt>Destinatario</dt>
          <dd>{recipient}</dd>
          <dt>Monto</dt>
          <dd>{money(amount)} {symbolFor(network)}</dd>
          <dt>Red</dt>
          <dd>{chain.name}</dd>
          <dt>Comisión</dt>
          <dd>Se calcula en tu wallet</dd>
        </dl>
        <button class="primary full" disabled={busy} onclick={send}
          >Confirmar en mi wallet <ArrowUpRight size={18} /></button
        >{/if}
      {#if notice}<div class="info" role="alert">{notice}</div>{/if}
    </dialog>
  </div>{/if}

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    background: #f6f8f7;
    color: #202b28;
    font-family: Inter, "Segoe UI", sans-serif;
    font-size: 14px;
  }
  :global(button),
  :global(input),
  :global(select) {
    font: inherit;
  }
  :global(button),
  :global(a) {
    -webkit-tap-highlight-color: transparent;
  }
  :global(button) {
    cursor: pointer;
  }
  :global(button:disabled) {
    cursor: wait;
    opacity: 0.6;
  }
  :global(button:focus-visible),
  :global(a:focus-visible),
  :global(input:focus-visible),
  :global(select:focus-visible) {
    outline: 3px solid #8776f5;
    outline-offset: 4px;
  }
  :global(a) {
    color: inherit;
  }
  :global(h1),
  :global(h2),
  :global(h3),
  :global(p) {
    margin-top: 0;
  }
  :global(h2) {
    font-size: 20px;
    letter-spacing: -0.5px;
  }
  .app {
    display: flex;
    min-height: 100vh;
  }
  aside {
    width: 246px;
    background: white;
    border-right: 1px solid #e3e9e5;
    padding: 34px 24px;
    position: fixed;
    inset: 0 auto 0 0;
    display: flex;
    flex-direction: column;
  }
  .brand {
    display: flex;
    gap: 10px;
    align-items: center;
    text-decoration: none;
    color: #006c4c;
    font-size: 25px;
    font-weight: 750;
    letter-spacing: -1px;
  }
  .brand span {
    font-size: 11px;
    align-self: start;
    margin-top: 4px;
  }
  .aside-label {
    margin: 58px 12px 18px;
    font-size: 9px;
    letter-spacing: 1.7px;
    color: #8b9791;
    font-weight: 700;
  }
  nav {
    display: grid;
    gap: 9px;
  }
  nav button {
    display: flex;
    align-items: center;
    gap: 14px;
    border: 0;
    background: none;
    color: #6c7771;
    padding: 14px 16px;
    border-radius: 9px;
    text-align: left;
    font-weight: 600;
  }
  nav button.active {
    background: #e8f5ee;
    color: #006d4b;
  }
  nav small {
    margin-left: auto;
    background: #cce9da;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .aside-bottom {
    margin-top: auto;
  }
  .secure {
    margin: 36px 0 24px;
    border: 1px solid #e2ebe5;
    border-radius: 12px;
    padding: 18px;
    color: #006c4c;
    background: #f7faf8;
  }
  .secure strong {
    display: block;
    margin: 12px 0 7px;
    font-size: 13px;
  }
  .secure p {
    font-size: 12px;
    line-height: 1.7;
    color: #79857d;
  }
  .secure span {
    font-size: 9px;
    letter-spacing: 1px;
    font-weight: 700;
  }
  .person {
    display: flex;
    gap: 10px;
    align-items: center;
    padding-top: 22px;
    border-top: 1px solid #edf0ed;
  }
  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #dcece2;
    display: grid;
    place-items: center;
    color: #317258;
    font-size: 12px;
    flex-shrink: 0;
  }
  .person strong {
    font-size: 11px;
  }
  .person small {
    display: block;
    font-size: 10px;
    color: #8c9690;
    margin-top: 5px;
  }
  .workspace {
    margin-left: 246px;
    flex: 1;
    min-width: 0;
  }
  header {
    height: 86px;
    background: #fff;
    border-bottom: 1px solid #e3e9e5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 44px;
    color: #8a958f;
    font-size: 12px;
  }
  .header-actions {
    display: flex;
    gap: 22px;
    align-items: center;
  }
  .testnet {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
  }
  .testnet i {
    width: 6px;
    height: 6px;
    background: #12b886;
    border-radius: 50%;
  }
  .wallet-button {
    border: 1px solid #dce6e0;
    background: #fff;
    border-radius: 24px;
    padding: 11px 18px;
    color: #006c4c;
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 600;
    font-size: 12px;
  }
  main {
    max-width: 1240px;
    margin: auto;
    padding: 42px 44px 0;
  }
  .page-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    gap: 20px;
  }
  .eyebrow {
    font-size: 9px;
    color: #668676;
    letter-spacing: 2px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  h1 {
    font-size: 40px;
    letter-spacing: -1.7px;
    font-weight: 650;
    margin-bottom: 10px;
  }
  h1 span {
    color: #10b981;
  }
  .page-heading p {
    font-size: 13px;
    color: #819087;
    line-height: 1.7;
    margin: 0;
  }
  .date {
    font-size: 9px;
    letter-spacing: 2px;
    color: #96a098;
  }
  .hero {
    background: #006b4b;
    color: white;
    border-radius: 17px;
    padding: 34px 38px;
    display: flex;
    justify-content: space-between;
    overflow: hidden;
    position: relative;
    margin-bottom: 34px;
    min-height: 280px;
  }
  .hero-label {
    font-size: 9px;
    letter-spacing: 2px;
    color: #9ed6bd;
  }
  .hero h2 {
    font-size: 36px;
    letter-spacing: -1px;
    line-height: 1.15;
    margin: 16px 0;
  }
  .hero p {
    font-size: 12px;
    color: #b0d9c5;
    line-height: 1.8;
  }
  .hero button {
    border: 0;
    border-radius: 7px;
    background: #ceef9d;
    color: #124b34;
    padding: 11px 17px;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .hero-art {
    position: relative;
    display: grid;
    place-items: center;
    width: 40%;
    min-width: 230px;
  }
  .ring {
    position: absolute;
    border: 1px solid #ffffff16;
    border-radius: 50%;
    width: 290px;
    height: 290px;
  }
  .r2 {
    width: 390px;
    height: 390px;
  }
  .qr {
    width: 143px;
    height: 150px;
    background: #e4f4d6;
    color: #006b4b;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 15px;
    transform: rotate(8deg);
    box-shadow: 0 15px 40px #003c4533;
  }
  .qr span {
    font-size: 7px;
    letter-spacing: 1px;
    font-weight: 800;
  }
  .float-tag {
    position: absolute;
    bottom: 22px;
    left: 5%;
    background: #ffffff;
    color: #29765b;
    padding: 10px 14px;
    border-radius: 7px;
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 8px 20px #003c4533;
    transform: rotate(-5deg);
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1.25fr 1fr;
    gap: 26px;
  }
  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 17px;
  }
  .section-heading h2 {
    margin: 0;
    font-size: 18px;
  }
  .section-heading h2 span {
    font-size: 10px;
    color: #90a296;
    font-weight: 400;
    margin-left: 7px;
  }
  .text-button {
    background: none;
    border: 0;
    color: #007754;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px;
  }
  .muted {
    font-size: 10px;
    color: #98a39c;
  }
  .group-card {
    background: white;
    border: 1px solid #dfe7e1;
    border-radius: 13px;
    padding: 23px;
    width: 100%;
    text-align: left;
    color: inherit;
    transition: box-shadow 0.2s;
  }
  .group-card:hover {
    box-shadow: 0 8px 25px #143e2810;
  }
  .group-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .group-icon {
    background: #eff6eb;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    color: #56834d;
    border-radius: 12px;
  }
  .pill {
    display: inline-block;
    background: #e5f6ec;
    color: #15724d;
    font-size: 9px;
    padding: 7px 9px;
    border-radius: 5px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .group-card h3 {
    font-size: 20px;
    letter-spacing: -0.7px;
    margin: 19px 0 7px;
  }
  .group-card p {
    font-size: 11px;
    color: #8b978e;
  }
  .pool {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 25px 0 17px;
  }
  .pool small {
    display: block;
    font-size: 8px;
    color: #8e9a91;
    letter-spacing: 1px;
    margin-bottom: 7px;
  }
  .pool strong {
    display: block;
    font-size: 29px;
    letter-spacing: -1px;
    font-weight: 600;
  }
  .pool strong span {
    font-size: 17px;
    color: #a7b2aa;
    font-weight: 400;
  }
  .round {
    font-size: 9px;
    background: #eeeafd;
    color: #7564b5;
    padding: 6px 8px;
    border-radius: 4px;
  }
  .progress {
    height: 6px;
    border-radius: 4px;
    background: #e9efea;
    overflow: hidden;
  }
  .progress span {
    height: 100%;
    display: block;
    background: #0bb884;
    border-radius: 4px;
  }
  .payment {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f7f9f6;
    border-radius: 7px;
    padding: 14px;
    margin-top: 23px;
  }
  .payment small {
    display: block;
    color: #87958b;
    font-size: 9px;
    margin-bottom: 5px;
  }
  .payment > span {
    display: flex;
    align-items: center;
    font-size: 10px;
    color: #007653;
    gap: 9px;
  }
  .score-card {
    background: #eaf1e9;
    border: 1px solid #dde7dc;
    border-radius: 13px;
    padding: 22px;
    position: relative;
    overflow: hidden;
    min-height: 225px;
  }
  .score-card > div:first-child {
    display: flex;
    gap: 9px;
    align-items: center;
    color: #476c50;
  }
  .score-card div > span {
    font-size: 9px;
    letter-spacing: 1.5px;
  }
  .score-card > strong {
    font-size: 48px;
    display: block;
    letter-spacing: -2px;
    margin: 10px 0 3px;
    font-weight: 550;
  }
  .score-card > strong span {
    font-size: 18px;
    color: #96a994;
    letter-spacing: 0;
  }
  .score-card p {
    font-size: 10px;
    color: #82927e;
  }
  .score-card .pill {
    background: #d7e7cc;
    font-size: 8px;
  }
  .savings {
    background: #eeeafa;
    border: 1px solid #e5dff4;
    border-radius: 13px;
    margin-top: 15px;
    padding: 21px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #74629b;
  }
  .savings span {
    font-size: 9px;
    letter-spacing: 1px;
  }
  .savings strong {
    display: block;
    font-size: 27px;
    color: #58467f;
    margin: 7px 0;
  }
  .savings small {
    font-size: 10px;
    color: #9a8fb0;
  }
  .movements {
    margin-top: 34px;
  }
  .movement {
    display: flex;
    gap: 14px;
    align-items: center;
    background: white;
    border-bottom: 1px solid #edf0ec;
    padding: 18px 20px;
    min-width: 0;
  }
  .movements > .movement:nth-child(2) {
    border-radius: 10px 10px 0 0;
  }
  .movements > .movement:last-child {
    border-radius: 0 0 10px 10px;
  }
  .movement-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    background: #f5eeea;
    color: #a87860;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .incoming {
    background: #e5f2ed;
    color: #33846a;
  }
  .movement strong {
    font-size: 12px;
    font-weight: 600;
  }
  .movement small {
    display: block;
    font-size: 10px;
    color: #99a39c;
    margin-top: 5px;
  }
  .movement > strong {
    margin-left: 25px;
    white-space: nowrap;
  }
  .green {
    color: #0b8e62;
  }
  .white-card {
    padding: 27px;
    background: white;
    border: 1px solid #e0e8e2;
    border-radius: 14px;
    margin-bottom: 20px;
  }
  .white-card p {
    color: #7d8d82;
    line-height: 1.7;
    font-size: 12px;
  }
  .white-card small {
    color: #809087;
    line-height: 1.7;
    font-size: 11px;
  }
  .two-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .three-cols {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .info {
    padding: 17px;
    background: #eff7f2;
    border-radius: 8px;
    color: #688474;
    font-size: 12px;
    line-height: 1.8;
    display: flex;
    gap: 10px;
    margin: 20px 0;
  }
  .info :global(svg) {
    flex-shrink: 0;
  }
  .primary {
    border: 0;
    border-radius: 8px;
    background: #08ae7d;
    color: white;
    font-weight: 600;
    padding: 13px 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .full {
    width: 100%;
  }
  label {
    display: block;
    font-size: 12px;
    color: #566e5f;
    font-weight: 600;
    margin: 20px 0 9px;
  }
  input,
  select {
    width: 100%;
    padding: 14px;
    border: 1px solid #d9e3dc;
    border-radius: 7px;
    background: #fafcf9;
    color: #284c37;
  }
  select {
    margin-bottom: 12px;
  }
  .balance-card {
    background: #006b4b;
    color: white;
    padding: 30px;
    border-radius: 15px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .balance-card > span {
    font-size: 9px;
    letter-spacing: 1.5px;
    color: #acd5c2;
  }
  .balance-card strong {
    font-size: 32px;
    word-break: break-all;
  }
  .balance-card small {
    font-size: 10px;
    word-break: break-all;
    color: #b7d9c9;
  }
  .balance-card button {
    display: flex;
    justify-content: space-between;
    border: 1px solid #ffffff55;
    border-radius: 8px;
    padding: 13px;
    background: #ffffff15;
    color: white;
  }
  .transaction-link {
    color: #00835b;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    margin: 12px 0;
    word-break: break-all;
  }
  .white-card > small {
    display: block;
  }
  .profile-score {
    text-align: center;
  }
  .profile-score > :global(svg) {
    color: #06ad7b;
  }
  .score-circle {
    width: 155px;
    height: 155px;
    border-radius: 50%;
    border: 9px solid #0bb885;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-size: 58px;
    letter-spacing: -2px;
    margin: 25px auto;
    color: #006b4b;
  }
  .score-circle small {
    font-size: 10px;
    letter-spacing: 2px;
  }
  .profile-score p {
    margin-top: 20px;
  }
  .large {
    width: 65px;
    height: 65px;
    font-size: 19px;
  }
  footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e2e8e2;
    padding: 25px 0;
    margin-top: 35px;
    color: #9ba59e;
    font-size: 9px;
  }
  .notice {
    background: #fff2de;
    border: 1px solid #ead0a3;
    padding: 15px;
    border-radius: 9px;
    margin-bottom: 20px;
    overflow-wrap: anywhere;
    display: flex;
    justify-content: space-between;
    gap: 15px;
  }
  .notice button,
  .close {
    border: 0;
    background: none;
    font-size: 24px;
    color: #718176;
  }
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: #092b22aa;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 20px;
    backdrop-filter: blur(5px);
  }
  .modal {
    border: 0;
    color: inherit;
    background: #fff;
    padding: 35px;
    border-radius: 18px;
    max-width: 450px;
    position: relative;
  }
  .modal > :global(svg) {
    color: #009663;
  }
  .modal h2 {
    font-size: 27px;
    margin: 20px 0 12px;
  }
  .modal p {
    line-height: 1.8;
    font-size: 12px;
    color: #7c8c81;
  }
  .close {
    position: absolute;
    right: 16px;
    top: 10px;
  }
  .modal .primary {
    margin-top: 20px;
  }

  @media (min-width: 1450px) {
    main {
      padding-top: 50px;
    }
    .hero {
      min-height: 310px;
    }
    .hero h2 {
      font-size: 42px;
    }
  }
  @media (max-width: 1100px) {
    aside {
      width: 205px;
      padding: 30px 17px;
    }
    .brand {
      font-size: 22px;
    }
    .workspace {
      margin-left: 205px;
    }
    main {
      padding: 30px 26px 0;
    }
    header {
      padding: 0 26px;
    }
    .hero {
      padding: 30px;
    }
    .hero-art {
      min-width: 170px;
    }
    .hero h2 {
      font-size: 30px;
    }
    .dashboard-grid {
      gap: 17px;
    }
    .group-card {
      padding: 19px;
    }
    .group-card h3 {
      font-size: 18px;
    }
  }
  @media (max-width: 800px) {
    aside {
      position: fixed;
      inset: auto 0 0;
      width: 100%;
      height: 76px;
      padding: 8px 10px;
      z-index: 5;
      border-top: 1px solid #dce6de;
      border-right: 0;
    }
    .brand,
    .aside-label,
    .aside-bottom {
      display: none;
    }
    nav {
      display: flex;
      justify-content: space-around;
    }
    nav button {
      flex-direction: column;
      gap: 5px;
      padding: 8px 17px;
      font-size: 10px;
    }
    nav small {
      display: none;
    }
    .workspace {
      margin-left: 0;
    }
    header {
      height: 75px;
      padding: 0 22px;
    }
    header > span {
      font-size: 0;
    }
    header > span:after {
      content: "JuntaChain";
      font-size: 23px;
      font-weight: 750;
      color: #006c4c;
      letter-spacing: -1px;
    }
    .testnet {
      display: none;
    }
    main {
      padding: 30px 22px 80px;
    }
    .date {
      display: none;
    }
    h1 {
      font-size: 34px;
    }
    .hero {
      padding: 27px;
    }
    .hero-art {
      min-width: 130px;
      width: 30%;
    }
    .qr {
      width: 105px;
      height: 115px;
    }
    .qr :global(svg) {
      width: 55px;
    }
    .qr span {
      font-size: 5px;
    }
    .float-tag {
      font-size: 8px;
      padding: 8px;
      left: -20px;
      bottom: 35px;
    }
    .hero h2 {
      font-size: 29px;
    }
    .hero-label {
      font-size: 7px;
    }
    .hero p {
      font-size: 11px;
    }
    .dashboard-grid {
      grid-template-columns: 1fr 1fr;
    }
    .section-heading h2 {
      font-size: 16px;
    }
    .muted {
      font-size: 8px;
    }
    .pool {
      gap: 10px;
    }
    .pool strong {
      font-size: 25px;
    }
    .round {
      font-size: 8px;
    }
    .payment {
      padding: 10px;
    }
    .group-card h3 {
      line-height: 1.4;
    }
    .group-card {
      height: calc(100% - 35px);
    }
    .wallet-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 540px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
    .group-card {
      height: auto;
    }
    .hero {
      min-height: 275px;
      padding: 25px;
    }
    .hero-art {
      position: absolute;
      right: -12px;
      bottom: 26px;
      height: 160px;
      min-width: 130px;
    }
    .hero h2 {
      font-size: 32px;
    }
    .hero p {
      max-width: 210px;
    }
    .hero-art .float-tag {
      display: none;
    }
    .hero-art .ring {
      width: 200px;
      height: 200px;
    }
    .hero-art .r2 {
      width: 300px;
      height: 300px;
    }
    .qr {
      transform: rotate(12deg);
      width: 88px;
      height: 103px;
    }
    .qr :global(svg) {
      width: 49px;
    }
    .qr span {
      font-size: 4px;
    }
    .hero button {
      position: relative;
      z-index: 1;
    }
    .score-card {
      min-height: 210px;
    }
    .savings {
      margin-top: 12px;
    }
    .movement {
      padding: 16px 12px;
      gap: 10px;
    }
    .movement > strong {
      margin-left: auto;
      font-size: 11px;
    }
    .movement strong {
      font-size: 11px;
    }
    .movement small {
      font-size: 9px;
    }
    .two-cols,
    .three-cols {
      grid-template-columns: 1fr;
    }
    .page-heading {
      align-items: flex-start;
    }
    .page-heading > .primary {
      font-size: 10px;
      padding: 10px;
    }
    .page-heading p {
      font-size: 12px;
    }
    .wallet-button {
      font-size: 10px;
      padding: 10px 12px;
    }
    .section-heading {
      margin-top: 5px;
    }
    footer {
      font-size: 8px;
      gap: 12px;
    }
    .white-card {
      padding: 22px;
    }
  }

  .icon-button {
    background: none;
    border: 0;
    color: #769180;
    padding: 7px;
    margin-left: auto;
  }
  .success {
    background: #e6f5eb;
    border-color: #b6ddc7;
    color: #176d48;
  }
  .hero .hero-secondary {
    margin-top: 12px;
    background: transparent;
    color: #c2e2d0;
    border: 1px solid #ffffff30;
    font-size: 10px;
  }
  .empty-state {
    padding: 36px 24px;
    background: #fff;
    border: 1px dashed #cfddd3;
    border-radius: 13px;
    text-align: center;
    color: #799081;
    line-height: 1.8;
  }
  .empty-state :global(svg) {
    color: #429674;
    margin-bottom: 12px;
  }
  .empty-state h3 {
    font-size: 18px;
    color: #315d45;
    line-height: 1.4;
  }
  .empty-state p {
    font-size: 12px;
    margin-bottom: 20px;
  }
  .compact {
    padding: 24px;
  }
  .compact p {
    margin-bottom: 0;
  }
  .transaction {
    text-decoration: none;
    transition: background 0.15s;
  }
  .transaction:hover {
    background: #f3f8f4;
  }
  .transaction > :global(svg):last-child {
    margin-left: auto;
    color: #799583;
    flex-shrink: 0;
  }
  .transaction > strong {
    margin-left: auto;
  }
  .spaced {
    margin-top: 22px !important;
  }
  .beneficiary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-top: 25px;
  }
  .beneficiary h3 {
    margin: 12px 0;
  }
  .beneficiary p {
    margin: 0;
  }
  .beneficiary small {
    font-size: 9px;
    letter-spacing: 1px;
  }
  .address-line {
    overflow-wrap: anywhere;
    font-size: 9px !important;
  }
  .inline-actions {
    display: flex;
    gap: 13px;
  }
  .invitation-preview {
    padding: 20px;
    background: #f2f7f3;
    border-radius: 10px;
    margin-top: 24px;
  }
  .share-qr {
    display: block;
    width: 200px;
    height: 200px;
    margin: 0 auto;
  }
  .confirmation {
    margin: 25px 0;
  }
  .confirmation dt {
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #879a8c;
    margin-top: 18px;
  }
  .confirmation dd {
    margin: 7px 0 0;
    font-size: 14px;
    overflow-wrap: anywhere;
    font-weight: 600;
  }
  .modal {
    max-height: 90dvh;
    overflow: auto;
    width: min(100%, 480px);
    margin: auto;
  }
  .group-card {
    margin-bottom: 16px;
    height: auto !important;
  }
  .white-card .section-heading p {
    margin: 8px 0 0;
  }
  .white-card h2 {
    overflow-wrap: anywhere;
  }
  input:read-only {
    color: #74917e;
    background: #eff4ef;
  }
  .pill :global(svg) {
    vertical-align: middle;
  }
  .person {
    gap: 8px;
  }
  .score-card {
    min-height: 205px;
  }
  .score-card > strong {
    font-size: 44px;
  }
  .score-card > strong span {
    font-size: 15px;
  }
  .savings strong {
    font-size: 25px;
  }
  .page-heading h1 {
    overflow-wrap: anywhere;
  }
  .modal .info {
    margin-bottom: 12px;
  }
  .modal .primary {
    margin-top: 12px;
  }
  @media (max-width: 540px) {
    .beneficiary {
      display: block;
    }
    .beneficiary > .primary,
    .beneficiary > .pill {
      margin-top: 17px;
    }
    .inline-actions {
      gap: 8px;
      flex-wrap: wrap;
    }
    .movement > div:nth-child(2) {
      min-width: 0;
    }
    .movement .address-line {
      max-width: 145px;
    }
    .page-heading h1 {
      font-size: 29px;
    }
    .hero-art {
      bottom: 55px;
    }
    .modal {
      padding: 26px;
    }
    .transaction {
      padding: 16px 6px;
      gap: 8px;
    }
    .transaction strong {
      font-size: 10px;
    }
    .transaction small {
      font-size: 8px;
    }
    .score-card > strong {
      font-size: 44px;
    }
  }
</style>
