import type { IndexItem } from './types';

const createUniqueIds = (items: IndexItem[], parentId = ''): IndexItem[] => {
  return items.map(item => {
    const idPart = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const uniqueId = parentId ? `${parentId}-${idPart}` : item.id;
    const newItem: IndexItem = { ...item, id: uniqueId };
    if (item.children) {
      newItem.children = createUniqueIds(item.children, uniqueId);
    }
    return newItem;
  });
};

const originalIndex: IndexItem[] = [
  {
    id: 'cap1-senales-y-sistemas',
    title: '1. Señales y Sistemas',
    children: [
      { id: 'introduccion', title: '1.1 Introducción' },
      { id: 'senales-continuas-discretas', title: '1.2 Señales continuas y discretas' },
      { id: 'ejemplos-representacion-matematica', title: '1.3 Ejemplos y representación matemática de señales' },
      { id: 'senales-energia-potencia', title: '1.4 Señales de energía y señales de potencia' },
      { id: 'transformaciones-variable-independiente', title: '1.5 Transformaciones de la variable independiente' },
      { id: 'senales-exponenciales-senoidales', title: '1.6 Señales exponenciales y senoidales' },
      { id: 'funciones-impulso-escalon', title: '1.7 Funciones impulso unitario y escalón unitario' },
      { id: 'sistemas-continuos-discretos', title: '1.8 Sistemas continuos y discretos' },
      { id: 'propiedades-basicas-sistemas', title: '1.9 Propiedades básicas de los sistemas' },
      { id: 'resumen-problemas-1', title: '1.10 Resumen y problemas' },
    ],
  },
  {
    id: 'cap2-sistemas-lti',
    title: '2. Sistemas Lineales Invariantes en el Tiempo',
    children: [
      { id: 'introduccion-lti', title: '2.1 Introducción' },
      { id: 'lti-discretos-suma-convolucion', title: '2.2 Sistemas LTI discretos: suma de convolución' },
      { id: 'lti-continuos-integral-convolucion', title: '2.3 Sistemas LTI continuos: integral de convolución' },
      { id: 'propiedades-sistemas-lti', title: '2.4 Propiedades de los sistemas lineales e invariantes en el tiempo' },
      { id: 'lti-causales-ecuaciones-diferenciales', title: '2.5 Sistemas LTI causales descritos por ecuaciones diferenciales y de diferencias' },
      { id: 'funciones-singulares', title: '2.6 Funciones singulares' },
      { id: 'resumen-problemas-2', title: '2.7 Resumen y problemas' },
    ],
  },
  {
    id: 'cap3-series-fourier',
    title: '3. Representación de Señales Periódicas en Series de Fourier',
    children: [
      { id: 'introduccion-perspectiva-historica', title: '3.1 Introducción y perspectiva histórica' },
      { id: 'respuesta-lti-exponenciales-complejas', title: '3.2 Respuesta de sistemas LTI a exponenciales complejas' },
      { id: 'series-fourier-continuas', title: '3.3 Series de Fourier para señales periódicas continuas' },
      { id: 'convergencia-series-fourier', title: '3.4 Convergencia de las series de Fourier' },
      { id: 'propiedades-serie-continua-fourier', title: '3.5 Propiedades de la serie continua de Fourier' },
      { id: 'series-fourier-discretas', title: '3.6 Series de Fourier para señales periódicas discretas' },
      { id: 'propiedades-serie-discreta-fourier', title: '3.7 Propiedades de la serie discreta de Fourier' },
      { id: 'series-fourier-sistemas-lti', title: '3.8 Series de Fourier y sistemas LTI' },
      { id: 'filtrado', title: '3.9 Filtrado' },
      { id: 'resumen-problemas-3', title: '3.10 Resumen y problemas' },
    ],
  },
  {
    id: 'cap4-transformada-continua-fourier',
    title: '4. La Transformada Continua de Fourier',
    children: [
      { id: 'introduccion-tcf', title: '4.1 Introducción' },
      { id: 'representacion-senales-aperiodicas-tcf', title: '4.2 Representación de señales aperiódicas mediante la transformada continua de Fourier' },
      { id: 'transformada-fourier-senales-periodicas', title: '4.3 Transformada de Fourier para señales periódicas' },
      { id: 'propiedades-transformada-continua-fourier', title: '4.4 Propiedades de la transformada continua de Fourier' },
      { id: 'propiedad-convolucion-tcf', title: '4.5 Propiedad de convolución' },
      { id: 'propiedad-multiplicacion-tcf', title: '4.6 Propiedad de multiplicación' },
      { id: 'tablas-propiedades-pares-tcf', title: '4.7 Tablas de propiedades y pares básicos de transformadas' },
      { id: 'sistemas-ecuaciones-diferenciales-tcf', title: '4.8 Sistemas descritos por ecuaciones diferenciales lineales con coeficientes constantes' },
      { id: 'resumen-problemas-4', title: '4.9 Resumen y problemas' },
    ],
  },
  {
    id: 'cap5-transformada-fourier-discreta',
    title: '5. La Transformada de Fourier de Tiempo Discreto',
    children: [
      { id: 'introduccion-tftd', title: '5.1 Introducción' },
      { id: 'representacion-senales-aperiodicas-tftd', title: '5.2 Representación de señales aperiódicas mediante la transformada de Fourier de tiempo discreto' },
      { id: 'transformada-fourier-periodicas-discretas', title: '5.3 Transformada de Fourier para señales periódicas discretas' },
      { id: 'propiedades-tftd', title: '5.4 Propiedades de la transformada de Fourier de tiempo discreto' },
      { id: 'propiedad-convolucion-tftd', title: '5.5 Propiedad de convolución' },
      { id: 'propiedad-multiplicacion-tftd', title: '5.6 Propiedad de multiplicación' },
      { id: 'tablas-propiedades-pares-tftd', title: '5.7 Tablas de propiedades y pares básicos' },
      { id: 'dualidad', title: '5.8 Dualidad' },
      { id: 'sistemas-ecuaciones-diferencias-tftd', title: '5.9 Sistemas descritos por ecuaciones en diferencias lineales con coeficientes constantes' },
      { id: 'resumen-problemas-5', title: '5.10 Resumen y problemas' },
    ],
  },
  {
    id: 'cap6-caracterizacion-tiempo-frecuencia',
    title: '6. Caracterización en Tiempo y Frecuencia de Señales y Sistemas',
    children: [
      { id: 'introduccion-ctf', title: '6.1 Introducción' },
      { id: 'representacion-magnitud-fase-transformada', title: '6.2 Representación magnitud-fase de la transformada de Fourier' },
      { id: 'representacion-magnitud-fase-respuesta-frecuencia', title: '6.3 Representación magnitud-fase de la respuesta en frecuencia de sistemas LTI' },
      { id: 'propiedades-temporales-filtros-ideales', title: '6.4 Propiedades temporales de filtros ideales selectivos en frecuencia' },
      { id: 'aspectos-temporales-frecuenciales-filtros-no-ideales', title: '6.5 Aspectos temporales y frecuenciales de filtros no ideales' },
      { id: 'sistemas-continuos-primer-segundo-orden', title: '6.6 Sistemas continuos de primer y segundo orden' },
      { id: 'sistemas-discretos-primer-segundo-orden', title: '6.7 Sistemas discretos de primer y segundo orden' },
      { id: 'resumen-problemas-6', title: '6.8 Resumen y problemas' },
    ],
  },
  {
    id: 'cap7-muestreo',
    title: '7. Muestreo',
    children: [
      { id: 'introduccion-muestreo', title: '7.1 Introducción' },
      { id: 'representacion-senal-continua-muestras', title: '7.2 Representación de una señal continua mediante sus muestras' },
      { id: 'teorema-muestreo', title: '7.3 Teorema de muestreo' },
      { id: 'reconstruccion-senales-interpolacion', title: '7.4 Reconstrucción de señales mediante interpolación' },
      { id: 'efecto-submuestreo-aliasing', title: '7.5 Efecto del submuestreo: aliasing o traslape espectral' },
      { id: 'procesamiento-discreto-senales-continuas', title: '7.6 Procesamiento discreto de señales continuas' },
      { id: 'muestreo-senales-discretas', title: '7.7 Muestreo de señales discretas' },
      { id: 'resumen-problemas-7', title: '7.8 Resumen y problemas' },
    ],
  },
  {
    id: 'cap8-sistemas-comunicacion',
    title: '8. Sistemas de Comunicación',
    children: [
      { id: 'introduccion-comunicacion', title: '8.1 Introducción' },
      { id: 'modulacion-amplitud-exponencial-senoidal', title: '8.2 Modulación de amplitud con exponencial compleja y senoidal' },
      { id: 'demodulacion-am-senoidal', title: '8.3 Demodulación para AM senoidal' },
      { id: 'multiplexaje-division-frecuencia', title: '8.4 Multiplexaje por división de frecuencia' },
      { id: 'modulacion-amplitud-banda-lateral-unica', title: '8.5 Modulación de amplitud de banda lateral única' },
      { id: 'modulacion-portadora-tren-pulsos', title: '8.6 Modulación con portadora de tren de pulsos' },
      { id: 'modulacion-amplitud-pulsos', title: '8.7 Modulación de amplitud de pulsos' },
      { id: 'modulacion-frecuencia-senoidal', title: '8.8 Modulación de frecuencia senoidal' },
      { id: 'modulacion-discreta', title: '8.9 Modulación discreta' },
      { id: 'resumen-problemas-8', title: '8.10 Resumen y problemas' },
    ],
  },
  {
    id: 'cap9-transformada-laplace',
    title: '9. La Transformada de Laplace',
    children: [
      { id: 'introduccion-laplace', title: '9.1 Introducción' },
      { id: 'transformada-laplace', title: '9.2 Transformada de Laplace' },
      { id: 'region-convergencia-laplace', title: '9.3 Región de convergencia' },
      { id: 'transformada-inversa-laplace', title: '9.4 Transformada inversa de Laplace' },
      { id: 'evaluacion-geometrica-fourier-polos-ceros-laplace', title: '9.5 Evaluación geométrica de la transformada de Fourier usando polos y ceros' },
      { id: 'propiedades-transformada-laplace', title: '9.6 Propiedades de la transformada de Laplace' },
      { id: 'pares-comunes-transformada-laplace', title: '9.7 Pares comunes de transformada de Laplace' },
      { id: 'analisis-caracterizacion-lti-laplace', title: '9.8 Análisis y caracterización de sistemas LTI usando Laplace' },
      { id: 'algebra-funcion-sistema-diagramas-bloques-laplace', title: '9.9 Álgebra de la función del sistema y diagramas de bloques' },
      { id: 'transformada-unilateral-laplace', title: '9.10 Transformada unilateral de Laplace' },
      { id: 'resumen-problemas-9', title: '9.11 Resumen y problemas' },
    ],
  },
  {
    id: 'cap10-transformada-z',
    title: '10. La Transformada Z',
    children: [
      { id: 'introduccion-z', title: '10.1 Introducción' },
      { id: 'transformada-z', title: '10.2 Transformada Z' },
      { id: 'region-convergencia-z', title: '10.3 Región de convergencia de la transformada Z' },
      { id: 'transformada-z-inversa', title: '10.4 Transformada Z inversa' },
      { id: 'evaluacion-geometrica-fourier-polos-ceros-z', title: '10.5 Evaluación geométrica de la transformada de Fourier usando polos y ceros' },
      { id: 'propiedades-transformada-z', title: '10.6 Propiedades de la transformada Z' },
      { id: 'pares-comunes-transformada-z', title: '10.7 Pares comunes de transformada Z' },
      { id: 'analisis-caracterizacion-lti-z', title: '10.8 Análisis y caracterización de sistemas LTI usando transformada Z' },
      { id: 'algebra-funcion-sistema-diagramas-bloques-z', title: '10.9 Álgebra de la función del sistema y representación mediante diagramas de bloques' },
      { id: 'transformada-z-unilateral', title: '10.10 Transformada Z unilateral' },
      { id: 'resumen-problemas-10', title: '10.11 Resumen y problemas' },
    ],
  },
  {
    id: 'cap11-sistemas-retroalimentados',
    title: '11. Sistemas Lineales Retroalimentados',
    children: [
      { id: 'introduccion-retroalimentacion', title: '11.1 Introducción' },
      { id: 'sistemas-lineales-retroalimentados', title: '11.2 Sistemas lineales retroalimentados' },
      { id: 'aplicaciones-consecuencias-retroalimentacion', title: '11.3 Aplicaciones y consecuencias de la retroalimentación' },
      { id: 'analisis-lugar-geometrico-raices', title: '11.4 Análisis del lugar geométrico de las raíces' },
      { id: 'criterio-estabilidad-nyquist', title: '11.5 Criterio de estabilidad de Nyquist' },
      { id: 'margenes-ganancia-fase', title: '11.6 Márgenes de ganancia y fase' },
      { id: 'resumen-problemas-11', title: '11.7 Resumen y problemas' },
    ],
  },
];

export const INDEX: IndexItem[] = createUniqueIds(originalIndex);
