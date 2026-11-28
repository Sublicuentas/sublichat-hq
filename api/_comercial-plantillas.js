// api/_comercial-plantillas.js · R209 — Biblioteca ORIGINAL de 120 plantillas comerciales (paquete del 27/11/2026).
// Copia fiel del JSON aprobado; se importa a Firestore (gc_plantillas) por ID, sin duplicar ni pisar ediciones locales.
export const BIBLIOTECA = Object.freeze({
 "version": "1.0",
 "modulo": "Gestión Comercial",
 "marca": "Sublicuentas",
 "idioma": "es-HN",
 "cantidad": 120,
 "categorias": {
  "vencidos": "Clientes vencidos",
  "fidelizar": "Clientes por fidelizar",
  "potenciales": "Clientes potenciales"
 },
 "horarios_locales": {
  "vencidos": "12:00",
  "fidelizar": "14:00",
  "potenciales": "16:00"
 },
 "zona_horaria": "America/Tegucigalpa",
 "variables": {
  "saludo": {
   "con_nombre": "¡Hola, {nombre}! 👋",
   "sin_nombre": "¡Hola! 👋",
   "nota": "Usar primer nombre verificado; si falta o es dudoso, omitirlo."
  },
  "servicio": {
   "origen": "Nombre comercial del servicio vinculado al seguimiento o cotización",
   "nota": "Si no hay nombre de servicio verificable, usar únicamente una plantilla que no requiera servicio o completar el dato manualmente."
  }
 },
 "reglas": [
  "Solo seleccionar mensajes de categoría y situación compatibles con el registro.",
  "Mostrar vista previa editable; no enviar automáticamente.",
  "No enviar con variables sin resolver.",
  "Contactar únicamente a personas con permiso o expectativa válida de contacto; respetar bajas y bloqueos.",
  "Horarios son ventanas de trabajo, no autorizan mensajes diarios al mismo destinatario.",
  "Si existe seguimiento en Cobros o Recordatorios, evitar duplicar el contacto; la fecha expresamente acordada tiene prioridad.",
  "Si el cliente está en dos categorías, una única ficha y agenda compartida; registrar un solo contacto.",
  "No reenviar por falta de respuesta sin revisar intervalo, historial y preferencia del cliente.",
  "No afirmar entrega, lectura o respuesta si no se ha verificado.",
  "Confirmar precio, disponibilidad y condiciones antes de comunicar una oferta concreta.",
  "No usar cierre_respetuoso si el cliente ya solicitó no recibir mensajes; bloquear el envío.",
  "No marcar una compra como concretada sin transacción verificada."
 ],
 "plantillas": [
  {
   "id": "GC-VENCIDOS-001",
   "categoria": "vencidos",
   "situacion": "consulta_experiencia",
   "situacion_label": "Experiencia anterior",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎬 Queremos conocer su experiencia con {{servicio}}. ¿Todo funcionó correctamente o hubo algo que podamos mejorar?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-002",
   "categoria": "vencidos",
   "situacion": "consulta_experiencia",
   "situacion_label": "Experiencia anterior",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📺 Vimos que su acceso a {{servicio}} ha vencido. ¿Cómo le fue con la plataforma durante el período contratado?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-003",
   "categoria": "vencidos",
   "situacion": "consulta_experiencia",
   "situacion_label": "Experiencia anterior",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Nos interesa saber cómo fue su experiencia con {{servicio}}. ¿El servicio cumplió con sus expectativas?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-004",
   "categoria": "vencidos",
   "situacion": "consulta_experiencia",
   "situacion_label": "Experiencia anterior",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Su opinión nos ayuda a mejorar. ¿Tuvo alguna dificultad al utilizar {{servicio}} o simplemente decidió hacer una pausa?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-005",
   "categoria": "vencidos",
   "situacion": "consulta_experiencia",
   "situacion_label": "Experiencia anterior",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Nos gustaría saber si disfrutó de {{servicio}}. ¿Hay algo que podamos hacer para mejorar su próxima experiencia?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-006",
   "categoria": "vencidos",
   "situacion": "motivo_no_renovacion",
   "situacion_label": "Motivo de no continuidad",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📋 Notamos que no ha continuado con {{servicio}}. ¿Nos podría indicar si fue por presupuesto, tiempo o alguna dificultad con el servicio?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-007",
   "categoria": "vencidos",
   "situacion": "motivo_no_renovacion",
   "situacion_label": "Motivo de no continuidad",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Queremos entender mejor sus necesidades. ¿Hay algún motivo por el que decidió no continuar con {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-008",
   "categoria": "vencidos",
   "situacion": "motivo_no_renovacion",
   "situacion_label": "Motivo de no continuidad",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Si decidió hacer una pausa en {{servicio}}, nos gustaría saber si podemos ayudarle en algo.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-009",
   "categoria": "vencidos",
   "situacion": "motivo_no_renovacion",
   "situacion_label": "Motivo de no continuidad",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 ¿Cambió alguna de sus necesidades de entretenimiento desde que contrató {{servicio}}? Podemos orientarle según lo que esté buscando.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-010",
   "categoria": "vencidos",
   "situacion": "motivo_no_renovacion",
   "situacion_label": "Motivo de no continuidad",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔎 Nos interesa conocer su opinión sobre {{servicio}}. ¿Qué aspecto influyó más en su decisión de no continuar?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-011",
   "categoria": "vencidos",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💙 Entendemos que los gastos pueden cambiar de un mes a otro. Si desea retomar {{servicio}}, podemos consultar las opciones disponibles para su presupuesto.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-012",
   "categoria": "vencidos",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📅 Si ahora no es el momento adecuado para contratar {{servicio}}, ¿prefiere que le contactemos en otra fecha?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-013",
   "categoria": "vencidos",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Sabemos que cada persona organiza sus gastos de manera diferente. ¿Le gustaría revisar otras opciones antes de retomar {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-014",
   "categoria": "vencidos",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Si necesita ajustar su presupuesto de entretenimiento, podemos ayudarle a comparar las opciones disponibles, sin compromiso.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-015",
   "categoria": "vencidos",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 ¿Le sería útil que le compartiéramos las alternativas disponibles a {{servicio}} y sus precios actuales?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-016",
   "categoria": "vencidos",
   "situacion": "problema_servicio",
   "situacion_label": "Dificultad comunicada con el servicio",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🛠️ Si tuvo alguna dificultad con {{servicio}}, nos gustaría conocerla para revisar qué solución podemos ofrecerle.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-017",
   "categoria": "vencidos",
   "situacion": "problema_servicio",
   "situacion_label": "Dificultad comunicada con el servicio",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔍 ¿Encontró algún inconveniente al ingresar o utilizar {{servicio}}? Podemos revisar su caso antes de que decida volver a contratar.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-018",
   "categoria": "vencidos",
   "situacion": "problema_servicio",
   "situacion_label": "Dificultad comunicada con el servicio",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Queremos que su experiencia sea satisfactoria. Si {{servicio}} no funcionó como esperaba, cuéntenos qué ocurrió.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-019",
   "categoria": "vencidos",
   "situacion": "problema_servicio",
   "situacion_label": "Dificultad comunicada con el servicio",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Su experiencia es importante para nosotros. ¿Quedó alguna consulta o problema de {{servicio}} sin resolver?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-020",
   "categoria": "vencidos",
   "situacion": "problema_servicio",
   "situacion_label": "Dificultad comunicada con el servicio",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📲 Si necesita orientación sobre el acceso o la compatibilidad de {{servicio}}, estamos disponibles para ayudarle.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-021",
   "categoria": "vencidos",
   "situacion": "reactivacion",
   "situacion_label": "Interés en volver",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🍿 ¿Le gustaría volver a disfrutar de {{servicio}}? Podemos informarle sobre la disponibilidad y condiciones actuales.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-022",
   "categoria": "vencidos",
   "situacion": "reactivacion",
   "situacion_label": "Interés en volver",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎬 Si está pensando en retomar su entretenimiento, podemos ayudarle a consultar las opciones de {{servicio}}.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-023",
   "categoria": "vencidos",
   "situacion": "reactivacion",
   "situacion_label": "Interés en volver",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Nos gustaría volver a atenderle. ¿Desea que revisemos la disponibilidad actual de {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-024",
   "categoria": "vencidos",
   "situacion": "reactivacion",
   "situacion_label": "Interés en volver",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📺 ¿Tiene alguna serie, película o contenido que quiera retomar? Podemos orientarle sobre las opciones de suscripción disponibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-025",
   "categoria": "vencidos",
   "situacion": "reactivacion",
   "situacion_label": "Interés en volver",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🙌 Si desea regresar a Sublicuentas, será un gusto atenderle nuevamente. ¿Le interesa retomar {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-026",
   "categoria": "vencidos",
   "situacion": "alternativas",
   "situacion_label": "Busca otras opciones",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎯 Si busca algo diferente a {{servicio}}, podemos recomendarle opciones según sus preferencias y presupuesto.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-027",
   "categoria": "vencidos",
   "situacion": "alternativas",
   "situacion_label": "Busca otras opciones",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 ¿Está buscando entretenimiento, música o herramientas digitales? Podemos mostrarle alternativas que se adapten a sus necesidades.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-028",
   "categoria": "vencidos",
   "situacion": "alternativas",
   "situacion_label": "Busca otras opciones",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🍿 Si su plataforma anterior ya no es lo que busca, podemos ayudarle a explorar otras opciones de nuestro catálogo.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-029",
   "categoria": "vencidos",
   "situacion": "alternativas",
   "situacion_label": "Busca otras opciones",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💡 ¿Prefiere una alternativa a {{servicio}}? Cuéntenos qué tipo de contenido o funciones necesita y le orientamos.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-030",
   "categoria": "vencidos",
   "situacion": "alternativas",
   "situacion_label": "Busca otras opciones",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔎 Podemos comparar los planes disponibles para ayudarle a elegir una opción adecuada. ¿Le gustaría recibir información?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-031",
   "categoria": "vencidos",
   "situacion": "seguimiento_acordado",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📅 Tal como acordamos, le escribimos para retomar nuestra conversación sobre {{servicio}}. ¿Desea continuar o prefiere otra fecha?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-032",
   "categoria": "vencidos",
   "situacion": "seguimiento_acordado",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Le contactamos en la fecha que nos indicó para consultar si sigue interesado en retomar {{servicio}}.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-033",
   "categoria": "vencidos",
   "situacion": "seguimiento_acordado",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Retomamos la conversación que dejamos pendiente. ¿Le gustaría revisar las opciones actuales de {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-034",
   "categoria": "vencidos",
   "situacion": "seguimiento_acordado",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📲 Como habíamos conversado, hoy podemos ayudarle a resolver cualquier consulta sobre {{servicio}}. ¿Le viene bien?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-035",
   "categoria": "vencidos",
   "situacion": "seguimiento_acordado",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🗓️ Le escribimos según el seguimiento acordado. Si sus planes cambiaron, puede indicárnoslo sin compromiso.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-036",
   "categoria": "vencidos",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Si por ahora no desea continuar con {{servicio}}, lo comprendemos. ¿Prefiere que dejemos de contactarle sobre este tema?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-037",
   "categoria": "vencidos",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💙 Gracias por habernos elegido anteriormente. Si necesita ayuda en el futuro, puede escribirnos cuando lo desee.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-038",
   "categoria": "vencidos",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 No queremos interrumpirle. ¿Prefiere que cerremos este seguimiento de {{servicio}} por el momento?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-VENCIDOS-039",
   "categoria": "vencidos",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Quedamos disponibles si decide retomar su entretenimiento. Gracias por el tiempo que compartió con Sublicuentas.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-VENCIDOS-040",
   "categoria": "vencidos",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 Si ya no está interesado en {{servicio}}, puede indicárnoslo y respetaremos su decisión.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-001",
   "categoria": "fidelizar",
   "situacion": "experiencia_primera_compra",
   "situacion_label": "Experiencia de primera compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Gracias por haber realizado su primera compra con nosotros. ¿Cómo fue su experiencia con {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-002",
   "categoria": "fidelizar",
   "situacion": "experiencia_primera_compra",
   "situacion_label": "Experiencia de primera compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Queremos conocer su opinión después de su primera contratación de {{servicio}}. ¿Recibió la atención que esperaba?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-003",
   "categoria": "fidelizar",
   "situacion": "experiencia_primera_compra",
   "situacion_label": "Experiencia de primera compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Nos gustaría saber cómo le fue con {{servicio}}. Su experiencia nos ayuda a mejorar la atención que ofrecemos.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-004",
   "categoria": "fidelizar",
   "situacion": "experiencia_primera_compra",
   "situacion_label": "Experiencia de primera compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 ¿Le resultó sencillo utilizar {{servicio}} después de su primera compra? Si necesita orientación, estamos disponibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-005",
   "categoria": "fidelizar",
   "situacion": "experiencia_primera_compra",
   "situacion_label": "Experiencia de primera compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🙌 Gracias por darnos la oportunidad de atenderle. ¿Qué podríamos mejorar para su próxima contratación?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-006",
   "categoria": "fidelizar",
   "situacion": "segunda_compra",
   "situacion_label": "Oportunidad de segunda compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎬 ¿Le gustaría realizar una nueva contratación con Sublicuentas? Podemos ayudarle a encontrar una opción acorde a lo que necesita.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-007",
   "categoria": "fidelizar",
   "situacion": "segunda_compra",
   "situacion_label": "Oportunidad de segunda compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📺 Después de su primera experiencia con {{servicio}}, ¿hay alguna otra plataforma que le interese conocer?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-008",
   "categoria": "fidelizar",
   "situacion": "segunda_compra",
   "situacion_label": "Oportunidad de segunda compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Nos gustaría volver a atenderle. ¿Desea consultar las opciones actuales de {{servicio}} u otro servicio?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-009",
   "categoria": "fidelizar",
   "situacion": "segunda_compra",
   "situacion_label": "Oportunidad de segunda compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🍿 Si está buscando algo nuevo para disfrutar, podemos recomendarle opciones disponibles según sus gustos.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-010",
   "categoria": "fidelizar",
   "situacion": "segunda_compra",
   "situacion_label": "Oportunidad de segunda compra",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ ¿Tiene pensado contratar alguna suscripción próximamente? Podemos orientarle para que elija la más adecuada.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-011",
   "categoria": "fidelizar",
   "situacion": "preferencias",
   "situacion_label": "Conocer preferencias",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎯 Nos gustaría ofrecerle opciones que realmente le interesen. ¿Qué tipo de entretenimiento o herramientas digitales utiliza más?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-012",
   "categoria": "fidelizar",
   "situacion": "preferencias",
   "situacion_label": "Conocer preferencias",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎧 ¿Prefiere música, películas, series o herramientas para el trabajo? Podemos ayudarle a explorar nuestro catálogo.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-013",
   "categoria": "fidelizar",
   "situacion": "preferencias",
   "situacion_label": "Conocer preferencias",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💡 Queremos conocer mejor lo que busca. ¿Qué fue lo que más le interesó cuando contrató {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-014",
   "categoria": "fidelizar",
   "situacion": "preferencias",
   "situacion_label": "Conocer preferencias",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 ¿Qué dispositivo utiliza normalmente para disfrutar de sus suscripciones? Podemos orientarle sobre opciones compatibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-015",
   "categoria": "fidelizar",
   "situacion": "preferencias",
   "situacion_label": "Conocer preferencias",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔎 ¿Busca una plataforma para usted o para compartir con su familia dentro de las condiciones del servicio? Podemos explicarle las alternativas.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-016",
   "categoria": "fidelizar",
   "situacion": "venta_complementaria",
   "situacion_label": "Interés en otros servicios",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🍿 Si disfrutó de {{servicio}}, ¿le gustaría conocer otras plataformas que complementen su entretenimiento?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-017",
   "categoria": "fidelizar",
   "situacion": "venta_complementaria",
   "situacion_label": "Interés en otros servicios",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎧 Además de su contratación anterior, tenemos opciones de música y herramientas digitales. ¿Alguna categoría le interesa?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-018",
   "categoria": "fidelizar",
   "situacion": "venta_complementaria",
   "situacion_label": "Interés en otros servicios",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💻 Si también utiliza suscripciones para estudiar o trabajar, podemos mostrarle las herramientas disponibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-019",
   "categoria": "fidelizar",
   "situacion": "venta_complementaria",
   "situacion_label": "Interés en otros servicios",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📺 ¿Le interesa combinar diferentes servicios? Podemos revisar opciones y sus precios sin compromiso.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-020",
   "categoria": "fidelizar",
   "situacion": "venta_complementaria",
   "situacion_label": "Interés en otros servicios",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎯 Si necesita más de una plataforma, le ayudamos a comparar las alternativas para que elija solamente lo que realmente utilizará.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-021",
   "categoria": "fidelizar",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💙 Si está organizando sus gastos, podemos ayudarle a revisar opciones de suscripción acordes a su presupuesto.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-022",
   "categoria": "fidelizar",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📋 ¿Le gustaría recibir una comparación de precios actuales antes de decidir su próxima contratación?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-023",
   "categoria": "fidelizar",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 No necesita contratar varios servicios para seguir con nosotros. Podemos orientarle sobre una opción que se ajuste a lo que busca.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-024",
   "categoria": "fidelizar",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📅 ¿Tiene alguna fecha en mente para su próxima compra? Podemos acordar un seguimiento cuando le resulte conveniente.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-025",
   "categoria": "fidelizar",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Si el precio influyó en que no volviera a contratar, nos gustaría conocer su presupuesto para orientarle mejor.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-026",
   "categoria": "fidelizar",
   "situacion": "confianza_atencion",
   "situacion_label": "Atención y confianza",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🛠️ Si le quedó alguna duda después de su primera compra de {{servicio}}, estamos disponibles para aclararla.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-FIDELIZAR-027",
   "categoria": "fidelizar",
   "situacion": "confianza_atencion",
   "situacion_label": "Atención y confianza",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Queremos que vuelva a elegirnos por la atención que recibe. ¿Hay algo de su experiencia anterior que podamos mejorar?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-028",
   "categoria": "fidelizar",
   "situacion": "confianza_atencion",
   "situacion_label": "Atención y confianza",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📲 Si necesita conocer las condiciones o el proceso de contratación antes de volver a comprar, podemos explicárselo.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-029",
   "categoria": "fidelizar",
   "situacion": "confianza_atencion",
   "situacion_label": "Atención y confianza",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 ¿Cómo le pareció nuestra atención durante su primera contratación? Agradecemos cualquier sugerencia que desee compartir.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-030",
   "categoria": "fidelizar",
   "situacion": "confianza_atencion",
   "situacion_label": "Atención y confianza",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Nos interesa construir una relación de confianza. Si tiene dudas sobre otro servicio, puede consultarnos sin compromiso.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-031",
   "categoria": "fidelizar",
   "situacion": "catalogo_novedades",
   "situacion_label": "Catálogo y novedades",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🛍️ Le invitamos a explorar nuestro catálogo actualizado en https://sublicuentas.com. Si algo le interesa, podemos ayudarle a revisar los detalles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-032",
   "categoria": "fidelizar",
   "situacion": "catalogo_novedades",
   "situacion_label": "Catálogo y novedades",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎬 ¿Le gustaría conocer qué opciones de entretenimiento tenemos disponibles actualmente? Podemos enviarle información según sus gustos.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-033",
   "categoria": "fidelizar",
   "situacion": "catalogo_novedades",
   "situacion_label": "Catálogo y novedades",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💡 Si está buscando una herramienta digital nueva, podemos mostrarle las opciones de nuestro catálogo y explicar sus condiciones.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-034",
   "categoria": "fidelizar",
   "situacion": "catalogo_novedades",
   "situacion_label": "Catálogo y novedades",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 Puede consultar nuestro catálogo en https://sublicuentas.com cuando le resulte conveniente. Estamos disponibles para atender sus consultas.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-035",
   "categoria": "fidelizar",
   "situacion": "catalogo_novedades",
   "situacion_label": "Catálogo y novedades",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔎 ¿Quiere comparar servicios antes de decidir? Podemos compartirle información actualizada de las opciones que le interesen.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-036",
   "categoria": "fidelizar",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Gracias por haber confiado en Sublicuentas en su primera compra. Si necesita otra suscripción, estaremos disponibles para atenderle.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-037",
   "categoria": "fidelizar",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💙 Si actualmente no necesita contratar otro servicio, lo comprendemos. ¿Prefiere que no le enviemos más mensajes comerciales?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-038",
   "categoria": "fidelizar",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 ¿Prefiere dejar su próxima contratación para otro momento? Podemos cerrar este seguimiento y usted nos escribe cuando lo necesite.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-039",
   "categoria": "fidelizar",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Agradecemos que nos haya elegido anteriormente. No necesita responder si por ahora no está buscando otra suscripción.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-FIDELIZAR-040",
   "categoria": "fidelizar",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 Si prefiere no recibir futuras recomendaciones comerciales, puede indicárnoslo. Respetaremos su decisión.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-POTENCIALES-001",
   "categoria": "potenciales",
   "situacion": "cotizacion",
   "situacion_label": "Consulta o cotización previa",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Hace poco nos consultó sobre {{servicio}}. ¿Sigue interesado en contratarlo o necesita aclarar alguna duda?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-002",
   "categoria": "potenciales",
   "situacion": "cotizacion",
   "situacion_label": "Consulta o cotización previa",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📋 Retomamos su consulta sobre {{servicio}}. ¿Desea que revisemos la cotización y las condiciones actuales?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-003",
   "categoria": "potenciales",
   "situacion": "cotizacion",
   "situacion_label": "Consulta o cotización previa",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Gracias por considerar a Sublicuentas. ¿Podemos ayudarle con algún detalle de la cotización de {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-004",
   "categoria": "potenciales",
   "situacion": "cotizacion",
   "situacion_label": "Consulta o cotización previa",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 ¿Tuvo oportunidad de revisar la información que le compartimos sobre {{servicio}}? Podemos aclararle cualquier consulta.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-005",
   "categoria": "potenciales",
   "situacion": "cotizacion",
   "situacion_label": "Consulta o cotización previa",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Nos gustaría saber si la opción de {{servicio}} que cotizó se adapta a lo que está buscando.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-006",
   "categoria": "potenciales",
   "situacion": "datos_pago_solicitados",
   "situacion_label": "Solicitó datos de pago",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💳 Anteriormente solicitó los datos de pago para contratar {{servicio}}. ¿Necesita que le expliquemos algún paso para completar la compra?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-007",
   "categoria": "potenciales",
   "situacion": "datos_pago_solicitados",
   "situacion_label": "Solicitó datos de pago",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📲 Si continúa interesado en {{servicio}}, podemos confirmar la disponibilidad y los datos de pago antes de que realice la transferencia.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-008",
   "categoria": "potenciales",
   "situacion": "datos_pago_solicitados",
   "situacion_label": "Solicitó datos de pago",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 ¿Le quedó alguna duda sobre el proceso de pago de {{servicio}}? Podemos orientarle antes de que tome una decisión.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-009",
   "categoria": "potenciales",
   "situacion": "datos_pago_solicitados",
   "situacion_label": "Solicitó datos de pago",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📋 Su consulta de {{servicio}} quedó pendiente de confirmación. ¿Desea que revisemos nuevamente los datos de contratación?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-010",
   "categoria": "potenciales",
   "situacion": "datos_pago_solicitados",
   "situacion_label": "Solicitó datos de pago",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Si decidió continuar con {{servicio}}, estamos disponibles para confirmar el procedimiento de compra y resolver sus preguntas.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-011",
   "categoria": "potenciales",
   "situacion": "fecha_acordada",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📅 Le escribimos en la fecha que acordamos para retomar su cotización de {{servicio}}. ¿Sigue interesado?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-012",
   "categoria": "potenciales",
   "situacion": "fecha_acordada",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Según nuestra conversación, hoy tenía previsto revisar la compra de {{servicio}}. ¿Desea que continuemos?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-013",
   "categoria": "potenciales",
   "situacion": "fecha_acordada",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🗓️ Retomamos su consulta de {{servicio}} tal como habíamos acordado. Si necesita más tiempo, puede indicárnoslo.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-014",
   "categoria": "potenciales",
   "situacion": "fecha_acordada",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 Como nos indicó que prefería conversar hoy, le consultamos si desea continuar con la contratación de {{servicio}}.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-015",
   "categoria": "potenciales",
   "situacion": "fecha_acordada",
   "situacion_label": "Fecha de contacto expresamente acordada",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 Le contactamos conforme a lo conversado. ¿Le gustaría confirmar las condiciones actuales de {{servicio}} o dejarlo para otra fecha?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-016",
   "categoria": "potenciales",
   "situacion": "dudas_producto",
   "situacion_label": "Dudas sobre el producto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔎 ¿Tiene alguna duda sobre los beneficios o las condiciones de {{servicio}}? Podemos explicarle los detalles antes de contratar.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-017",
   "categoria": "potenciales",
   "situacion": "dudas_producto",
   "situacion_label": "Dudas sobre el producto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 Si necesita confirmar que {{servicio}} funciona en su dispositivo, díganos qué equipo utiliza y revisaremos la compatibilidad.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-018",
   "categoria": "potenciales",
   "situacion": "dudas_producto",
   "situacion_label": "Dudas sobre el producto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💡 ¿Le gustaría conocer mejor las características de {{servicio}} antes de decidir? Estamos disponibles para orientarle.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-019",
   "categoria": "potenciales",
   "situacion": "dudas_producto",
   "situacion_label": "Dudas sobre el producto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📋 Podemos explicarle la duración, el acceso y las condiciones del plan de {{servicio}} que consultó. ¿Qué información necesita?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-020",
   "categoria": "potenciales",
   "situacion": "dudas_producto",
   "situacion_label": "Dudas sobre el producto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🛠️ Si su decisión depende de alguna consulta técnica sobre {{servicio}}, cuéntenos y revisaremos cómo ayudarle.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-021",
   "categoria": "potenciales",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💙 Si está esperando su fecha de pago, podemos retomar la cotización de {{servicio}} cuando le resulte conveniente.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-022",
   "categoria": "potenciales",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 ¿Prefiere revisar opciones que se ajusten mejor a su presupuesto antes de contratar {{servicio}}?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-023",
   "categoria": "potenciales",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📅 Si aún no es el momento adecuado para comprar, ¿desea acordar una fecha para conversar nuevamente?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-POTENCIALES-024",
   "categoria": "potenciales",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Entendemos que puede estar evaluando sus gastos. Podemos ayudarle a comparar opciones sin compromiso.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-POTENCIALES-025",
   "categoria": "potenciales",
   "situacion": "presupuesto",
   "situacion_label": "Presupuesto o salario",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📋 Si el precio de {{servicio}} no se ajusta a lo que busca, podemos consultar otras alternativas disponibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-026",
   "categoria": "potenciales",
   "situacion": "comparacion_planes",
   "situacion_label": "Comparación de planes",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🎯 Si todavía está comparando opciones, podemos ayudarle a identificar qué plan de {{servicio}} se ajusta a sus necesidades.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-027",
   "categoria": "potenciales",
   "situacion": "comparacion_planes",
   "situacion_label": "Comparación de planes",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🔎 ¿Está valorando otra plataforma además de {{servicio}}? Podemos explicarle las diferencias relevantes para su decisión.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-028",
   "categoria": "potenciales",
   "situacion": "comparacion_planes",
   "situacion_label": "Comparación de planes",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📺 Si su prioridad es el contenido, la compatibilidad o el precio, cuéntenos qué necesita y le ayudamos a comparar.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-POTENCIALES-029",
   "categoria": "potenciales",
   "situacion": "comparacion_planes",
   "situacion_label": "Comparación de planes",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💡 ¿Desea revisar las opciones de duración disponibles para {{servicio}} antes de elegir?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-030",
   "categoria": "potenciales",
   "situacion": "comparacion_planes",
   "situacion_label": "Comparación de planes",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 Si la cantidad de dispositivos es importante para usted, podemos confirmar las condiciones de los planes disponibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-POTENCIALES-031",
   "categoria": "potenciales",
   "situacion": "intencion_compra",
   "situacion_label": "Intención de concretar",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🙌 Si ya decidió contratar {{servicio}}, podemos acompañarle en los pasos para completar su primera compra.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-032",
   "categoria": "potenciales",
   "situacion": "intencion_compra",
   "situacion_label": "Intención de concretar",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📲 ¿Desea que confirmemos la disponibilidad actual de {{servicio}} y le indiquemos cómo continuar?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-033",
   "categoria": "potenciales",
   "situacion": "intencion_compra",
   "situacion_label": "Intención de concretar",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Estamos disponibles para atenderle si desea concretar su cotización de {{servicio}}. ¿Le gustaría proceder?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-034",
   "categoria": "potenciales",
   "situacion": "intencion_compra",
   "situacion_label": "Intención de concretar",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Si la información que recibió cumple con lo que necesita, podemos ayudarle a continuar con su contratación de {{servicio}}.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-035",
   "categoria": "potenciales",
   "situacion": "intencion_compra",
   "situacion_label": "Intención de concretar",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 ¿Le gustaría avanzar con {{servicio}} o prefiere resolver primero alguna consulta adicional?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-036",
   "categoria": "potenciales",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n🤝 Si decidió no contratar {{servicio}} por ahora, lo comprendemos. ¿Prefiere que cerremos el seguimiento?\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-037",
   "categoria": "potenciales",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💙 Gracias por consultar con Sublicuentas. Si cambia de opinión, puede escribirnos cuando lo desee.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  },
  {
   "id": "GC-POTENCIALES-038",
   "categoria": "potenciales",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n📱 No queremos interrumpirle. Si ya no le interesa {{servicio}}, puede indicárnoslo y no insistiremos en esta cotización.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-039",
   "categoria": "potenciales",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n💬 ¿Prefiere dejar pendiente su consulta de {{servicio}} sin recibir más recordatorios? Respetaremos su decisión.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo",
    "servicio"
   ]
  },
  {
   "id": "GC-POTENCIALES-040",
   "categoria": "potenciales",
   "situacion": "cierre_respetuoso",
   "situacion_label": "Cierre del seguimiento / preferencia de contacto",
   "activa": true,
   "mensaje": "{{saludo}}\n\n✨ Agradecemos su interés en nuestros servicios. Si necesita información en el futuro, estaremos disponibles.\n\nSublicuentas.",
   "variables_requeridas": [
    "saludo"
   ]
  }
 ]
});
