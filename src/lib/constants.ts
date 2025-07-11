
import type { IndexItem } from '@/lib/types';

export const bookIndex: IndexItem[] = [
  {
    id: '1',
    title: 'Capítulo 1: Señales y Sistemas',
    children: [
      { id: '1.1', title: 'Introducción' },
      { id: '1.2', title: 'Señales de tiempo continuo y tiempo discreto' },
      { id: '1.3', title: 'Transformaciones de la variable independiente' },
      { id: '1.4', title: 'Señales elementales' },
      { id: '1.5', title: 'Sistemas de tiempo continuo y tiempo discreto' },
      { id: '1.6', title: 'Propiedades básicas de los sistemas' },
    ],
  },
  {
    id: '2',
    title: 'Capítulo 2: Sistemas Lineales e Invariantes en el Tiempo',
    children: [
      { id: '2.1', title: 'Introducción' },
      { id: '2.2', title: 'Sistemas LTI de tiempo discreto: La suma de convolución' },
      { id: '2.3', title: 'Sistemas LTI de tiempo continuo: La integral de convolución' },
      { id: '2.4', title: 'Propiedades de los sistemas lineales e invariantes en el tiempo' },
      { id: '2.5', title: 'Sistemas LTI causales descritos por ecuaciones diferenciales y en diferencias' },
    ],
  },
  {
    id: '3',
    title: 'Capítulo 3: Representación de Señales Periódicas mediante Series de Fourier',
    children: [
      { id: '3.1', title: 'Introducción' },
      { id: '3.2', title: 'Una perspectiva histórica' },
      { id: '3.3', title: 'La respuesta de sistemas LTI a exponenciales complejas' },
      { id: '3.4', title: 'Representación en series de Fourier de señales periódicas de tiempo continuo' },
      { id: '3.5', title: 'Convergencia de las series de Fourier' },
      { id: '3.6', title: 'Propiedades de las series de Fourier de tiempo continuo' },
      { id: '3.7', title: 'Representación en series de Fourier de señales periódicas de tiempo discreto' },
      { id: '3.8', title: 'Propiedades de las series de Fourier de tiempo discreto' },
      { id: '3.9', title: 'Series de Fourier y sistemas LTI' },
    ],
  },
  {
    id: '4',
    title: 'Capítulo 4: La Transformada de Fourier de Tiempo Continuo',
    children: [
      { id: '4.1', title: 'Introducción' },
      { id: '4.2', title: 'Representación de señales aperiódicas: La transformada de Fourier de tiempo continuo' },
      { id: '4.3', title: 'La transformada de Fourier para señales periódicas' },
      { id: '4.4', title: 'Propiedades de la transformada de Fourier de tiempo continuo' },
      { id: '4.5', title: 'La propiedad de convolución' },
      { id: '4.6', title: 'La propiedad de multiplicación' },
      { id: '4.7', title: 'Propiedades de la transformada de Fourier y sistemas LTI' },
    ],
  },
  {
    id: '5',
    title: 'Capítulo 5: La Transformada de Fourier de Tiempo Discreto',
    children: [
      { id: '5.1', title: 'Introducción' },
      { id: '5.2', title: 'Representación de señales aperiódicas: La transformada de Fourier de tiempo discreto' },
      { id: '5.3', title: 'La transformada de Fourier para señales periódicas' },
      { id: '5.4', title: 'Propiedades de la transformada de Fourier de tiempo discreto' },
      { id: '5.5', title: 'La propiedad de convolución' },
      { id: '5.6', title: 'La propiedad de multiplicación' },
      { id: '5.7', title: 'Propiedades de la transformada de Fourier y sistemas LTI' },
    ],
  },
  {
    id: '6',
    title: 'Capítulo 6: Caracterización en Tiempo y Frecuencia de Señales y Sistemas',
    children: [
      { id: '6.1', title: 'Introducción' },
      { id: '6.2', title: 'Representación magnitud-fase de la transformada de Fourier' },
      { id: '6.3', title: 'Representación magnitud-fase de la respuesta en frecuencia de sistemas LTI' },
      { id: '6.4', title: 'Propiedades en el dominio del tiempo de filtros ideales selectivos en frecuencia' },
      { id: '6.5', title: 'Aspectos en el dominio del tiempo y la frecuencia de filtros no ideales' },
    ],
  },
  {
    id: '7',
    title: 'Capítulo 7: Muestreo',
    children: [
      { id: '7.1', title: 'Introducción' },
      { id: '7.2', title: 'Representación de una señal de tiempo continuo por sus muestras: El teorema de muestreo' },
      { id: '7.3', title: 'Reconstrucción de una señal a partir de sus muestras usando interpolación' },
      { id: '7.4', title: 'El efecto del submuestreo: Aliasing' },
      { id: '7.5', title: 'Procesamiento en tiempo discreto de señales de tiempo continuo' },
    ],
  },
  {
    id: '8',
    title: 'Capítulo 8: La Transformada de Laplace',
    children: [
      { id: '8.1', title: 'Introducción' },
      { id: '8.2', title: 'La transformada de Laplace' },
      { id: '8.3', title: 'La región de convergencia para las transformadas de Laplace' },
      { id: '8.4', title: 'La transformada inversa de Laplace' },
      { id: '8.5', title: 'Evaluación geométrica de la transformada de Fourier desde el diagrama de polos y ceros' },
      { id: '8.6', title: 'Propiedades de la transformada de Laplace' },
      { id: '8.7', title: 'Análisis y caracterización de sistemas LTI usando la transformada de Laplace' },
    ],
  },
  {
    id: '9',
    title: 'Capítulo 9: La Transformada z',
    children: [
      { id: '9.1', title: 'Introducción' },
      { id: '9.2', title: 'La transformada z' },
      { id: '9.3', title: 'La región de convergencia para la transformada z' },
      { id: '9.4', title: 'La transformada z inversa' },
      { id: '9.5', title: 'Evaluación geométrica de la transformada de Fourier desde el diagrama de polos y ceros' },
      { id: '9.6', title: 'Propiedades de la transformada z' },
      { id: '9.7', title: 'Análisis y caracterización de sistemas LTI usando la transformada z' },
    ],
  },
];
