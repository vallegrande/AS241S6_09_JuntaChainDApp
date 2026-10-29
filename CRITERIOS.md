# Verificación de los criterios · JuntaChain

| Criterio | Puntos | Implementación | Evidencia para la presentación |
| --- | ---: | --- | --- |
| DApp con Docker en cloud | 3 | Dockerfile, Compose, healthcheck, configuración Render y pipeline Docker | URL pública, runtime Docker y logs del deploy correcto en Render |
| Login PaliWallet y/o MetaMask | 3 | Conexión EIP-1193, desafío de un solo uso, firma y sesión HttpOnly con MetaMask | Conectar, firmar y entrar al panel con una wallet real |
| Cambio de red y adición automática | 3 | Sepolia, Hoodi y zkSYS Genesis; switch, add en error 4902 y comprobación final de chain ID | Elegir una red ausente y aprobar añadirla en la wallet |
| Historial según red, sin localStorage | 4 | Consultas del servidor a los indexadores por cuenta/chain ID; CSV y estado de errores | Ver operaciones, cambiar de red y recargar |
| Transferencia address a address | 4 | Envío de moneda nativa de la red y espera de recibo | Transferir una cantidad pequeña entre dos cuentas con fondos de testnet |
| URL al explorador después de transferir | 3 | Hash y enlace asociados a la red original del envío | Abrir la transacción confirmada en el explorador correcto |

## Límites de la verificación

La implementación y las pruebas automatizadas no equivalen a una nota de 20/20. El docente debe poder observar el flujo de wallet, la transacción pública y el despliegue Docker. Las pruebas de pagos automatizadas utilizan RPCs controlados y no envían fondos reales ni tokens de testnet.

La URL informada por el usuario, https://as241s6-09-juntachaindapp.onrender.com/, responde HTTP 200. Antes de actualizarla todavía no incluye las redes y el healthcheck nuevos. Para publicar estos cambios hay que subir el código a la rama conectada y comprobar que Render termine el despliegue.

Turso está soportado por el código, pero la conexión cloud no se puede verificar sin configurar sus secretos en Render. Mientras no se configure, las juntas locales en Render Free son temporales. Esto no convierte el historial de blockchain en localStorage: el historial siempre se consulta a su indexador.

## Guion de evidencia

1. Mostrar el servicio Live en Render con runtime Docker y su URL HTTPS.
2. Conectar MetaMask y firmar el acceso, sin enviar dinero.
3. Elegir Sepolia, Hoodi y zkSYS; mostrar la solicitud de adición de una que no estuviera en MetaMask.
4. Mostrar el historial de la cuenta en cada red. Si una cuenta no tiene actividad, hacer la transferencia en la red elegida y esperar su indexación.
5. Enviar fondos de testnet a una segunda cuenta y abrir el comprobante en el explorador.
6. Recargar y volver a consultar las operaciones desde blockchain.
7. Mostrar el workflow de GitHub Actions y los logs Docker/Render como evidencia técnica complementaria.

zkSYS Genesis actual: chain ID 57057, RPC https://rpc-zk.tanenbaum.io, moneda SYS, explorador https://explorer-zk.tanenbaum.io. No confundir con la testnet antigua 5701.
