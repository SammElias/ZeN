import {enterpriseTemplateId,initialEnterpriseTemplateCount} from '../shared/enterprise-template-catalog';
import {templateExpansion,type EnterpriseDesign} from './enterprise-template-expansion';

function seed(slot: number, file: string, design: EnterpriseDesign) {
  const {palette,layout,workflow,canvas,react,...fields}=design;
  const base=`# ${fields.name}

Crea la interfaz de {{nombre_proyecto}} para este objetivo de negocio: {{objetivo}}. Usa {{origen_datos}} si está definido. Si los marcadores siguen vacíos, implementa el caso descrito con registros ficticios identificados como demostración. Si ya existe una app, integra la pantalla con sus componentes, navegación y permisos.

## Diseño
${layout}
Usa esta paleta para la vista inicial. ${palette}

## Flujo
${workflow}

## Criterios de aceptación
Adapta la composición a escritorio, tableta y móvil. Incluye carga, colección vacía, filtros sin resultados y error con reintento cuando apliquen. Usa etiquetas claras, contraste suficiente y estados con texto e icono, además del color. En escritorio permite operar por teclado y muestra el foco. Proporciona datos de muestra y un recorrido reproducible. Implementa las acciones de la interfaz con esos datos. Si hay backend real, comprueba permisos y transiciones ahí.`;

  return {
    id:enterpriseTemplateId(slot),
    file,...fields,author:'',sourceUrl:'',
    prompt:`${base}

## Entrega para Power Apps Canvas
Diseña una app Canvas. Entrega el árbol de pantallas y controles con nombres, propiedades clave y fórmulas Power Fx por control y evento. Usa contenedores de diseño automático, una galería para colecciones y formularios donde encajen. Documenta la configuración adaptable, las tablas y los campos asumidos, y comprueba la delegación según el conector. Usa colecciones locales para la demostración.
${canvas}
Indica cómo montar y probar la interfaz en Power Apps Studio. Si puedes implementar sobre un proyecto Canvas existente, aplica los cambios allí.`,
    reactPrompt:`${base}

## Entrega para React + TypeScript
Implementa la interfaz con React y TypeScript. Reutiliza el sistema visual y el enrutamiento existentes. En un proyecto vacío, entrega componentes reutilizables, estilos con variables CSS y un adaptador de datos con fixtures tipados. Implementa la disposición con Grid y Flexbox y utiliza controles HTML semánticos.
${react}
Incluye el comando de arranque y pasos para probar el recorrido principal con teclado y a 360 px de ancho.`,
  };
}

