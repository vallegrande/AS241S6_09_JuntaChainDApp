# JuntaChain · DApp de ahorro comunitario

Svelte 5, SvelteKit, TypeScript y viem. Login con firma de MetaMask, juntas persistentes, invitaciones por QR, transferencias directas e historial consultado desde exploradores de blockchain. No hay datos precargados ni historial en localStorage.

## Redes

| Red | Chain ID | Moneda | RPC | Explorador |
| --- | --- | --- | --- | --- |
| Sepolia | 11155111 | ETH | Proveedor configurado en viem | https://sepolia.etherscan.io |
| Hoodi | 560048 | ETH | Proveedor configurado en viem | https://hoodi.etherscan.io |
| zkSYS Genesis Testnet | 57057 | SYS | https://rpc-zk.tanenbaum.io | https://explorer-zk.tanenbaum.io |

La configuración común está en `src/lib/networks.ts`. zkSYS corresponde a la red Genesis actual, no a la antigua testnet 5701. Fuente: https://syscoin.org/news/zksys-genesis-public-testnet-is-live

El selector solicita `wallet_switchEthereumChain`. Si la wallet devuelve 4902, solicita `wallet_addEthereumChain`, vuelve a cambiar y comprueba el chain ID resultante. Añadir y cambiar de red requieren aprobación del usuario en MetaMask. No se agregan redes arbitrarias.

## Desarrollo

Requiere Node 24.

```sh
npm ci
npm run dev
```

Conecta MetaMask y firma el mensaje de acceso. La firma no mueve fondos. Cada transferencia requiere una autorización aparte. Cambiar de cuenta sin sesión verificada devuelve al login.

## Juntas y pagos

1. Crear una junta con cuota en la moneda nativa de la red, 2–20 miembros y plazo por ronda de 7, 15 o 30 días.
2. Compartir el enlace o QR. Los participantes conectan su propia wallet para aceptar.
3. La junta se activa al completar los cupos. El orden de inscripción fija los turnos de cobro.
4. Cada miembro, excepto el beneficiario, envía su cuota a la wallet del beneficiario. Este recibe `(miembros - 1) × cuota`.
5. El servidor verifica chain ID del RPC, origen, destino, monto, fecha y recibo exitoso. Cada comprobante se registra una sola vez por red.
6. Al completar los aportes, se avanza la ronda. La junta finaliza cuando todos han recibido su turno.
7. Si se cerró la página tras pagar, se puede pegar el hash en la junta para verificarlo sin volver a enviar fondos.

Las transferencias son directas; la aplicación no custodia fondos ni garantiza que los participantes cumplan. No hay contrato de distribución, multas automáticas ni puntajes crediticios. Los tokens son de testnet y no se equiparan a soles o USDC.

## Historial

El backend consulta hasta 30 operaciones de la cuenta y red conectadas mediante el indexador correspondiente. zkSYS utiliza su propio explorador Blockscout; Sepolia y Hoodi utilizan sus instancias Blockscout. Etherscan V2 es una alternativa opcional para las redes compatibles, con fallback a Blockscout si falla. La interfaz permite exportar CSV y abrir el explorador. Si el proveedor no responde, muestra un error; no sustituye el resultado por datos de otra red.

## Base de datos

La misma capa libSQL funciona en dos modalidades:

- Local / Docker con volumen: SQLite en `DATABASE_PATH`, por defecto `data/juntachain.sqlite`.
- Cloud con Turso: configurar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en los secretos del host. Las tablas se crean automáticamente.

Render Free elimina los archivos locales al reiniciar. Mientras no configures Turso, la aplicación funciona con almacenamiento temporal y el healthcheck informa `storage: sqlite` y `persistent: false`. La publicación de la página y la persistencia de las juntas son aspectos diferentes.

No se migran automáticamente las juntas existentes del archivo local a Turso. Si ya hay datos que deseas conservar, respáldalos antes de cambiar la conexión. No subas `.env`, tokens ni archivos de la base a GitHub.

## Render: actualizar la página ya publicada

1. Subir estos cambios a la rama conectada en Render.
2. Mantener Language/Runtime en Docker y plan Free.
3. Render reconstruirá la imagen mediante el `Dockerfile`.
4. `scripts/start.mjs` utiliza `RENDER_EXTERNAL_URL` como ORIGIN si no lo configuraste explícitamente. Si ya existe ORIGIN, debe coincidir con la URL pública, sin `/` al final.
5. Configurar Health Check Path: `/api/health`.
6. Para conservar juntas y perfiles, crear una base libSQL en Turso y agregar sus dos secretos en Environment. No publicarlos en el chat ni en GitHub.
7. Comprobar `/api/health`: debe indicar `status: ok`, las tres redes y `storage: turso` cuando la conexión remota esté activa.

También se incluye `render.yaml` para crear un servicio mediante Blueprint. No es necesario crear otro servicio si ya tienes uno publicado.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| TURSO_DATABASE_URL | URL de la base libSQL remota, opcional en local |
| TURSO_AUTH_TOKEN | Secreto de acceso a Turso; solo en servidor |
| DATABASE_PATH | Archivo SQLite local |
| ORIGIN | URL pública; Render se detecta automáticamente |
| ETHERSCAN_API_KEY | Alternativa opcional para historial de Sepolia/Hoodi |
| SEPOLIA_RPC_URL / HOODI_RPC_URL / ZKSYS_RPC_URL | RPCs dedicados opcionales para verificar aportes |

Las variables `SEPOLIA_HISTORY_URL`, `HOODI_HISTORY_URL` y `ZKSYS_HISTORY_URL` permiten sustituir indexadores en servidor y pruebas. No se reciben URLs RPC/indexadores desde el navegador.

## Docker

```sh
docker compose up --build -d
```

Abrir http://localhost:3000. Compose conserva SQLite en un volumen. La imagen ejecuta Node 24 como usuario sin privilegios e incorpora un healthcheck. Para cloud sin disco persistente, conectar Turso.

## Comprobaciones

```sh
npm run check
npm run test:networks
npm run build
npm run test:integration
```

Las pruebas de red simulan respuestas de wallet para verificar redes existentes, ausentes, cancelación y chain ID incorrecto. La integración usa cuentas efímeras sin fondos, SQLite aislado en `work/`, un RPC controlado y un indexador controlado. Verifica autenticación, historial por red, cupos, validación de pagos y avance de turnos. No sustituye las autorizaciones y transferencias que debe realizar el usuario con MetaMask en una red pública.

El workflow `.github/workflows/validate.yml` ejecuta los checks, pruebas, build y construcción/arranque real de la imagen Docker en GitHub Actions.

Ver `CRITERIOS.md` para el estado y las evidencias de la rúbrica.
