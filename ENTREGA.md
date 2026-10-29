# Entrega y presentación de JuntaChain

## Implementación entregada

Aplicación SvelteKit con cuatro secciones: Inicio, Mis juntas, Wallet y Perfil. Datos persistidos en SQLite, sesión verificada mediante firma de wallet, invitaciones por QR/enlace, turnos de cobro y aportes entre direcciones verificados por RPC. Historial externo por red integrado y exportable a CSV.

## Verificación realizada

- Svelte/TypeScript: 0 errores y 0 advertencias.
- Build de producción con adaptador Node: correcto.
- 32 comprobaciones de integración correctas. Incluyen sesión firmada, prevención de replay, permisos, validaciones, cupos, persistencia tras reiniciar y cierre de sesión.
- Se probó el registro de pagos, rechazo de montos/destinatarios incorrectos y recibos fallidos, avance de ronda y finalización de junta con respuestas RPC controladas en las pruebas. Estas pruebas no sustituyen una transferencia pública con MetaMask.
- Endpoints públicos de historial Blockscout: respuesta HTTP 200 en Sepolia y Hoodi.
- Revisión visual de inicio y creación de junta en navegador.
- Docker no pudo ejecutarse: el motor de Docker Desktop está detenido.
- No se han enviado fondos, desplegado contratos ni publicado una URL cloud.

## Guion para presentar

1. Abrir la aplicación y explicar la junta: cada persona aporta a quien tiene el turno; todos reciben una vez.
2. Conectar MetaMask y firmar el acceso. Mostrar el perfil y guardar un nombre.
3. Crear una junta con 2 miembros y cuota pequeña en ETH de testnet.
4. Abrir el QR/enlace desde un segundo navegador con otra wallet y aceptar participar.
5. Mostrar los cupos completos, el beneficiario y los turnos.
6. Desde el segundo participante, pagar la cuota. Verificar monto, destinatario y red antes de autorizar en MetaMask.
7. Mostrar el comprobante y el avance al siguiente turno. Hacer el aporte de vuelta para finalizar la junta si hay tiempo.
8. Mostrar el historial integrado, el enlace al explorador y la exportación CSV.
9. Cambiar de red y mostrar que el saldo/historial corresponden a la red elegida.
10. Recargar: perfil, junta y comprobantes permanecen.
11. Mostrar Docker y la URL HTTPS cuando estén desplegados.

Usar dos cuentas propias con fondos de testnet disponibles. El QR de una URL localhost no abre la computadora desde un celular: para compartir entre dispositivos, desplegar primero con HTTPS o configurar un acceso de red alcanzable.

## Explicación técnica breve

- Frontend: Svelte 5 y SvelteKit.
- Identidad: firma EIP-191 de un desafío con nonce; cookie HttpOnly.
- Operaciones: viem y proveedor EIP-1193 de MetaMask.
- Persistencia: SQLite con WAL y comprobantes únicos.
- Verificación: RPC de la red seleccionada y recibo exitoso.
- Historial: Blockscout público o Etherscan V2 configurado en servidor.
- Distribución: transferencias directas a cada beneficiario; la app no custodia fondos.
- Despliegue: imagen Node 24 con Docker y volumen persistente.

## Pendientes externos para cerrar la entrega

- Validación de principio a fin con MetaMask y dos cuentas con saldo de prueba.
- Iniciar Docker Desktop y ejecutar `docker compose up --build -d`.
- Publicar en un host Docker con HTTPS, ORIGIN configurado y volumen persistente.
- Guardar capturas propias del contenedor, la transacción y el explorador para la evaluación.