export const templateSeeds=[
  seed(1,'mesa-de-servicio.png',{
    name:'Mesa de servicio',
    description:'Una cola de incidencias con prioridad, vencimientos SLA y el historial de cada ticket.',
    tags:['Soporte','Cola de trabajo','SLA'],
    features:['Cola con búsqueda y vistas guardadas','Indicadores de respuesta','Detalle junto a la lista','Historial cronológico','Asignación y resolución'],
    useCases:['Soporte de TI','Incidencias internas','Atención posventa'],
    palette:'Lienzo azul tinta #101B34, tarjetas #172844, texto #F1F6FF y acento cobalto #91BCFF.',
    layout:'Pon una barra lateral compacta y abre la vista con tres cifras: pendientes, próximos a vencer y fuera de SLA. Dedica el centro a una tabla de tickets y el lateral derecho al historial y la acción del registro seleccionado. En móvil muestra la cola y el detalle como vistas consecutivas.',
    workflow:'Filtra por prioridad, responsable y estado. Abre un ticket, consulta su vencimiento, asígnalo y añade una nota interna antes de resolverlo. Distingue nota interna de respuesta al solicitante. Conserva filtros al regresar a la cola y etiqueta fechas con su zona horaria.',
    canvas:'Usa una galería de tickets, una segunda galería de historial y un formulario de actualización. Calcula el indicador de vencimiento desde la fecha almacenada y muestra hora, estado y responsable.',
    react:'Usa una tabla con navegación y filtros, un detalle con historial y validación en el formulario de resolución. Conserva la selección mientras el registro siga visible.',
  }),
  seed(2,'bandeja-de-aprobaciones.png',{
    name:'Bandeja de aprobaciones',
    description:'Una bandeja centrada en revisar una solicitud y decidir con su contexto a la vista.',
    tags:['Aprobaciones','Compras','Finanzas'],
    features:['Lista agrupada por estado','Importe y solicitante visibles','Resumen de cambios y evidencias','Motivo y confirmación de decisión','Historial de decisiones'],
    useCases:['Aprobación de compras','Gastos y dietas','Solicitudes de acceso'],
    palette:'Fondo lavanda #F4F0FA, panel blanco #FFFFFF, texto ciruela #251B3E y acento #6946B7.',
    layout:'Usa una bandeja dividida con lista a la izquierda y detalle amplio a la derecha. En el detalle, sitúa importe o alcance junto al título, seguidos de las partidas, evidencias y actividad. Mantén las acciones de aprobación al final del detalle y lleva el historial debajo en pantallas estrechas.',
    workflow:'Selecciona una solicitud pendiente, inspecciona su documentación y aprueba o devuelve. Pide motivo al devolver y confirma la decisión antes de guardarla. Refresca el registro si otro revisor ya decidió y mantiene visibles el autor y la hora de cada decisión.',
    canvas:'Implementa galería maestra, formulario de lectura, contenedor de confirmación y campo para el motivo. Controla el resultado de la acción con IfError y refresca el registro tras un cambio.',
    react:'Crea la bandeja y el detalle como componentes coordinados por el identificador de la solicitud. Gestiona el foco al abrir y cerrar la confirmación y conserva el motivo si falla el guardado.',
  }),
  seed(3,'inspecciones-de-campo.png',{
    name:'Inspecciones de campo',
    description:'Una lista de comprobación móvil con progreso, observaciones y evidencias por puesto.',
    tags:['Operaciones','Móvil','Calidad'],
    features:['Progreso de tareas','Controles táctiles amplios','Evidencias por hallazgo','Resumen antes de enviar','Recuperación del borrador'],
    useCases:['Inspección de instalaciones','Control de calidad','Mantenimiento preventivo'],
    palette:'Fondo crema #FAF4E8, tarjetas marfil #FFFCF5, tinta #382A1B y acento terracota #A54823.',
    layout:'Diseña primero para teléfono. Coloca en la cabecera el lugar, el turno y el progreso. Agrupa preguntas en tarjetas con respuestas Conforme, Incidencia y No aplica. En tableta, añade a la derecha un resumen de hallazgos y evidencias.',
    workflow:'Marca cada comprobación, añade observación y foto a un hallazgo cuando permita el origen de datos, revisa los pendientes y completa la inspección. Conserva el borrador al volver de un detalle. Si se requiere trabajo sin conexión, declara la estrategia de persistencia y muestra el estado de sincronización.',
    canvas:'Usa una galería de comprobaciones y una colección para el borrador. Explica qué control de evidencias admite el origen de datos. Si planteas persistencia local, indica plataformas compatibles y simula explícitamente los casos de sincronización.',
    react:'Usa grupos de radio para las respuestas, validación por sección y previsualización de archivos locales. Separa guardado de borrador de envío y prueba volver a un paso anterior.',
  }),
  seed(4,'agenda-de-recursos.png',{
    name:'Agenda de recursos',
    description:'Una planificación semanal para asignar personas, espacios o equipos sin solapamientos.',
    tags:['Planificación','Reservas','Recursos'],
    features:['Vista semanal y agenda móvil','Filtros de disponibilidad','Selección de franjas','Conflictos explicados','Formulario de reserva contextual'],
    useCases:['Reservas de salas','Planificación de turnos','Asignación de técnicos'],
    palette:'Fondo hielo #EFF6FF, panel blanco #FFFFFF, texto azul noche #142A44 y acento índigo #244CB7.',
    layout:'Usa una barra superior con semana y selector de recurso. En pantallas amplias muestra los días en columnas y las reservas como bloques con hora y recurso. En móvil muestra una agenda de un día con navegación de fecha. Muestra disponibilidad con texto y patrón.',
    workflow:'Elige fecha y recurso, selecciona una franja, confirma zona horaria y guarda. Explica los solapamientos antes de guardar y vuelve a comprobar el horario en el origen de datos. Ofrece reasignación desde el formulario y acceso por teclado a las franjas.',
    canvas:'Usa galerías de franjas de duración acotada y un formulario de reserva. En móvil cambia a una galería diaria. Modela inicio y fin de forma consistente y documenta la validación de solapamientos del servicio.',
    react:'Construye una cuadrícula semanal y una lista diaria a partir de las mismas reservas tipadas. Permite reservar con botones y teclado, y valida solapamientos al confirmar.',
  }),
  seed(5,'inventario-y-activos.png',{
    name:'Inventario y activos',
    description:'Un catálogo tabular con stock por almacén, movimientos y acciones sobre el activo.',
    tags:['Inventario','Almacén','Activos'],
    features:['Búsqueda por nombre o código','Existencias por ubicación','Stock mínimo visible','Panel lateral de movimientos','Validación de entradas y salidas'],
    useCases:['Gestión de equipamiento','Control de existencias','Recepción de materiales'],
    palette:'Fondo verde grisáceo #EDF5F0, tarjetas #FFFFFF, texto bosque #12332A y acentos #13684C y #D7F4A0.',
    layout:'Pon búsqueda, filtros y almacén en una única cabecera. Usa tabla con código, artículo, ubicación, disponible y mínimo. Abre una ficha lateral con movimientos y un resumen de existencias. En móvil cambia las filas por fichas de dos líneas y conserva detalle y filtros.',
    workflow:'Busca un artículo, selecciona el almacén, inspecciona stock y registra entrada, salida o traslado. Muestra cantidad, unidad y ubicación de origen y destino según la acción. Avisa si se supera la disponibilidad y comprueba la cantidad en el origen de datos al confirmar.',
    canvas:'Usa una galería con plantilla de columnas, controles de filtro delegables si el conector lo permite y un formulario de movimiento con validación y fecha.',
    react:'Usa tabla, filtros, paginación y una ficha de detalle con historial. Modela entrada, salida y traslado con tipos distintos para validar los campos de cada acción.',
  }),
  seed(6,'portal-del-empleado.png',{
    name:'Portal del empleado',
    description:'Un portal de autoservicio con catálogo, solicitudes propias y próximos pasos.',
    tags:['Autoservicio','RR. HH.','Catálogo'],
    features:['Búsqueda global de servicios','Categorías visuales','Solicitudes propias','Formularios por servicio','Acceso según el rol'],
    useCases:['Onboarding','Solicitudes a recursos humanos','Catálogo de servicios internos'],
    palette:'Fondo rosa casi blanco #FCF3F5, tarjetas #FFFFFF, texto #392034 y acentos frambuesa #9B2E59.',
    layout:'Abre con un buscador amplio y una acción clara para ver solicitudes. Muestra servicios en una cuadrícula de tarjetas con icono y descripción. Reserva una columna para las solicitudes en curso. En móvil coloca el seguimiento antes del catálogo cuando haya tareas pendientes.',
    workflow:'Encuentra un servicio por nombre o categoría, abre requisitos y plazo estimado si está disponible, completa la solicitud y revisa su estado. Conserva los campos tras un error y muestra el identificador de confirmación. Carga las solicitudes visibles por usuario desde una fuente autorizada.',
    canvas:'Usa galería adaptable para el catálogo y formulario por tipo de solicitud. Reutiliza cabecera y tarjeta como componentes y usa la pantalla Mis solicitudes para mostrar el seguimiento.',
    react:'Usa rutas para catálogo, servicio y mis solicitudes. Mantén navegación de vuelta y filtros. Implementa formularios accesibles, con etiquetas y errores vinculados.',
  }),
  seed(7,'radar-de-indicadores.png',{
    name:'Radar de indicadores',
    description:'Un tablero ejecutivo que conecta métricas, tendencias y el detalle que explica cada variación.',
    tags:['Analítica','Dirección','KPI'],
    features:['Métricas con objetivo y unidad','Comparación de periodos','Tendencia con alternativa tabular','Desglose con evidencia','Fecha de actualización'],
    useCases:['Seguimiento comercial','Cuadro de mando operativo','Control de nivel de servicio'],
    palette:'Fondo grafito #171A20, tarjetas #252932, texto marfil #FFF6E5 y acento ámbar #FFCA70.',
    layout:'Muestra periodo y unidad de negocio arriba. Alinea cuatro KPI, una serie temporal grande y un desglose ordenado a la derecha. En pantallas estrechas conserva el resumen encima de la serie y el desglose debajo. Usa una escala común para valores comparables.',
    workflow:'Cambia el periodo y revisa qué unidad y definición usa cada métrica. Abre el detalle de un indicador para consultar su desglose. Distingue cero, dato ausente y fuente desactualizada. Incluye resumen textual y tabla con los datos del gráfico.',
    canvas:'Usa tarjetas con componentes, controles de filtro y gráficos compatibles con Canvas cuando aporten claridad. Para datos grandes, pide agregados al origen en lugar de calcular sobre colecciones parciales.',
    react:'Usa tarjetas con unidades y tendencia, y un gráfico responsive con tabla accesible. Mantén filtros y resultados sincronizados, y evita que una respuesta antigua sustituya la selección actual.',
  }),
  ...templateExpansion.map(({file,colors:[background,surface,text,accent],...design},index)=>
    seed(initialEnterpriseTemplateCount+index+1,file,{
      ...design,palette:`Fondo ${background}, superficies ${surface}, texto ${text} y acento ${accent}.`,
    })),
];
