
import type { IndexItem } from '@/lib/types';

export const bookIndex: IndexItem[] = [
  {
    id: '1',
    title: 'Capítulo 1: Señales y Sistemas',
    children: [
      { id: '1.1', title: 'Introducción' },
      {
        id: '1.2',
        title: 'Señales de tiempo continuo y tiempo discreto',
        children: [
            { id: '1.2.1', title: 'Ejemplos y representación matemática' },
            { id: '1.2.2', title: 'Energía y potencia de la señal' },
        ]
      },
      {
        id: '1.3',
        title: 'Transformaciones de la variable independiente',
        children: [
            { id: '1.3.1', title: 'Ejemplos de transformaciones' },
            { id: '1.3.2', title: 'Señales periódicas' },
            { id: '1.3.3', title: 'Señales pares e impares' },
        ]
      },
      {
        id: '1.4',
        title: 'Señales elementales',
        children: [
            { id: '1.4.1', title: 'Funciones escalón unitario e impulso unitario' },
            { id: '1.4.2', title: 'La señal exponencial compleja' },
        ]
      },
      {
        id: '1.5',
        title: 'Sistemas de tiempo continuo y tiempo discreto',
        children: [
            { id: '1.5.1', title: 'Ejemplos simples de sistemas' },
            { id: '1.5.2', title: 'Interconexión de sistemas' },
        ]
      },
      {
        id: '1.6',
        title: 'Propiedades básicas de los sistemas',
        children: [
            { id: '1.6.1', title: 'Sistemas con y sin memoria' },
            { id: '1.6.2', title: 'Invertibilidad y sistemas inversos' },
            { id: '1.6.3', title: 'Causalidad' },
            { id: '1.6.4', title: 'Estabilidad' },
            { id: '1.6.5', title: 'Invariancia en el tiempo' },
            { id: '1.6.6', title: 'Linealidad' },
        ]
      },
    ],
  },
  {
    id: '2',
    title: 'Capítulo 2: Sistemas Lineales e Invariantes en el Tiempo',
    children: [
      { id: '2.1', title: 'Introducción' },
      {
        id: '2.2',
        title: 'Sistemas LTI de tiempo discreto: La suma de convolución',
        children: [
            { id: '2.2.1', title: 'Representación de señales en términos de impulsos' },
            { id: '2.2.2', title: 'Respuesta al impulso y suma de convolución' },
        ]
      },
      {
        id: '2.3',
        title: 'Sistemas LTI de tiempo continuo: La integral de convolución',
        children: [
            { id: '2.3.1', title: 'Representación de señales en términos de impulsos' },
            { id: '2.3.2', title: 'Respuesta al impulso e integral de convolución' },
        ]
      },
      { id: '2.4', title: 'Propiedades de los sistemas LTI' },
      { id: '2.5', title: 'Sistemas LTI causales descritos por ecuaciones' },
    ],
  },
  {
    id: '3',
    title: 'Capítulo 3: Series de Fourier para Señales Periódicas',
    children: [
      { id: '3.1', title: 'Introducción' },
      { id: '3.2', title: 'Respuesta de LTI a exponenciales complejas' },
      { id: '3.3', title: 'Series de Fourier para señales de tiempo continuo' },
      { id: '3.4', title: 'Convergencia de las series de Fourier' },
      { id: '3.5', title: 'Propiedades de las series de Fourier de tiempo continuo' },
      { id: '3.6', title: 'Series de Fourier para señales de tiempo discreto' },
      { id: '3.7', title: 'Propiedades de las series de Fourier de tiempo discreto' },
      { id: '3.8', title: 'Series de Fourier y sistemas LTI' },
    ],
  },
  {
    id: '4',
    title: 'Capítulo 4: Transformada de Fourier de Tiempo Continuo',
    children: [
      { id: '4.1', title: 'Representación de señales aperiódicas' },
      { id: '4.2', title: 'Transformada de Fourier para señales periódicas' },
      { id: '4.3', title: 'Propiedades de la transformada de Fourier' },
      { id: '4.4', title: 'La propiedad de convolución' },
      { id: '4.5', title: 'La propiedad de multiplicación' },
      { id: '4.6', title: 'Tablas de propiedades y pares de Fourier' },
    ],
  },
  {
    id: '5',
    title: 'Capítulo 5: Transformada de Fourier de Tiempo Discreto',
    children: [
      { id: '5.1', title: 'Representación de señales aperiódicas' },
      { id: '5.2', title: 'Transformada de Fourier para señales periódicas' },
      { id: '5.3', title: 'Propiedades de la transformada de Fourier' },
      { id: '5.4', title: 'La propiedad de convolución' },
      { id: '5.5', title: 'La propiedad de multiplicación' },
      { id: '5.6', title: 'Dualidad' },
    ],
  },
  {
    id: '6',
    title: 'Capítulo 6: Caracterización en Tiempo y Frecuencia',
    children: [
      { id: '6.1', title: 'Magnitud y fase de la transformada de Fourier' },
      { id: '6.2', title: 'Respuesta en frecuencia de sistemas LTI' },
      { id: '6.3', title: 'Filtros ideales selectivos en frecuencia' },
      { id: '6.4', title: 'Filtros no ideales' },
      { id: '6.5', title: 'Sistemas de primer y segundo orden' },
    ],
  },
  {
    id: '7',
    title: 'Capítulo 7: Muestreo',
    children: [
      { id: '7.1', title: 'El teorema de muestreo' },
      { id: '7.2', title: 'Reconstrucción con interpolación' },
      { id: '7.3', title: 'El efecto de submuestreo: Aliasing' },
      { id: '7.4', title: 'Procesamiento en tiempo discreto de señales continuas' },
      { id: '7.5', title: 'Muestreo de señales de tiempo discreto' },
    ],
  },
  {
    id: '8',
    title: 'Capítulo 8: La Transformada de Laplace',
    children: [
      { id: '8.1', title: 'La transformada de Laplace' },
      { id: '8.2', title: 'Región de convergencia (ROC)' },
      { id: '8.3', title: 'La transformada inversa de Laplace' },
      { id: '8.4', title: 'Diagrama de polos y ceros' },
      { id: '8.5', title: 'Propiedades de la transformada de Laplace' },
      { id: '8.6', title: 'Análisis de sistemas LTI con Laplace' },
    ],
  },
  {
    id: '9',
    title: 'Capítulo 9: La Transformada z',
    children: [
      { id: '9.1', title: 'La transformada z' },
      { id: '9.2', title: 'Región de convergencia (ROC)' },
      { id: '9.3', title: 'La transformada z inversa' },
      { id: '9.4', title: 'Diagrama de polos y ceros' },
      { id: '9.5', title: 'Propiedades de la transformada z' },
      { id: '9.6', title: 'Análisis de sistemas LTI con la transformada z' },
    ],
  },
];
