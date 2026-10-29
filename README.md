# JuntaChain

Aplicación de ahorro comunitario en Svelte 5 y SvelteKit. Permite crear juntas persistentes, invitar participantes y registrar aportes entre wallets verificados en blockchain. Interfaz responsive en español, sin saldos, perfiles ni transacciones precargados.

## Ejecutar

Requiere Node.js 24 y npm.

```sh
npm ci
npm run dev
```

Abre la URL que imprime Vite. En un navegador con MetaMask, conecta la cuenta y firma el inicio de sesión. La firma de acceso no envía dinero. Los envíos requieren una autorización independiente en la wallet.

## Flujo del producto

1. Conecta y verifica tu wallet. Opcionalmente guarda tu nombre en Perfil.
2. Crea una junta: nombre, cuota en ETH, 2–20 participantes y plazo de 7, 15 o 30 días por ronda.
3. Comparte su enlace o QR. Los invitados conectan su propia wallet y aceptan participar.
4. Al completar los cupos se habilita la primera ronda. El orden de inscripción define el orden de cobro y queda fijado.
5. Cada participante, excepto el beneficiario, envía la cuota directamente a la wallet del beneficiario. El beneficiario no se transfiere a sí mismo: recibe `(participantes - 1) × cuota`.
6. El servidor verifica red, recibo exitoso, origen, destinatario, monto, fecha y ausencia de un hash reutilizado. Solo entonces registra el aporte.
7. La ronda avanza al completar los aportes y termina al recibir todos los miembros su turno.
8. Si se cierra la página después del envío, el aportante puede registrar el hash desde la junta. No se vuelve a enviar dinero.

## Blockchain y datos

- Redes: Sepolia y Hoodi. Moneda: ETH de testnet; no se convierten soles ni USDC.
- Historial de hasta 30 transacciones obtenido del indexador de la red, con enlaces al explorador y exportación CSV. No usa localStorage.
- Blockscout público por defecto; alternativa Etherscan V2 mediante `ETHERSCAN_API_KEY`. Si el indexador falla, se informa el error y se conserva el acceso al explorador.
- Perfil, sesiones, juntas, participantes y aportes en SQLite. La base se crea al iniciar la API.
- Acceso mediante desafío de un solo uso, firma EIP-191 y cookie HttpOnly. Sesiones de 24 horas. Los miembros de otras juntas no pueden registrar aportes ajenos.
- Los comprobantes son verificables en la red; las reglas de turnos y el registro de juntas se administran en el servidor. No hay contrato de custodia, garantía de cumplimiento, penalidades automáticas ni score crediticio.
- El plazo es la fecha objetivo de cada ronda. No se bloquean aportes tardíos ni se cobran multas.

## Configuración

Copia `.env.example` a `.env` si necesitas personalizar proveedores.

| Variable | Uso |
| --- | --- |
| `DATABASE_PATH` | Ruta SQLite; predeterminado `data/juntachain.sqlite` |
| `ETHERSCAN_API_KEY` | Opcional: API V2 como alternativa a Blockscout |
| `SEPOLIA_RPC_URL` | Opcional: RPC dedicado para verificar aportes |
| `HOODI_RPC_URL` | Opcional: RPC dedicado para verificar aportes |
| `ORIGIN` | URL pública HTTPS del despliegue Node |

Nunca subas `.env`, la base de usuarios ni credenciales al repositorio. Respaldar el archivo SQLite y sus archivos WAL/SHM mediante un procedimiento compatible con SQLite. No copiar la base mientras hay escrituras sin un backup consistente.

## Docker y cloud

```sh
docker compose up --build -d
```

Abre `http://localhost:3000`. Compose conserva la base en el volumen `juntachain-data`. Para cloud, configura `ORIGIN=https://tu-dominio`, un volumen persistente montado en `/app/data` y HTTPS mediante el proveedor o proxy inverso. El proceso escucha en `0.0.0.0:3000`.

Este proyecto requiere un servidor Node con disco persistente; no es un export estático. Una sola instancia sirve para la entrega académica. Varias réplicas requieren migrar la persistencia a una base compartida.

## Verificación

```sh
npm run check
npm run build
npm run test:integration
```

Las pruebas levantan el build en el puerto 4181, crean identidades efímeras sin fondos y usan una base aislada dentro de `work/`. Comprueban firmas, protección de acceso, inscripción, cupos, validación de comprobantes, logout y persistencia tras reiniciar. No envían transacciones ni prueban MetaMask.

## Evidencias para los 20 puntos

| Criterio | Evidencia que presentar |
| --- | --- |
| Docker + cloud (3) | Contenedor en ejecución y URL HTTPS del despliegue |
| Login wallet (3) | Conexión de MetaMask, firma y perfil de cuenta |
| Cambio de red (3) | Cambiar Sepolia/Hoodi y aceptar añadir una red si falta |
| Historial por red (4) | Mostrar operaciones consultadas, cambiar red y recargar |
| Transacción address a address (4) | Transferencia entre dos cuentas con fondos de testnet |
| URL al explorador (3) | Comprobante enlazado al explorador de la red correcta |

## Estado de validación

Los checks, compilación y pruebas automatizadas se documentan en `ENTREGA.md`. La validación de una transferencia real requiere dos wallets, fondos de testnet y autorización humana. Docker Desktop debe tener el motor iniciado para probar el contenedor. No se ha publicado una URL cloud ni desplegado un contrato.

## Acceso

La pantalla inicial permite conectar MetaMask y firmar el acceso. El panel aparece al verificar la sesión. Cerrar sesión o cambiar a una cuenta sin verificar devuelve a la pantalla de acceso; las invitaciones recibidas se conservan al iniciar sesión.
