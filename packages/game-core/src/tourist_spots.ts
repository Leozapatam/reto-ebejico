/**
 * Hitos patrimoniales, geográficos y turísticos a lo largo de la ruta de Ebéjico.
 * Diseñado para el módulo de Turismo pedagógico y territorial de Mirada Parda.
 */

export type TouristCategory = 'patrimonio' | 'hidrico' | 'geografia' | 'tradicion' | 'ingenieria';

export interface TouristSpot {
  id: string;
  name: string;
  category: TouristCategory;
  categoryLabel: string;
  icon: string;
  km: number;
  elevationMeters: number;
  lat: number;
  lon: number;
  waypointIndex: number;
  shortDesc: string;
  fullDesc: string;
  highlight: string;
  googleMapsUrl: string;
}

export const TOURIST_SPOTS: TouristSpot[] = [
  {
    id: 'tunel-occidente',
    name: 'Portal Occidental del Túnel de Occidente',
    category: 'ingenieria',
    categoryLabel: 'Ingeniería & Conexión Vial',
    icon: '🏛️',
    km: 0.0,
    elevationMeters: 1907,
    lat: 6.324053,
    lon: -75.686874,
    waypointIndex: 0,
    highlight: 'Boca de salida a 1.907 msnm',
    shortDesc: 'La gran obra que perforó la cordillera Central uniendo a Medellín con la cuenca del río Cauca.',
    fullDesc:
      'Inaugurado en 2006 como el Túnel Fernando Gómez Martínez, sus 4,6 kilómetros perforaron el corazón de la cordillera Central y transformaron la movilidad hacia el occidente antioqueño. Al emerger de su boca occidental a 1.907 msnm, la niebla densa del Valle de Aburrá da paso abrupto a la luminosidad, al aire cálido de montaña y al imponente cañón del río Cauca. Aquí arranca el Reto Ebéjico sobre el asfalto que desciende hacia la historia arriera.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.324053,-75.686874',
  },
  {
    id: 'puente-la-negra',
    name: 'Viaducto Quebrada La Negra',
    category: 'ingenieria',
    categoryLabel: 'Gran Viaducto de Montaña',
    icon: '🌉',
    km: 0.35,
    elevationMeters: 1900,
    lat: 6.3252,
    lon: -75.68765,
    waypointIndex: 9,
    highlight: 'Primer puente sobre el abismo',
    shortDesc: 'Majestuoso viaducto de concreto sobre la cuenca torrencial de la quebrada La Negra.',
    fullDesc:
      'Primer viaducto de concreto del recorrido, suspendido sobre una falla geológica activa en las nacientes de la quebrada La Negra. Sus aguas torrenciales descienden desde los altos de San Cristóbal para alimentar el río San Jerónimo. Desde la calzada se siente el primer vértigo del abismo y la aceleración natural del carro de rodillos impulsado por la gravedad pura.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.325200,-75.687650',
  },
  {
    id: 'quebrada-la-volcana',
    name: 'Quebrada La Volcana',
    category: 'hidrico',
    categoryLabel: 'Cuenca Hídrica & Relieve',
    icon: '🌊',
    km: 2.05,
    elevationMeters: 1795,
    lat: 6.33758,
    lon: -75.69041,
    waypointIndex: 118,
    highlight: 'Aguas torrenciales y peñascos milenarios',
    shortDesc: 'Profunda cañada rocosa de aguas frías y leyendas de borrasca en la vertiente.',
    fullDesc:
      'Debe su nombre al rumor semejante a un volcán que retumba por la cañada cuando los aguaceros torrenciales bajan de la cordillera. Sus aguas heladas han tallado gigantescos monolitos de piedra a lo largo de milenios. El viaducto vuela sobre este cañón ofreciendo un corredor de aire fresco constante antes de afrontar las curvas del valle.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.337580,-75.690410',
  },
  {
    id: 'viaductos-la-nuez-causala',
    name: 'Viaductos La Nuez y La Cáusala',
    category: 'ingenieria',
    categoryLabel: 'Viaductos Paralelos',
    icon: '🌉',
    km: 2.8,
    elevationMeters: 1748,
    lat: 6.34005,
    lon: -75.69234,
    waypointIndex: 146,
    highlight: 'Complejo de puentes gemelos',
    shortDesc: 'Doble paso en voladizo sobre cañones escalonados de selva andina.',
    fullDesc:
      'Dos estructuras consecutivas de ingeniería que sobrevuelan laderas cubiertas de helechos arborescentes y yarumos. En este tramo la pendiente del 9% exige precisión con el lazo del timón y aplomo con la palanca de freno mientras se contempla la primera panorámica abierta hacia los valles templados del occidente.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.340050,-75.692340',
  },
  {
    id: 'paso-la-fonda',
    name: 'Paso Quebrada La Fonda',
    category: 'tradicion',
    categoryLabel: 'Tradición Caminera & Arriería',
    icon: '☕',
    km: 4.0,
    elevationMeters: 1660,
    lat: 6.3452,
    lon: -75.70321,
    waypointIndex: 224,
    highlight: 'Antiguo parador de caminos reales',
    shortDesc: 'Histórico punto de descanso de arrieros, recuas de mulas y transportadores.',
    fullDesc:
      'Antes de la construcción de las autopistas modernas, este paso albergaba fondas camineras de madera donde los arrieros descargaban sus mulas y los primeros camioneros dejaban enfriar los radiadores. Persiste el aroma a café campesino recién colado, aguapanela con quesito montañero y las tertulias de camino real.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.345200,-75.703210',
  },
  {
    id: 'viaducto-la-potrera',
    name: 'Gran Viaducto Curvo La Potrera',
    category: 'geografia',
    categoryLabel: 'Mirador Panorámico',
    icon: '🏔️',
    km: 5.5,
    elevationMeters: 1587,
    lat: 6.3556,
    lon: -75.70889,
    waypointIndex: 311,
    highlight: 'Curva flotante de 120 metros de radio',
    shortDesc: 'Imponente viaducto en curva con vista panorámica abierta a las cordilleras.',
    fullDesc:
      'Una de las obras civiles más bellas de la Ruta 62. Describe un arco amplio en voladizo sobre la garganta de La Potrera. Desde este balcón de concreto se aprecia el cambio de vegetación: de los robledales de niebla a los primeros guaduales y cañaduzales de clima medio.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.355600,-75.708890',
  },
  {
    id: 'las-partidas',
    name: 'Desvío «Las Partidas»',
    category: 'patrimonio',
    categoryLabel: 'Encrucijada Territorial',
    icon: '🏛️',
    km: 6.2,
    elevationMeters: 1540,
    lat: 6.36107,
    lon: -75.70865,
    waypointIndex: 349,
    highlight: 'El cruce hacia la memoria campesina',
    shortDesc: 'La bifurcación crucial: la troncal al mar se separa de la ruta solitaria a Ebéjico.',
    fullDesc:
      'El hito neurálgico del viaje territorial. A la derecha, la moderna Ruta 62 desciende rápida hacia San Jerónimo, Santa Fe de Antioquia y el mar de Urabá. A la izquierda se abre el ramal campesino de montaña: una vía solitaria que serpentea por las entrañas agrícolas de Ebéjico, preservando el silencio y el ritmo de los pueblos coloniales.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.361070,-75.708650',
  },
  {
    id: 'quebrada-la-sucia',
    name: 'Quebrada La Sucia / La Frisola',
    category: 'hidrico',
    categoryLabel: 'Límite Municipal & Balneario',
    icon: '🌊',
    km: 9.43,
    elevationMeters: 1324,
    lat: 6.35128,
    lon: -75.71615,
    waypointIndex: 565,
    highlight: 'Límite geográfico Medellín - Ebéjico',
    shortDesc: 'Frontera natural y balneario tradicional de pozas cristalinas entre ceibas.',
    fullDesc:
      'Esta quebrada marca la frontera oficial donde concluye la jurisdicción de Medellín y comienza el municipio de Ebéjico. A pesar de su toponimia colonial, sus aguas son frescas y cristalinas, con charcos hondos donde familias locales celebran el tradicional "paseo de olla" bajo la sombra de caracolíes centenarios.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.351280,-75.716150',
  },
  {
    id: 'agua-de-la-pena',
    name: 'Horquilla Agua de La Peña',
    category: 'geografia',
    categoryLabel: 'Curva Mítica & Manantial',
    icon: '🏔️',
    km: 12.0,
    elevationMeters: 1470,
    lat: 6.36072,
    lon: -75.72512,
    waypointIndex: 680,
    highlight: 'Nacimiento de agua en la roca viva',
    shortDesc: 'Horquilla de 180° donde un manantial brota de la peña para refrescar los frenos.',
    fullDesc:
      'Curva cerrada de 180 grados excavada directamente en el talud de roca viva. De una fractura de la piedra brota agua pura y helada de manantial. Es la parada legendaria donde los pilotos de carros de rodillos solían arrojar agua a las balineras para disipar el calor del roce del asfalto antes de encarar la subida al alto.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.360720,-75.725120',
  },
  {
    id: 'vereda-la-renta',
    name: 'Veredas La Renta y La Suiza',
    category: 'tradicion',
    categoryLabel: 'Paisaje Cultural Cafetero',
    icon: '☕',
    km: 13.0,
    elevationMeters: 1540,
    lat: 6.3651,
    lon: -75.7298,
    waypointIndex: 732,
    highlight: 'Fincas de café y moliendas de panela',
    shortDesc: 'Laderas tapizadas de café de altura, plátano y casas de bahareque con chambranas.',
    fullDesc:
      'Corazón rural de la vertiente ebejicana. Las casas campesinas lucen zócalos pintados de colores vivos, corredores perimetrales y secaderos de café. El aire se impregna con el dulce aroma de la panela en los trapiches meleros y el rumor apacible de la vida del campo antioqueño.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.365100,-75.729800',
  },
  {
    id: 'alto-el-patudo',
    name: 'Alto de El Patudo',
    category: 'geografia',
    categoryLabel: 'Cumbre de Cordillera & Mirador',
    icon: '🏔️',
    km: 18.7,
    elevationMeters: 1763,
    lat: 6.3353,
    lon: -75.7318,
    waypointIndex: 960,
    highlight: 'Cota más alta de la etapa intermedia (1.763 msnm)',
    shortDesc: 'El mirador natural que abraza el cañón del río Cauca y la cordillera Occidental.',
    fullDesc:
      'Paso de cordillera que culmina el ascenso intermedio. A 1.763 metros sobre el nivel del mar, el viento sopla vigoroso y se divisa en días despejados el brillo lejano del río Cauca y los cerros tutelares. Marca el inicio del descenso definitivo y vertiginoso hacia el valle donde reposa Ebéjico.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.335300,-75.731800',
  },
  {
    id: 'blanquizal-campo-alegre',
    name: 'Veredas Blanquizal y Campo Alegre',
    category: 'tradicion',
    categoryLabel: 'Cuna de los Carros de Rodillos',
    icon: '🌾',
    km: 22.0,
    elevationMeters: 1480,
    lat: 6.3419,
    lon: -75.749,
    waypointIndex: 1139,
    highlight: 'Artesanos de balineras y madera de cedro',
    shortDesc: 'Territorio donde generaciones de campesinos han construido sus carros artesanales.',
    fullDesc:
      'En estas colinas fértiles la bajada en carro de rodillos es un ritual de fraternidad campesina. En los zaguanes se eligen tablones de cedro macizo, se labran lazos de fique para el timón de doble nudo y se reciclan balineras de acero de camiones y trapiches para forjar los vehículos que protagonizan las fiestas tradicionales.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.341900,-75.749000',
  },
  {
    id: 'puente-juan-ramos',
    name: 'Puente Quebrada Juan Ramos',
    category: 'hidrico',
    categoryLabel: 'Entrada Hídrica a Ebéjico',
    icon: '🌊',
    km: 25.2,
    elevationMeters: 1175,
    lat: 6.328,
    lon: -75.7637,
    waypointIndex: 1433,
    highlight: 'El último puente antes del pueblo',
    shortDesc: 'Paso fluvial que da la bienvenida a las primeras calles empedradas de la cabecera.',
    fullDesc:
      'Estructura que cruza la quebrada Juan Ramos, afluente vital que bordea el casco urbano. Al cruzar sus barandas de concreto, el tableteo metálico de las cuatro balineras cambia de tono sobre las primeras vías urbanas, anunciando a los vecinos la llegada triunfal del corredor.',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.328000,-75.763700',
  },
  {
    id: 'parque-ebejico',
    name: 'Parque Principal de Ebéjico',
    category: 'patrimonio',
    categoryLabel: 'Meta, Plaza Mayor & Memoria',
    icon: '🏛️',
    km: 26.15,
    elevationMeters: 1141,
    lat: 6.3264186,
    lon: -75.768502,
    waypointIndex: 1472,
    highlight: 'La gran meta del Reto Ebéjico',
    shortDesc: 'Plaza centenaria flanqueada por ceibas y balcones coloniales de madera de cedro.',
    fullDesc:
      'La meta final del viaje. Una plaza arbolada con ceibas y palmas a 1.141 msnm, custodiada por la Parroquia Nuestra Señora de los Dolores y casonas de dos pisos con balcones tallados en cedro. Es el templo donde culmina cada año el festival de carros de rodillos entre aplausos, empanadas de iglesia y café recién tostado. ¡Has conquistado el Reto Ebéjico!',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=6.3264186,-75.768502',
  },
];

/**
 * Busca si el vehículo está en las inmediaciones de un punto turístico clave (a +/- 12 waypoints, ~180 m).
 */
export function getNearbyTouristSpot(segmentIndex: number, threshold = 12): TouristSpot | null {
  for (const spot of TOURIST_SPOTS) {
    if (Math.abs(segmentIndex - spot.waypointIndex) <= threshold) {
      return spot;
    }
  }
  return null;
}
