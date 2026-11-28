# Entrega 146 · Sublichat HQ (Vercel) · Gestión comercial igual a los visuales

Acumulativa: incluye todo lo de la Entrega 145 + el rediseño. Si ya subió la 145, igual suba todo (reemplaza).

Qué cambia
- Panel: encabezado con megáfono y Sublirobot, meta en rosado, tarjetas amarillo/celeste/lila, y dos tarjetas
  «Agenda comercial de hoy» (checklist por hora) y «Rendimiento» (contactos, recuperados, ventas) que abren su pantalla.
- Vencidos: chips Todos / Hoy / +3 / +15 días, resumen con robot, tarjeta por cliente (iniciales, teléfono, atendido por,
  «N días vencido», servicios con precio en L, «Última renovación/contratación», WhatsApp y Registrar).
  Pie fijo «Pendientes hoy N» + «Iniciar seguimiento» (abre el primer cliente libre que toca hoy).
- Por fidelizar / Potenciales: tarjetas con Compras, 1.ª compra, Atendido por, Responsable, Seguimiento y Último contacto.
- Filtros extra (+30 días, Programados, Mis clientes, Sin asignar, Cerrados, No contactar, Último resultado y Excel) en «Más filtros y Excel».
- Biblioteca: Generador (categoría, plantilla, nombre, servicio, precio {{precio}} en L, burbuja editable,
  Copiar / Enviar por WhatsApp sin cliente), Historial reciente (Usado / Respondió / Venta concretada) y todas las plantillas.
- En computadora se mantiene la tabla detallada; en celular salen las tarjetas.
- Servidor: la lista trae la última venta; «plantillas» trae el historial de los últimos 30 días. Sin escrituras nuevas.

Archivos: los de esta carpeta, misma ruta en el repo. Sin variables de entorno nuevas.
Pruebas: r209 18/18; suite completa sin fallas nuevas.
Respaldo/rollback: Vercel → Deployments → Promote del deploy anterior.
