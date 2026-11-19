import type {TemplateFields} from '../shared/knowledge-templates';

type SeedContent = Pick<TemplateFields, 'name' | 'description' | 'tags' | 'features' | 'useCases'> & {author?:string};

function seed(slot: number, file: string, content: SeedContent, instructions: string) {
  const id = '45b8c010-f3ba-479a-8d10-' + String(slot).padStart(12, '0');
  const {author='', ...fields} = content;
  return {
    id, file, ...fields, author, sourceUrl:'',
    prompt: `Diseña {{nombre_proyecto}}, una interfaz para {{tipo_aplicacion}}. Objetivo: {{objetivo}}. Organiza {{secciones}}. Adapta el acento a {{color_acento}} y usa {{tecnologia}}. Si no se indica tecnología, inspecciona y respeta el stack, los componentes y las convenciones del proyecto.

${instructions}

Usa la referencia para entender la composición. Selecciona imágenes, textos e identidad del proyecto de destino. Respeta movimiento reducido, contraste, etiquetas accesibles y foco visible. Conecta las acciones a capacidades reales del producto.`,
  };
}

export const templateSeeds = [
  seed(1,'anime-editorial.png',{
    name:'Anime Editorial', description:'Una portada editorial con imagen protagonista, ritmo asimétrico y un acento rojo cálido.',
    tags:['Editorial','Anime','Oscuro'],
    features:['Imagen protagonista','Paneles oscuros cálidos','Acento rojo','Bloques asimétricos','Jerarquía tipográfica fuerte'],
    useCases:['Portada de una publicación visual','Micrositio para una colección o estreno'],
  },`Sitúa primero el titular sobre una imagen protagonista y coloca a su lado una barra estrecha de navegación y un módulo de fecha, edición o información vigente. Reserva la esquina inferior para una acción principal y una pieza secundaria con imagen. Usa carbón cálido, gris arcilla y rojo para estados activos, con una capa oscura localizada bajo el texto. Elige una sans condensada para los titulares y una sans de lectura para el cuerpo. Agrupa con espacios de 12, 24 y 40 px y radios amplios que enmarquen la composición.

En pantallas estrechas, lleva la navegación a una fila compacta y coloca la información secundaria tras la acción principal. Permite enfocar y activar cada acción con teclado. Usa un fundido breve al cambiar de pieza. Si falta una imagen muestra el titular y un bloque de color, con estado de carga y reintento cuando corresponda. Verifica que el foco de la imagen, el texto y la acción se distingan a 360 px y que el orden de tabulación siga la lectura.`),
  seed(2,'glass-desktop.png',{
    name:'Glass Desktop', description:'Un escritorio con fondo personalizable, widgets compactos y un dock flotante.',
    tags:['Glassmorphism','Escritorio','Widgets'],
    features:['Fondo personalizado','Cristal translúcido','Widgets compactos','Dock flotante','Contraste protegido'],
    useCases:['Inicio de un asistente de escritorio','Panel personal con accesos y estado'],
  },`Organiza la interfaz con un panel de contexto central, una columna de widgets compactos y un dock independiente. Usa un fondo personalizable y superficies de cristal frío con desenfoque moderado, bordes interiores finos y un relleno suficiente para mantener contraste. Usa numerales tabulares para reloj y métricas, y una sans de sistema para etiquetas. Emplea una retícula de 8 px y separa dock y panel para que cada uno tenga un área de interacción clara.

En una ventana estrecha, coloca los widgets debajo del panel principal y permite envolver el dock sin tapar contenido. Distingue foco, selección y estado inactivo con icono y texto accesible. Usa transiciones breves al abrir un widget. Si faltan datos, muestra la última actualización o una explicación junto a la acción disponible. Verifica contraste sobre fondos claros y oscuros, zoom de texto y acceso por teclado a todos los controles.`),
  seed(3,'spatial-cinema.png',{
    name:'Spatial Cinema', description:'Un catálogo multimedia con una pieza destacada, contenido reciente y profundidad de cristal.',
    tags:['Catálogo','Glassmorphism','Editorial'],
    features:['Hero destacado','Catálogo de tarjetas','Navegación y búsqueda','Contenido reciente','Profundidad moderada'],
    useCases:['Catálogo de contenido audiovisual','Biblioteca de recursos visuales'],
  },`Da prioridad a una pieza destacada con título, breve descripción y acción disponible. Sitúa la búsqueda y las categorías arriba, una lista de recientes al lado y una cuadrícula debajo. Mantén las imágenes de portada diferenciadas de las acciones. Combina grafito, gris humo y un acento puntual con superficies translúcidas de profundidad media. Usa 24 px entre regiones y 12 px dentro de tarjetas, tipografía sans con contraste claro de tamaños y un degradado bajo el texto sobre imagen.

Al reducir el ancho, coloca la pieza destacada primero, sigue con el catálogo y deja recientes en una lista accesible debajo. Conserva posición y filtros al volver de un detalle. Usa indicadores de carga por tarjeta, estados de catálogo vacío, resultados sin coincidencias y reintento si falla la carga. Prueba búsqueda, lectura con teclado y foco sobre imágenes brillantes. Muestra reproducción o historial únicamente si el producto dispone de esas funciones.`),
  seed(4,'creative-studio.png',{
    name:'Creative Studio', description:'Un espacio creativo monocromo con un lienzo amplio y módulos de herramientas compactos.',
    tags:['Monocromo','Editor','Bento'],
    features:['Imagen central amplia','Navegación lateral estrecha','Paneles modulares','Acento puntual','Controles agrupados'],
    useCases:['Editor creativo con previsualización','Explorador de estilos y variantes'],
    author:'bee_uiux',
  },`Construye un lienzo principal con mucho espacio para inspeccionar el material y un lateral para variantes relacionadas. Coloca selección de estilos y herramientas de edición en módulos propios. Usa una navegación estrecha con iconos etiquetados y reúne la acción principal con los controles que la afectan. Elige blanco roto, antracita y un acento corto para selección. Aplica tipografía sans legible, cuerpos de 14–16 px, márgenes de 16–24 px, radios comunes y bordes nítidos.

En anchos estrechos muestra primero el lienzo y después las herramientas; usa grupos plegables con estados anunciados. Evita movimiento durante la edición y conserva selección y enfoque al cambiar de variante. Diseña un lienzo vacío con una acción disponible, un estado mientras carga el recurso y recuperación de error sin perder el trabajo. Verifica que los controles estén agrupados por tarea, que las miniaturas no desplacen el lienzo y que el editor funcione sin ratón.`),
  seed(5,'minimal-showcase.png',{
    name:'Minimal Showcase', description:'Una presentación de producto con geometría marcada, espacio negativo y una tarjeta superpuesta.',
    tags:['Minimal','Producto','Wireframe'],
    features:['Presentación de producto','Espacio negativo','Geometría distintiva','Pocos controles','Superposición legible'],
    useCases:['Portada de un producto','Ficha de una pieza de portfolio'],
  },`Dedica la mayor superficie a una imagen o vista del producto. Ubica el título y una descripción corta en un margen generoso, con una tarjeta de datos superpuesta donde la imagen tenga espacio libre. Usa un único botón principal con su estado de foco. Elige una paleta neutra de alto contraste, una sans con titular grande y texto cómodo, y espacios de 24, 40 y 64 px. Combina un contorno geométrico con radios modestos y sombra corta en la tarjeta.

En móvil, convierte la tarjeta superpuesta en un bloque normal debajo de la imagen y reduce márgenes sin ocultar el título. Usa transiciones discretas al cambiar la imagen o abrir una ficha. Si faltan recursos visuales, conserva la estructura textual y ofrece reintento si la carga falla. Verifica que la tarjeta nunca cubra detalles esenciales, que el contraste sea suficiente y que las acciones se puedan alcanzar en el orden de lectura.`),
  seed(6,'bento-gallery.png',{
    name:'Bento Gallery', description:'Una galería de tarjetas encajadas con tamaños variados y un recorrido de lectura claro.',
    tags:['Bento','Catálogo','Wireframe'],
    features:['Cuadrícula de tamaños variados','Radios coherentes','Tarjetas encajadas','Jerarquía por superficie','Orden de lectura adaptable'],
    useCases:['Galería de proyectos','Biblioteca de referencias o recursos'],
  },`Diseña una cuadrícula con tres entradas pares en la primera fila y un bloque destacado más ancho junto a una tarjeta contextual en la siguiente. Usa proporciones consistentes para las miniaturas y deja el título y la interacción en una franja sólida que no tape la imagen. Define tres niveles de tamaño para la cuadrícula. Emplea grises neutros y el acento para selección y acciones, fuentes sans con títulos de una o dos líneas, separaciones de 12–16 px y radios de familia común.

Pasa de tres columnas a dos y luego a una respetando el orden del DOM. Abrir una tarjeta debe tener el mismo resultado por clic o teclado y conservar la posición al regresar. Usa tarjetas esqueleto al cargar y distingue galería vacía, búsqueda sin coincidencias y fallos. Verifica que trasladar un bloque de tamaño no reordene el foco, que las miniaturas con proporciones distintas se entiendan y que los títulos largos se adapten.`),
  seed(7,'workspace-dashboard.png',{
    name:'Workspace Dashboard', description:'Un panel de trabajo protagonista con navegación persistente y contexto al alcance.',
    tags:['Dashboard','Productividad','Wireframe'],
    features:['Área de trabajo protagonista','Panel contextual derecho','Módulos inferiores','Navegación persistente','Densidad equilibrada'],
    useCases:['Workspace para proyectos','Panel de seguimiento de operaciones'],
    author:'bee_uiux',
  },`Da al flujo principal la superficie más amplia. Sitúa navegación persistente a la izquierda y un panel contextual a la derecha con detalles de la selección. Usa la franja inferior para módulos auxiliares priorizados por frecuencia de uso. Reserva los tonos más claros para superficies de trabajo y el acento para estados interactivos. Usa títulos compactos, etiquetas consistentes y una escala de 8 px. Separa módulos con bordes de bajo contraste y evita acumular sombras.

Bajo un ancho medio, mueve el contexto debajo de la tarea activa y permite plegar la navegación con un botón etiquetado. Mantén historial de selección cuando se cierre el contexto. Indica carga por módulo, un estado sin selección y errores junto al bloque correspondiente. Verifica lectura y teclado, persistencia al cambiar de módulo y ausencia de scroll horizontal. Usa los permisos, datos y acciones que existan en el proyecto.`),
  seed(8,'atmospheric-analytics.png',{
    name:'Atmospheric Analytics', description:'Un dashboard oscuro con gráficos legibles, navegación clara y un paisaje discreto.',
    tags:['Analítica','Dashboard','Oscuro'],
    features:['Métricas agrupadas','Visualizaciones legibles','Fondo ambiental discreto','Navegación clara','Acentos cálidos'],
    useCases:['Seguimiento de métricas de producto','Informes de salud operativa'],
  },`Agrupa indicadores de estado y tendencia, reserva el bloque principal para la serie temporal y coloca comparativas o desgloses debajo. Usa una columna clara para navegación y filtros. Coloca el paisaje en una capa ambiental fuera de etiquetas, tramas y leyendas. Elige azul carbón, blanco cálido y naranja para resaltar una serie, con formas y texto para distinguir las demás. Usa números tabulares, ejes y unidades legibles, espacios de 16–24 px y paneles de borde fino.

En pantallas estrechas, apila los indicadores, el gráfico principal y los desgloses, con filtros plegables que indiquen su estado. Ofrece resumen textual y tabla accesible para gráficas, interacción por teclado y transiciones discretas al variar filtros. Distingue datos ausentes, carga y error por panel. Usa fuentes reales del proyecto o marca los datos de demostración y su procedencia. Verifica unidades, escalas, fecha de actualización, contraste y lectura al ampliar texto.`),
];
