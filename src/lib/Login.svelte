<script lang="ts">
  import {
    Wallet,
    ArrowUpRight,
    ShieldCheck,
    Users,
    Check,
    LoaderCircle,
    ArrowRight,
    Fingerprint,
    ChevronDown,
  } from "lucide-svelte";
  let {
    onconnect,
    busy,
    checking,
    step,
    error,
    address,
    hasWallet,
    invited,
  }: {
    onconnect: () => void;
    busy: boolean;
    checking: boolean;
    step: string;
    error: string;
    address: string;
    hasWallet: boolean;
    invited: boolean;
  } = $props();
  let help = $state(false);
  const label = $derived(
    checking
      ? "Comprobando sesión…"
      : busy
        ? step || "Conectando…"
        : address
          ? "Verificar y entrar"
          : "Conectar con MetaMask",
  );
</script>

<div class="login-shell">
  <section class="story" aria-label="Bienvenido a JuntaChain">
    <a class="login-brand" href="/"
      ><Wallet size={29} />JuntaChain<span>®</span></a
    >
    <div class="story-content">
      <span class="eyebrow">EL AHORRO QUE NOS UNE</span>
      <h1>
        Tu próxima meta.<br />Nuestra próxima<br />{" "}<em>gran historia.</em>
      </h1>
      <p>
        Ahorra con tu comunidad, organiza tus turnos y sigue cada aporte con la
        transparencia de blockchain.
      </p>
      <div class="community-art" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="center-icon"><Users size={46} /></div>
        <span class="node node-one">01</span><span class="node node-two"
          >02</span
        ><span class="node node-three">03</span><span class="art-note"
          ><Check size={15} />Cada aporte cuenta</span
        >
      </div>
    </div>
    <div class="story-footer">
      <ShieldCheck size={18} /><span
        >Tu wallet, tu identidad. Tu comunidad, tu confianza.</span
      >
    </div>
  </section>
  <section class="access">
    <div class="top-note">
      <span class="live-dot"></span>SEPOLIA · HOODI · zkSYS
      <span class="network-tag">TESTNET</span>
    </div>
    <div class="login-card">
      <div class="entry-icon"><Fingerprint size={28} /></div>
      <span class="eyebrow dark">BIENVENIDO A TU COMUNIDAD</span>
      <h2>Conecta.<br />{" "}Confía. <span>Comienza.</span></h2>
      <p class="intro">
        Tu wallet es tu acceso a JuntaChain.<br />Sin contraseñas, con el
        control en tus manos.
      </p>
      {#if invited}<div class="invite-banner">
          <Users size={18} /><span
            >Tienes una invitación pendiente. Conecta tu wallet para conocer tu
            junta y participar.</span
          >
        </div>{/if}
      <div class="steps">
        <div class:current={step.includes("conexión") || !address}>
          <span
            >{#if address}<Check size={12} />{:else}1{/if}</span
          >Conecta tu wallet
        </div>
        <div class:current={step.includes("firma")}>
          <span>2</span>Firma tu acceso
        </div>
      </div>
      <button
        class="connect-button"
        onclick={onconnect}
        disabled={busy || checking}
        >{#if busy || checking}<LoaderCircle
            class="spinner"
            size={22}
          />{:else}<Wallet size={22} />{/if}<span>{label}</span
        >{#if !busy && !checking}<ArrowUpRight size={21} />{/if}</button
      >
      {#if address}<div class="connected-address">
          <span class="live-dot"></span>Wallet conectada
          <code>{address.slice(0, 6)}…{address.slice(-4)}</code>
        </div>{/if}
      {#if error}<div class="login-error" role="alert">{error}</div>{/if}
      <div class="signature-note">
        <ShieldCheck size={18} />
        <p>
          La firma confirma que la wallet te pertenece.<br /><strong
            >No mueve fondos ni autoriza pagos.</strong
          >
        </p>
      </div>
      <div class="wallet-help">
        <span
          >{hasWallet
            ? "¿Necesitas otra wallet?"
            : "¿Todavía no tienes una wallet?"}</span
        ><a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer">Instalar MetaMask <ArrowUpRight size={13} /></a
        >
      </div>
      <button
        class="help-toggle"
        aria-expanded={help}
        onclick={() => (help = !help)}
        >¿Cómo funciona el acceso?<ChevronDown size={16} /></button
      >
      {#if help}<ol class="help">
          <li>Acepta compartir tu dirección con JuntaChain desde MetaMask.</li>
          <li>
            Revisa el dominio y firma el mensaje de acceso, sin comisión de gas.
          </li>
          <li>
            Entrarás a tu panel para crear o unirte a una junta. Cada pago
            requiere otra confirmación.
          </li>
        </ol>{/if}
    </div>
    <footer>
      <span>© 2026 JuntaChain</span><span
        >Hecho para crecer juntos <ArrowRight size={13} /></span
      >
    </footer>
  </section>
</div>

<style>
  .login-shell {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #fafbf9;
    font-family: Inter, "Segoe UI", sans-serif;
    color: #20382c;
  }
  .story {
    background: #00694b;
    color: #f7fbf5;
    padding: 43px 58px 29px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .login-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    font-size: 27px;
    letter-spacing: -1px;
    font-weight: 750;
    position: relative;
    z-index: 1;
  }
  .login-brand span {
    font-size: 11px;
    align-self: flex-start;
    margin-top: 3px;
  }
  .story-content {
    margin: auto 0;
    position: relative;
    padding: 66px 0 10px;
  }
  .eyebrow {
    display: block;
    font-size: 9px;
    letter-spacing: 2.2px;
    font-weight: 650;
    color: #a4d4bd;
  }
  .story h1 {
    font-size: clamp(40px, 4.3vw, 68px);
    font-weight: 550;
    letter-spacing: -2.8px;
    line-height: 1.08;
    margin: 21px 0;
  }
  .story em {
    font-style: normal;
    color: #d0eea6;
  }
  .story-content > p {
    max-width: 340px;
    font-size: 13px;
    line-height: 1.9;
    color: #b4d7c7;
  }
  .story-footer {
    display: flex;
    gap: 9px;
    font-size: 10px;
    color: #a9ccba;
    align-items: center;
    padding-top: 22px;
    border-top: 1px solid #ffffff20;
    position: relative;
  }
  .community-art {
    height: 220px;
    max-width: 370px;
    position: relative;
    display: grid;
    place-items: center;
    margin: 10px 0 15px;
  }
  .orbit {
    position: absolute;
    border: 1px solid #ffffff18;
    border-radius: 50%;
    width: 185px;
    height: 185px;
  }
  .orbit-two {
    width: 295px;
    height: 295px;
  }
  .center-icon {
    position: relative;
    width: 100px;
    height: 105px;
    background: #cfeaa9;
    color: #00694b;
    border-radius: 22px;
    display: grid;
    place-items: center;
    transform: rotate(-9deg);
    box-shadow: 0 18px 45px #003e3420;
  }
  .node {
    position: absolute;
    width: 36px;
    height: 36px;
    border: 1px solid #ffffff40;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #087759;
    color: #bce3cc;
    font-size: 10px;
  }
  .node-one {
    left: 31px;
    top: 80px;
  }
  .node-two {
    right: 58px;
    top: 6px;
  }
  .node-three {
    right: 38px;
    bottom: 25px;
  }
  .art-note {
    display: flex;
    align-items: center;
    gap: 7px;
    position: absolute;
    left: 20px;
    bottom: 5px;
    background: #f0f8e8;
    color: #297049;
    font-size: 10px;
    padding: 11px 14px;
    border-radius: 8px;
    transform: rotate(-5deg);
  }
  .access {
    padding: 35px 56px 26px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .top-note {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    font-size: 8px;
    letter-spacing: 1.2px;
    color: #7c9184;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    display: inline-block;
    background: #10b784;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .network-tag {
    background: #e9f1e9;
    color: #577a61;
    border-radius: 4px;
    padding: 5px 7px;
    font-size: 7px;
    letter-spacing: 1px;
  }
  .login-card {
    max-width: 370px;
    width: 100%;
    margin: auto;
    padding: 50px 0;
  }
  .entry-icon {
    width: 48px;
    height: 48px;
    border-radius: 13px;
    background: #e8f2e7;
    color: #007451;
    display: grid;
    place-items: center;
    margin-bottom: 27px;
  }
  .dark {
    color: #73907b;
    font-size: 8px;
    letter-spacing: 1.6px;
  }
  .login-card h2 {
    font-size: 43px;
    line-height: 1.12;
    font-weight: 600;
    letter-spacing: -1.9px;
    margin: 16px 0;
  }
  .login-card h2 span {
    color: #00805b;
  }
  .intro {
    font-size: 12px;
    color: #7e9082;
    line-height: 1.9;
    margin-bottom: 26px;
  }
  .steps {
    display: flex;
    gap: 22px;
    margin: 20px 0;
    color: #8c9b8f;
    font-size: 10px;
    align-items: center;
  }
  .steps > div {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .steps span {
    width: 20px;
    height: 20px;
    border: 1px solid #d9e4d8;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 9px;
  }
  .steps .current {
    color: #277854;
  }
  .steps .current span {
    background: #e2f1df;
    border-color: #b8d4b3;
  }
  .connect-button {
    width: 100%;
    border: 0;
    background: #007653;
    color: #fff;
    border-radius: 9px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 17px 18px;
    box-shadow: 0 6px 16px #006b4b18;
    font-size: 12px;
    font-weight: 600;
    transition:
      background 0.2s,
      transform 0.2s;
    min-height: 57px;
  }
  .connect-button:hover:enabled {
    background: #005e42;
    transform: translateY(-1px);
  }
  .connect-button > span {
    flex: 1;
    text-align: left;
  }
  .connect-button:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .signature-note {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 20px 2px;
    color: #6f8b76;
  }
  .signature-note :global(svg) {
    flex-shrink: 0;
    margin-top: 3px;
  }
  .signature-note p {
    margin: 0;
    font-size: 10px;
    line-height: 1.8;
  }
  .signature-note strong {
    font-weight: 550;
    color: #526f5d;
  }
  .wallet-help {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 19px 0;
    border-top: 1px solid #e1e8df;
    font-size: 10px;
    color: #8a9a8d;
  }
  .wallet-help a {
    display: flex;
    align-items: center;
    gap: 3px;
    color: #187653;
    text-decoration: none;
  }
  .help-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: 0;
    padding: 6px 0;
    color: #728577;
    font-size: 10px;
  }
  .help {
    color: #728577;
    font-size: 11px;
    line-height: 1.8;
    padding-left: 17px;
  }
  .help li {
    margin-bottom: 9px;
  }
  .access footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    font-size: 9px;
    color: #96a193;
    padding-top: 15px;
  }
  .access footer > span:last-child {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .login-error {
    padding: 13px;
    background: #fff0e8;
    border: 1px solid #efcdb8;
    color: #99533a;
    border-radius: 7px;
    font-size: 11px;
    line-height: 1.7;
    margin-top: 15px;
    overflow-wrap: anywhere;
  }
  .connected-address {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    color: #6e8976;
    margin-top: 13px;
  }
  .connected-address code {
    margin-left: auto;
    color: #336e4c;
    font-size: 10px;
  }
  .invite-banner {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    background: #eef0fb;
    color: #6a6896;
    padding: 13px;
    border-radius: 8px;
    font-size: 11px;
    line-height: 1.7;
  }
  .invite-banner :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .connect-button :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .connect-button :global(.spinner) {
      animation: none;
    }
    .connect-button {
      transition: none;
    }
  }
  @media (min-width: 1500px) {
    .story {
      padding-left: max(70px, calc((100vw - 1300px) / 2));
    }
    .story-content {
      padding-top: 85px;
    }
    .community-art {
      height: 250px;
    }
  }
  @media (max-width: 950px) {
    .story {
      padding: 32px;
    }
    .access {
      padding: 30px;
    }
    .story h1 {
      font-size: 44px;
      letter-spacing: -2px;
    }
    .story-content {
      padding-top: 45px;
    }
    .community-art {
      height: 200px;
    }
    .orbit-two {
      width: 250px;
      height: 250px;
    }
    .login-card h2 {
      font-size: 37px;
    }
    .wallet-help {
      flex-wrap: wrap;
    }
    .steps {
      gap: 12px;
    }
  }
  @media (max-width: 650px) {
    .login-shell {
      grid-template-columns: 1fr;
    }
    .story {
      padding: 25px 25px 28px;
    }
    .login-brand {
      font-size: 24px;
    }
    .story-content {
      padding: 31px 0 0;
    }
    .story h1 {
      font-size: 35px;
      letter-spacing: -1.7px;
      margin: 14px 0;
    }
    .story h1 br:nth-child(2) {
      display: none;
    }
    .story-content > p {
      margin-bottom: 0;
      font-size: 11px;
      max-width: 270px;
    }
    .story-content > .eyebrow {
      font-size: 7px;
    }
    .community-art,
    .story-footer {
      display: none;
    }
    .access {
      padding: 22px 25px;
    }
    .top-note {
      justify-content: flex-start;
    }
    .login-card {
      padding: 28px 0 20px;
      max-width: 100%;
    }
    .entry-icon {
      display: none;
    }
    .login-card h2 {
      font-size: 34px;
      margin: 13px 0;
    }
    .login-card h2 br {
      display: none;
    }
    .intro {
      font-size: 11px;
      margin-bottom: 20px;
    }
    .dark {
      font-size: 7px;
    }
    .steps {
      margin: 18px 0;
    }
    .connect-button {
      padding: 16px;
    }
    .signature-note {
      padding: 17px 0;
    }
    .wallet-help {
      padding: 16px 0;
    }
    .access footer {
      font-size: 8px;
      margin-top: 15px;
    }
    .story-content p {
      line-height: 1.8;
    }
  }
</style>
