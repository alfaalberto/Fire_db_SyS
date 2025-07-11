
import type { IndexItem } from '@/lib/types';

export const bookIndex: IndexItem[] = [
  {
    id: '1',
    title: 'Capítulo 1: SEÑALES Y SISTEMAS',
    children: [
      { id: '1.0', title: '1.0 Introducción' },
      {
        id: '1.1',
        title: '1.1 Señales continuas y discretas',
        children: [
            { id: '1.1.1', title: '1.1.1 Ejemplos y representación matemática' },
            { id: '1.1.2', title: '1.1.2 Señales de energía y de potencia' },
        ]
      },
      {
        id: '1.2',
        title: '1.2 Transformaciones de la variable independiente',
        children: [
            { id: '1.2.1', title: '1.2.1 Ejemplos de transformaciones' },
            { id: '1.2.2', title: '1.2.2 Señales periódicas' },
            { id: '1.2.3', title: '1.2.3 Señales pares e impares' },
        ]
      },
       {
        id: '1.3',
        title: '1.3 Señales exponenciales y senoidales',
        children: [
            { id: '1.3.1', title: '1.3.1 Exponenciales y senoides continuas' },
            { id: '1.3.2', title: '1.3.2 Exponenciales y senoides discretas' },
            { id: '1.3.3', title: '1.3.3 Periodicidad de exponenciales discretas' },
        ]
      },
      {
        id: '1.4',
        title: '1.4 Funciones impulso y escalón unitario',
        children: [
            { id: '1.4.1', title: '1.4.1 Impulso y escalón unitario discretos' },
            { id: '1.4.2', title: '1.4.2 Impulso y escalón unitario continuos' },
        ]
      },
      {
        id: '1.5',
        title: '1.5 Sistemas continuos y discretos',
        children: [
            { id: '1.5.1', title: '1.5.1 Ejemplos de sistemas' },
            { id: '1.5.2', title: '1.5.2 Interconexión de sistemas' },
        ]
      },
      {
        id: '1.6',
        title: '1.6 Propiedades básicas de los sistemas',
        children: [
            { id: '1.6.1', title: '1.6.1 Sistemas con y sin memoria' },
            { id: '1.6.2', title: '1.6.2 Invertibilidad y sistemas inversos' },
            { id: '1.6.3', title: '1.6.3 Causalidad' },
            { id: '1.6.4', title: '1.6.4 Estabilidad' },
            { id: '1.6.5', title: '1.6.5 Invariancia en el tiempo' },
            { id: '1.6.6', title: '1.6.6 Linealidad' },
        ]
      },
      { id: '1.7', title: '1.7 Resumen' },
    ],
  },
  {
    id: '2',
    title: 'Capítulo 2: SISTEMAS LTI',
    children: [
      { id: '2.0', title: '2.0 Introducción' },
      {
        id: '2.1',
        title: '2.1 Sistemas LTI discretos: Suma de convolución',
        children: [
            { id: '2.1.1', title: '2.1.1 Representación de señales en impulsos' },
            { id: '2.1.2', title: '2.1.2 Respuesta al impulso y convolución' },
        ]
      },
      {
        id: '2.2',
        title: '2.2 Sistemas LTI continuos: Integral de convolución',
        children: [
            { id: '2.2.1', title: '2.2.1 Representación de señales en impulsos' },
            { id: '2.2.2', title: '2.2.2 Respuesta al impulso y convolución' },
        ]
      },
      {
        id: '2.3',
        title: '2.3 Propiedades de los sistemas LTI',
        children: [
            { id: '2.3.1', title: '2.3.1 Propiedad conmutativa' },
            { id: '2.3.2', title: '2.3.2 Propiedad distributiva' },
            { id: '2.3.3', title: '2.3.3 Propiedad asociativa' },
            { id: '2.3.4', title: '2.3.4 Sistemas con y sin memoria' },
            { id: '2.3.5', title: '2.3.5 Invertibilidad' },
            { id: '2.3.6', title: '2.3.6 Causalidad' },
            { id: '2.3.7', title: '2.3.7 Estabilidad' },
            { id: '2.3.8', title: '2.3.8 Respuesta al escalón' },
        ]
       },
       {
        id: '2.4',
        title: '2.4 Ecuaciones diferenciales y de diferencias',
        children: [
            { id: '2.4.1', title: '2.4.1 Ecuaciones diferenciales' },
            { id: '2.4.2', title: '2.4.2 Ecuaciones de diferencias' },
            { id: '2.4.3', title: '2.4.3 Diagramas de bloques' },
        ]
       },
       {
        id: '2.5',
        title: '2.5 Funciones singulares',
        children: [
            { id: '2.5.1', title: '2.5.1 Impulso como pulso idealizado' },
            { id: '2.5.2', title: '2.5.2 Impulso mediante convolución' },
            { id: '2.5.3', title: '2.5.3 Dobletes unitarios' },
        ]
       },
       { id: '2.6', title: '2.6 Resumen' },
    ],
  },
   {
    id: '3',
    title: 'Capítulo 3: SERIES DE FOURIER',
    children: [
      { id: '3.0', title: '3.0 Introducción' },
      { id: '3.1', title: '3.1 Perspectiva histórica' },
      { id: '3.2', title: '3.2 Respuesta de LTI a exponenciales' },
      {
        id: '3.3',
        title: '3.3 Series de Fourier continuas',
        children: [
            { id: '3.3.1', title: '3.3.1 Combinaciones lineales de exponenciales' },
            { id: '3.3.2', title: '3.3.2 Determinación de las series de Fourier' },
        ]
      },
      { id: '3.4', title: '3.4 Convergencia de las series de Fourier' },
      {
        id: '3.5',
        title: '3.5 Propiedades de las series de Fourier continuas',
        children: [
            { id: '3.5.1', title: '3.5.1 Linealidad' },
            { id: '3.5.2', title: '3.5.2 Desplazamiento en tiempo' },
            { id: '3.5.3', title: '3.5.3 Inversión de tiempo' },
            { id: '3.5.4', title: '3.5.4 Escalamiento de tiempo' },
            { id: '3.5.5', title: '3.5.5 Multiplicación' },
            { id: '3.5.6', title: '3.5.6 Conjugación y simetría' },
            { id: '3.5.7', title: '3.5.7 Relación de Parseval' },
            { id: '3.5.8', title: '3.5.8 Resumen de propiedades' },
            { id: '3.5.9', title: '3.5.9 Ejemplos' },
        ]
      },
      {
        id: '3.6',
        title: '3.6 Series de Fourier discretas',
         children: [
            { id: '3.6.1', title: '3.6.1 Combinaciones lineales de exponenciales' },
            { id: '3.6.2', title: '3.6.2 Determinación de las series de Fourier' },
        ]
      },
      {
        id: '3.7',
        title: '3.7 Propiedades de las series de Fourier discretas',
        children: [
            { id: '3.7.1', title: '3.7.1 Multiplicación' },
            { id: '3.7.2', title: '3.7.2 Primera diferencia' },
            { id: '3.7.3', title: '3.7.3 Relación de Parseval' },
            { id: '3.7.4', title: '3.7.4 Ejemplos' },
        ]
      },
      { id: '3.8', title: '3.8 Series de Fourier y sistemas LTI' },
      {
        id: '3.9',
        title: '3.9 Filtrado',
        children: [
            { id: '3.9.1', title: '3.9.1 Filtros conformadores de frecuencia' },
            { id: '3.9.2', title: '3.9.2 Filtros selectivos en frecuencia' },
        ]
      },
       {
        id: '3.10',
        title: '3.10 Ejemplos de filtros continuos',
        children: [
            { id: '3.10.1', title: '3.10.1 Filtro paso bajas RC' },
            { id: '3.10.2', title: '3.10.2 Filtro paso altas RC' },
        ]
      },
       {
        id: '3.11',
        title: '3.11 Ejemplos de filtros discretos',
        children: [
            { id: '3.11.1', title: '3.11.1 Filtros recursivos de primer orden' },
            { id: '3.11.2', title: '3.11.2 Filtros no recursivos' },
        ]
      },
      { id: '3.12', title: '3.12 Resumen' },
    ],
  },
  {
    id: '4',
    title: 'Capítulo 4: TRANSFORMADA DE FOURIER CONTINUA',
    children: [
      { id: '4.0', title: '4.0 Introducción' },
      {
        id: '4.1',
        title: '4.1 Representación de señales aperiódicas',
        children: [
            { id: '4.1.1', title: '4.1.1 Desarrollo de la transformada' },
            { id: '4.1.2', title: '4.1.2 Convergencia' },
            { id: '4.1.3', title: '4.1.3 Ejemplos' },
        ]
      },
      { id: '4.2', title: '4.2 Transformada de Fourier para señales periódicas' },
      {
        id: '4.3',
        title: '4.3 Propiedades de la transformada continua',
        children: [
            { id: '4.3.1', title: '4.3.1 Linealidad' },
            { id: '4.3.2', title: '4.3.2 Desplazamiento de tiempo' },
            { id: '4.3.3', title: '4.3.3 Conjugación y simetría' },
            { id: '4.3.4', title: '4.3.4 Diferenciación e integración' },
            { id: '4.3.5', title: '4.3.5 Dualidad' },
            { id: '4.3.6', title: '4.3.6 Escalamiento' },
            { id: '4.3.7', title: '4.3.7 Relación de Parseval' },
        ]
      },
      { id: '4.4', title: '4.4 Propiedad de convolución',
        children: [{ id: '4.4.1', title: '4.4.1 Ejemplos' }]
      },
      { id: '4.5', title: '4.5 Propiedad de multiplicación',
        children: [{ id: '4.5.1', title: '4.5.1 Filtrado con frecuencia variable' }]
      },
      { id: '4.6', title: '4.6 Tablas de propiedades y pares' },
      { id: '4.7', title: '4.7 Sistemas con ecuaciones diferenciales' },
      { id: '4.8', title: '4.8 Resumen' },
    ],
  },
  {
    id: '5',
    title: 'Capítulo 5: TRANSFORMADA DE FOURIER DISCRETA',
    children: [
      { id: '5.0', title: '5.0 Introducción' },
      {
        id: '5.1',
        title: '5.1 Representación de señales aperiódicas',
        children: [
            { id: '5.1.1', title: '5.1.1 Desarrollo de la transformada' },
            { id: '5.1.2', title: '5.1.2 Ejemplos' },
            { id: '5.1.3', title: '5.1.3 Problemas de convergencia' },
        ]
      },
      { id: '5.2', title: '5.2 Transformada de Fourier para señales periódicas' },
      {
        id: '5.3',
        title: '5.3 Propiedades de la transformada discreta',
        children: [
            { id: '5.3.1', title: '5.3.1 Periodicidad' },
            { id: '5.3.2', title: '5.3.2 Linealidad' },
            { id: '5.3.3', title: '5.3.3 Desplazamiento de tiempo y frecuencia' },
            { id: '5.3.4', title: '5.3.4 Conjugación y simetría' },
            { id: '5.3.5', title: '5.3.5 Diferenciación en frecuencia' },
            { id: '5.3.6', title: '5.3.6 Inversión en tiempo' },
            { id: '5.3.7', title: '5.3.7 Expansión en tiempo' },
            { id: '5.3.9', title: '5.3.9 Relación de Parseval' },
        ]
      },
      { id: '5.4', title: '5.4 Propiedad de convolución',
        children: [{ id: '5.4.1', title: '5.4.1 Ejemplos' }]
      },
      { id: '5.5', title: '5.5 Propiedad de multiplicación' },
      { id: '5.6', title: '5.6 Tablas de propiedades y pares' },
      { id: '5.7', title: '5.7 Dualidad',
        children: [
            { id: '5.7.1', title: '5.7.1 Dualidad en series discretas' },
            { id: '5.7.2', title: '5.7.2 Dualidad TDF y SFC' },
        ]
      },
      { id: '5.8', title: '5.8 Sistemas con ecuaciones de diferencias' },
      { id: '5.9', title: '5.9 Resumen' },
    ],
  },
   {
    id: '6',
    title: 'Capítulo 6: CARACTERIZACIÓN TIEMPO-FRECUENCIA',
    children: [
      { id: '6.0', title: '6.0 Introducción' },
      { id: '6.1', title: '6.1 Representación magnitud-fase de la T.F.' },
       {
        id: '6.2',
        title: '6.2 Representación magnitud-fase de la respuesta en frecuencia',
        children: [
            { id: '6.2.1', title: '6.2.1 Fase lineal y no lineal' },
            { id: '6.2.2', title: '6.2.2 Retardo de grupo' },
            { id: '6.2.3', title: '6.2.3 Diagramas de Bode' },
        ]
      },
      { id: '6.3', title: '6.3 Propiedades de filtros ideales' },
      { id: '6.4', title: '6.4 Aspectos de filtros no ideales' },
       {
        id: '6.5',
        title: '6.5 Sistemas continuos de 1er y 2do orden',
        children: [
            { id: '6.5.1', title: '6.5.1 Sistemas de primer orden' },
            { id: '6.5.2', title: '6.5.2 Sistemas de segundo orden' },
            { id: '6.5.3', title: '6.5.3 Diagramas de Bode para respuestas racionales' },
        ]
      },
       {
        id: '6.6',
        title: '6.6 Sistemas discretos de 1er y 2do orden',
        children: [
            { id: '6.6.1', title: '6.6.1 Sistemas de primer orden' },
            { id: '6.6.2', title: '6.6.2 Sistemas de segundo orden' },
        ]
      },
      {
        id: '6.7',
        title: '6.7 Ejemplos de análisis tiempo-frecuencia',
        children: [
            { id: '6.7.1', title: '6.7.1 Sistema de suspensión de automóvil' },
            { id: '6.7.2', title: '6.7.2 Filtros discretos no recursivos' },
        ]
       },
      { id: '6.8', title: '6.8 Resumen' },
    ],
  },
  {
    id: '7',
    title: 'Capítulo 7: MUESTREO',
    children: [
      { id: '7.0', title: '7.0 Introducción' },
      {
        id: '7.1',
        title: '7.1 Teorema de muestreo',
        children: [
            { id: '7.1.1', title: '7.1.1 Muestreo con tren de impulsos' },
            { id: '7.1.2', title: '7.1.2 Muestreo con retenedor de orden cero' },
        ]
      },
      { id: '7.2', title: '7.2 Reconstrucción con interpolación' },
      { id: '7.3', title: '7.3 El efecto de submuestreo: Aliasing' },
      {
        id: '7.4',
        title: '7.4 Procesamiento discreto de señales continuas',
        children: [
            { id: '7.4.1', title: '7.4.1 Diferenciador digital' },
            { id: '7.4.2', title: '7.4.2 Retardo de media muestra' },
        ]
      },
      {
        id: '7.5',
        title: '7.5 Muestreo de señales de tiempo discreto',
        children: [
          { id: '7.5.1', title: '7.5.1 Muestreo con tren de impulsos' },
        ]
      },
       { id: '7.6', title: '7.6 Decimación e interpolación' },
       { id: '7.7', title: '7.7 Resumen' },
    ],
  },
   {
    id: '8',
    title: 'Capítulo 8: SISTEMAS DE COMUNICACIÓN',
    children: [
      { id: '8.0', title: '8.0 Introducción' },
      {
        id: '8.1',
        title: '8.1 Modulación de amplitud',
        children: [
            { id: '8.1.1', title: '8.1.1 Modulación con portadora exponencial' },
            { id: '8.1.2', title: '8.1.2 Modulación con portadora senoidal' },
        ]
      },
      {
        id: '8.2',
        title: '8.2 Demodulación para AM senoidal',
        children: [
            { id: '8.2.1', title: '8.2.1 Demodulación síncrona' },
            { id: '8.2.2', title: '8.2.2 Demodulación asíncrona' },
        ]
      },
      { id: '8.3', title: '8.3 Multiplexaje por división de frecuencia (FDM)' },
      { id: '8.4', title: '8.4 Modulación de banda lateral única (SSB)' },
      {
        id: '8.5',
        title: '8.5 Modulación con tren de pulsos',
        children: [
            { id: '8.5.1', title: '8.5.1 Modulación de portadora de tren de pulsos' },
            { id: '8.5.2', title: '8.5.2 Multiplexaje por división de tiempo (TDM)' },
        ]
      },
      {
        id: '8.6',
        title: '8.6 Modulación de amplitud de pulsos (PAM)',
        children: [
            { id: '8.6.1', title: '8.6.1 Señales PAM' },
            { id: '8.6.2', title: '8.6.2 Interferencia intersímbolo (ISI)' },
            { id: '8.6.3', title: '8.6.3 Modulación digital (PCM)' },
        ]
      },
       {
        id: '8.7',
        title: '8.7 Modulación de frecuencia (FM)',
        children: [
            { id: '8.7.1', title: '8.7.1 FM de banda angosta' },
            { id: '8.7.2', title: '8.7.2 FM de banda ancha' },
            { id: '8.7.3', title: '8.7.3 Señal moduladora cuadrada' },
        ]
      },
       {
        id: '8.8',
        title: '8.8 Modulación discreta',
        children: [
            { id: '8.8.1', title: '8.8.1 Modulación de amplitud senoidal discreta' },
            { id: '8.8.2', title: '8.8.2 Transmodulación discreta' },
        ]
      },
      { id: '8.9', title: '8.9 Resumen' },
    ],
  },
  {
    id: '9',
    title: 'Capítulo 9: TRANSFORMADA DE LAPLACE',
    children: [
      { id: '9.0', title: '9.0 Introducción' },
      { id: '9.1', title: '9.1 La transformada de Laplace' },
      { id: '9.2', title: '9.2 Región de convergencia (ROC)' },
      { id: '9.3', title: '9.3 Transformada inversa de Laplace' },
      {
        id: '9.4',
        title: '9.4 Evaluación geométrica desde diagrama de polos y ceros',
        children: [
            { id: '9.4.1', title: '9.4.1 Sistemas de primer orden' },
            { id: '9.4.2', title: '9.4.2 Sistemas de segundo orden' },
            { id: '9.4.3', title: '9.4.3 Sistemas paso-todo' },
        ]
      },
      {
        id: '9.5',
        title: '9.5 Propiedades de la transformada de Laplace',
        children: [
            { id: '9.5.1', title: '9.5.1 Linealidad' },
            { id: '9.5.2', title: '9.5.2 Desplazamiento en tiempo' },
            { id: '9.5.3', title: '9.5.3 Desplazamiento en s' },
            { id: '9.5.4', title: '9.5.4 Escalamiento en tiempo' },
            { id: '9.5.5', title: '9.5.5 Conjugación' },
            { id: '9.5.6', title: '9.5.6 Convolución' },
            { id: '9.5.7', title: '9.5.7 Diferenciación en s' },
            { id: '9.5.8', title: '9.5.8 Diferenciación en tiempo' },
            { id: '9.5.9', title: '9.5.9 Integración en tiempo' },
            { id: '9.5.10', title: '9.5.10 Teoremas de valor inicial y final' },
            { id: '9.5.11', title: '9.5.11 Tabla de propiedades' },
        ]
      },
      { id: '9.6', title: '9.6 Pares comunes de transformada de Laplace' },
      {
        id: '9.7',
        title: '9.7 Análisis de sistemas LTI con Laplace',
        children: [
            { id: '9.7.1', title: '9.7.1 Causalidad' },
            { id: '9.7.2', title: '9.7.2 Estabilidad' },
            { id: '9.7.3', title: '9.7.3 Sistemas con ecuaciones diferenciales' },
            { id: '9.7.4', title: '9.7.4 Ejemplos de comportamiento del sistema' },
            { id: '9.7.5', title: '9.7.5 Filtros Butterworth' },
        ]
      },
      {
        id: '9.8',
        title: '9.8 Álgebra de función de sistema y diagramas de bloques',
        children: [
            { id: '9.8.1', title: '9.8.1 Interconexiones de sistemas LTI' },
            { id: '9.8.2', title: '9.8.2 Diagramas de bloques para sistemas causales' },
        ]
      },
      {
        id: '9.9',
        title: '9.9 Transformada unilateral de Laplace',
        children: [
            { id: '9.9.1', title: '9.9.1 Ejemplos' },
            { id: '9.9.2', title: '9.9.2 Propiedades' },
            { id: '9.9.3', title: '9.9.3 Solución de ecuaciones diferenciales' },
        ]
      },
      { id: '9.10', title: '9.10 Resumen' },
    ],
  },
  {
    id: '10',
    title: 'Capítulo 10: TRANSFORMADA Z',
    children: [
      { id: '10.0', title: '10.0 Introducción' },
      { id: '10.1', title: '10.1 La transformada z' },
      { id: '10.2', title: '10.2 Región de convergencia (ROC)' },
      { id: '10.3', title: '10.3 Transformada z inversa' },
      {
        id: '10.4',
        title: '10.4 Evaluación geométrica desde diagrama de polos y ceros',
        children: [
            { id: '10.4.1', title: '10.4.1 Sistemas de primer orden' },
            { id: '10.4.2', title: '10.4.2 Sistemas de segundo orden' },
        ]
      },
      {
        id: '10.5',
        title: '10.5 Propiedades de la transformada z',
        children: [
            { id: '10.5.1', title: '10.5.1 Linealidad' },
            { id: '10.5.2', title: '10.5.2 Desplazamiento en tiempo' },
            { id: '10.5.3', title: '10.5.3 Escalamiento en z' },
            { id: '10.5.4', title: '10.5.4 Inversión de tiempo' },
            { id: '10.5.5', title: '10.5.5 Expansión en tiempo' },
            { id: '10.5.6', title: '10.5.6 Conjugación' },
            { id: '10.5.7', title: '10.5.7 Convolución' },
            { id: '10.5.8', title: '10.5.8 Diferenciación en z' },
            { id: '10.5.9', title: '10.5.9 Teorema del valor inicial' },
            { id: '10.5.10', title: '10.5.10 Resumen de propiedades' },
        ]
      },
      { id: '10.6', title: '10.6 Pares comunes de transformada z' },
      {
        id: '10.7',
        title: '10.7 Análisis de sistemas LTI con transformada z',
        children: [
            { id: '10.7.1', title: '10.7.1 Causalidad' },
            { id: '10.7.2', title: '10.7.2 Estabilidad' },
            { id: '10.7.3', title: '10.7.3 Sistemas con ecuaciones de diferencias' },
            { id: '10.7.4', title: '10.7.4 Ejemplos de comportamiento del sistema' },
        ]
      },
      {
        id: '10.8',
        title: '10.8 Álgebra de función de sistema y diagramas de bloques',
        children: [
            { id: '10.8.1', title: '10.8.1 Interconexiones de sistemas LTI' },
            { id: '10.8.2', title: '10.8.2 Diagramas de bloques para sistemas causales' },
        ]
      },
      {
        id: '10.9',
        title: '10.9 Transformada z unilateral',
        children: [
            { id: '10.9.1', title: '10.9.1 Ejemplos' },
            { id: '10.9.2', title: '10.9.2 Propiedades' },
            { id: '10.9.3', title: '10.9.3 Solución de ecuaciones de diferencias' },
        ]
      },
      { id: '10.10', title: '10.10 Resumen' },
    ],
  },
  {
    id: '11',
    title: 'Capítulo 11: SISTEMAS LINEALES RETROALIMENTADOS',
    children: [
      { id: '11.0', title: '11.0 Introducción' },
      { id: '11.1', title: '11.1 Sistemas lineales retroalimentados' },
      {
        id: '11.2',
        title: '11.2 Aplicaciones de la retroalimentación',
        children: [
            { id: '11.2.1', title: '11.2.1 Diseño de un sistema inverso' },
            { id: '11.2.2', title: '11.2.2 Compensación de elementos no ideales' },
            { id: '11.2.3', title: '11.2.3 Estabilización de sistemas inestables' },
            { id: '11.2.4', title: '11.2.4 Sistemas para datos muestreados' },
            { id: '11.2.5', title: '11.2.5 Sistemas de rastreo' },
            { id: '11.2.6', title: '11.2.6 Desestabilización por retroalimentación' },
        ]
      },
      {
        id: '11.3',
        title: '11.3 Análisis del lugar geométrico de las raíces',
        children: [
            { id: '11.3.1', title: '11.3.1 Ejemplo introductorio' },
            { id: '11.3.2', title: '11.3.2 Ecuación para polos de lazo cerrado' },
            { id: '11.3.3', title: '11.3.3 Puntos extremos del lugar geométrico' },
            { id: '11.3.4', title: '11.3.4 El criterio del ángulo' },
            { id: '11.3.5', title: '11.3.5 Propiedades del lugar geométrico' },
        ]
      },
      {
        id: '11.4',
        title: '11.4 Criterio de estabilidad de Nyquist',
        children: [
            { id: '11.4.1', title: '11.4.1 La propiedad de circulación' },
            { id: '11.4.2', title: '11.4.2 Criterio de Nyquist para sistemas continuos' },
            { id: '11.4.3', title: '11.4.3 Criterio de Nyquist para sistemas discretos' },
        ]
      },
      { id: '11.5', title: '11.5 Márgenes de ganancia y fase' },
      { id: '11.6', title: '11.6 Resumen' },
    ],
  },
];
