import type { IndexItem } from '@/lib/types';

export const bookIndex: IndexItem[] = [
    {
        id: '1', title: '1 SEÑALES Y SISTEMAS', children: [
            { id: '1.0', title: '1.0 Introducción' },
            {
                id: '1.1', title: '1.1 Señales continuas y discretas', children: [
                    { id: '1.1.1', title: '1.1.1 Ejemplos y representación matemática' },
                    { id: '1.1.2', title: '1.1.2 Señales de energía y de potencia' },
                ]
            },
            {
                id: '1.2', title: '1.2 Transformaciones de la variable independiente', children: [
                    { id: '1.2.1', title: '1.2.1 Ejemplos de transformaciones de la variable independiente' },
                    { id: '1.2.2', title: '1.2.2 Señales periódicas' },
                    { id: '1.2.3', title: '1.2.3 Señales par e impar' },
                ]
            },
            {
                id: '1.3', title: '1.3 Señales exponenciales y senoidales', children: [
                    { id: '1.3.1', title: '1.3.1 Señales continuas exponencial compleja y senoidal' },
                    { id: '1.3.2', title: '1.3.2 Señales discretas exponencial compleja y senoidal' },
                    { id: '1.3.3', title: '1.3.3 Propiedades de periodicidad de exponenciales discretas' },
                ]
            },
            {
                id: '1.4', title: '1.4 Las funciones impulso unitario y escalón unitario', children: [
                    { id: '1.4.1', title: '1.4.1 Las secuencias discretas impulso unitario y escalón unitario' },
                    { id: '1.4.2', title: '1.4.2 Las funciones continuas escalón unitario e impulso unitario' },
                ]
            },
            {
                id: '1.5', title: '1.5 Sistemas continuos y discretos', children: [
                    { id: '1.5.1', title: '1.5.1 Ejemplos sencillos de sistemas' },
                    { id: '1.5.2', title: '1.5.2 Interconexiones de sistemas' },
                ]
            },
            {
                id: '1.6', title: '1.6 Propiedades básicas de los sistemas', children: [
                    { id: '1.6.1', title: '1.6.1 Sistemas con y sin memoria' },
                    { id: '1.6.2', title: '1.6.2 Invertibilidad y sistemas inversos' },
                    { id: '1.6.3', title: '1.6.3 Causalidad' },
                    { id: '1.6.4', title: '1.6.4 Estabilidad' },
                    { id: '1.6.5', title: '1.6.5 Invariancia en el tiempo' },
                    { id: '1.6.6', title: '1.6.6 Linealidad' },
                ]
            },
            { id: '1.7', title: '1.7 Resumen' },
            { id: '1.p', title: 'Problemas' },
        ]
    },
    {
        id: '2', title: '2 SISTEMAS LINEALES INVARIANTES EN EL TIEMPO', children: [
            { id: '2.0', title: '2.0 Introducción' },
            {
                id: '2.1', title: '2.1 Sistemas LTI discretos: La suma de convolución', children: [
                    { id: '2.1.1', title: '2.1.1 La representación de señales discretas en términos de los impulsos' },
                    { id: '2.1.2', title: '2.1.2 La respuesta al impulso unitario discreto y la representación de la suma de convolución de sistemas LTI' },
                ]
            },
            {
                id: '2.2', title: '2.2 Sistemas LTI continuos: La integral de convolución', children: [
                    { id: '2.2.1', title: '2.2.1 La representación de señales continuas en términos de los impulsos' },
                    { id: '2.2.2', title: '2.2.2 La respuesta al impulso unitario continuo y la representación de la integral de convolución de sistemas LTI' },
                ]
            },
            {
                id: '2.3', title: '2.3 Propiedades de los sistemas lineales e invariantes en el tiempo', children: [
                    { id: '2.3.1', title: '2.3.1 Propiedad conmutativa' },
                    { id: '2.3.2', title: '2.3.2 Propiedad distributiva' },
                    { id: '2.3.3', title: '2.3.3 Propiedad asociativa' },
                    { id: '2.3.4', title: '2.3.4 Sistemas LTI con y sin memoria' },
                    { id: '2.3.5', title: '2.3.5 Invertibilidad de sistemas LTI' },
                    { id: '2.3.6', title: '2.3.6 Causalidad para los sistemas LTI' },
                    { id: '2.3.7', title: '2.3.7 Estabilidad para los sistemas LTI' },
                    { id: '2.3.8', title: '2.3.8 Respuesta al escalón unitario de un sistema LTI' },
                ]
            },
            {
                id: '2.4', title: '2.4 Sistemas LTI causales descritos por ecuaciones diferenciales y de diferencias', children: [
                    { id: '2.4.1', title: '2.4.1 Ecuaciones diferenciales lineales con coeficientes constantes' },
                    { id: '2.4.2', title: '2.4.2 Ecuaciones de diferencias lineales con coeficientes constantes' },
                    { id: '2.4.3', title: '2.4.3 Representación en diagrama de bloques de sistemas de primer orden' },
                ]
            },
            {
                id: '2.5', title: '2.5 Funciones singulares', children: [
                    { id: '2.5.1', title: '2.5.1 El impulso unitario como un pulso corto idealizado' },
                    { id: '2.5.2', title: '2.5.2 Definición del impulso unitario mediante la convolución' },
                    { id: '2.5.3', title: '2.5.3 Dobletes unitarios y otras funciones singulares' },
                ]
            },
            { id: '2.6', title: '2.6 Resumen' },
            { id: '2.p', title: 'Problemas' },
        ]
    },
    {
        id: '3', title: '3 REPRESENTACIÓN DE SEÑALES PERIÓDICAS EN SERIES DE FOURIER', children: [
            { id: '3.0', title: '3.0 Introducción' },
            { id: '3.1', title: '3.1 Una perspectiva histórica' },
            { id: '3.2', title: '3.2 La respuesta de sistemas LTI a exponenciales complejas' },
            {
                id: '3.3', title: '3.3 Representación en serie de Fourier de señales periódicas continuas', children: [
                    { id: '3.3.1', title: '3.3.1 Combinaciones lineales de exponenciales complejas relacionadas armónicamente' },
                    { id: '3.3.2', title: '3.3.2 Determinación de la representación en serie de Fourier de una señal periódica continua' },
                ]
            },
            { id: '3.4', title: '3.4 Convergencia de las series de Fourier' },
            {
                id: '3.5', title: '3.5 Propiedades de la serie continua de Fourier', children: [
                    { id: '3.5.1', title: '3.5.1 Linealidad' },
                    { id: '3.5.2', title: '3.5.2 Desplazamiento de tiempo' },
                    { id: '3.5.3', title: '3.5.3 Inversión de tiempo' },
                    { id: '3.5.4', title: '3.5.4 Escalamiento de tiempo' },
                    { id: '3.5.5', title: '3.5.5 Multiplicación' },
                    { id: '3.5.6', title: '3.5.6 Conjugación y simetría conjugada' },
                    { id: '3.5.7', title: '3.5.7 Relación de Parseval para señales periódicas continuas' },
                    { id: '3.5.8', title: '3.5.8 Resumen de las propiedades de la serie continua de Fourier' },
                    { id: '3.5.9', title: '3.5.9 Ejemplos' },
                ]
            },
            {
                id: '3.6', title: '3.6 Representación en series de Fourier de señales periódicas discretas', children: [
                    { id: '3.6.1', title: '3.6.1 Combinaciones lineales de exponenciales complejas relacionadas armónicamente' },
                    { id: '3.6.2', title: '3.6.2 Determinación de la representación en series de Fourier de una señal periódica' },
                ]
            },
            {
                id: '3.7', title: '3.7 Propiedades de la serie discreta de Fourier', children: [
                    { id: '3.7.1', title: '3.7.1 Multiplicación' },
                    { id: '3.7.2', title: '3.7.2 Primera diferencia' },
                    { id: '3.7.3', title: '3.7.3 Relación de Parseval para señales periódicas discretas' },
                    { id: '3.7.4', title: '3.7.4 Ejemplos' },
                ]
            },
            { id: '3.8', title: '3.8 Serie de Fourier y sistemas LTI' },
            {
                id: '3.9', title: '3.9 Filtrado', children: [
                    { id: '3.9.1', title: '3.9.1 Filtros conformadores de frecuencia' },
                    { id: '3.9.2', title: '3.9.2 Filtros selectivos en frecuencia' },
                ]
            },
            {
                id: '3.10', title: '3.10 Ejemplos de filtros continuos descritos mediante ecuaciones diferenciales', children: [
                    { id: '3.10.1', title: '3.10.1 Un filtro paso bajas RC sencillo' },
                    { id: '3.10.2', title: '3.10.2 Un filtro paso altas RC sencillo' },
                ]
            },
            {
                id: '3.11', title: '3.11 Ejemplos de filtros discretos descritos mediante ecuaciones de diferencias', children: [
                    { id: '3.11.1', title: '3.11.1 Filtros recursivos discretos de primer orden' },
                    { id: '3.11.2', title: '3.11.2 Filtros no recursivos discretos' },
                ]
            },
            { id: '3.12', title: '3.12 Resumen' },
            { id: '3.p', title: 'Problemas' },
        ]
    },
    {
        id: '4', title: '4 LA TRANSFORMADA CONTINUA DE FOURIER', children: [
            { id: '4.0', title: '4.0 Introducción' },
            {
                id: '4.1', title: '4.1 Representación de señales aperiódicas: La transformada continua de Fourier', children: [
                    { id: '4.1.1', title: '4.1.1 Desarrollo de la representación de la transformada de Fourier de una señal aperiódica' },
                    { id: '4.1.2', title: '4.1.2 Convergencia de las transformadas de Fourier' },
                    { id: '4.1.3', title: '4.1.3 Ejemplos de transformadas continuas de Fourier' },
                ]
            },
            { id: '4.2', title: '4.2 La transformada de Fourier para señales periódicas' },
            {
                id: '4.3', title: '4.3 Propiedades de la transformada continua de Fourier', children: [
                    { id: '4.3.1', title: '4.3.1 Linealidad' },
                    { id: '4.3.2', title: '4.3.2 Desplazamiento de tiempo' },
                    { id: '4.3.3', title: '4.3.3 Conjugación y simetría conjugada' },
                    { id: '4.3.4', title: '4.3.4 Diferenciación e integración' },
                    { id: '4.3.5', title: '4.3.5 Dualidad' },
                    { id: '4.3.6', title: '4.3.6 Escalamiento de tiempo y de frecuencia' },
                    { id: '4.3.7', title: '4.3.7 Relación de Parseval' },
                ]
            },
            {
                id: '4.4', title: '4.4 La propiedad de convolución', children: [
                    { id: '4.4.1', title: '4.4.1 Ejemplos' }
                ]
            },
            {
                id: '4.5', title: '4.5 La propiedad de multiplicación', children: [
                    { id: '4.5.1', title: '4.5.1 Filtrado selectivo en frecuencia con frecuencia central variable' }
                ]
            },
            { id: '4.6', title: '4.6 Tablas de las propiedades de la transformada de Fourier y de los pares básicos de la transformada de Fourier' },
            { id: '4.7', title: '4.7 Sistemas caracterizados por ecuaciones diferenciales lineales con coeficientes constantes' },
            { id: '4.8', title: '4.8 Resumen' },
            { id: '4.p', title: 'Problemas' },
        ]
    },
    {
        id: '5', title: '5 LA TRANSFORMADA DE FOURIER DE TIEMPO DISCRETO', children: [
            { id: '5.0', title: '5.0 Introducción' },
            {
                id: '5.1', title: '5.1 Representación de señales aperiódicas: La transformada de Fourier de tiempo discreto', children: [
                    { id: '5.1.1', title: '5.1.1 Desarrollo de la transformada de Fourier de tiempo discreto' },
                    { id: '5.1.2', title: '5.1.2 Ejemplos de transformadas de Fourier de tiempo discreto' },
                    { id: '5.1.3', title: '5.1.3 Problemas de la convergencia asociados con la transformada de Fourier de tiempo discreto' },
                ]
            },
            { id: '5.2', title: '5.2 La transformada de Fourier para señales periódicas' },
            {
                id: '5.3', title: '5.3 Propiedades de la transformada de Fourier de tiempo discreto', children: [
                    { id: '5.3.1', title: '5.3.1 Periodicidad de la transformada de Fourier de tiempo discreto' },
                    { id: '5.3.2', title: '5.3.2 Linealidad de la transformada de Fourier' },
                    { id: '5.3.3', title: '5.3.3 Desplazamiento de tiempo y desplazamiento de frecuencia' },
                    { id: '5.3.4', title: '5.3.4 Conjugación y simetría conjugada' },
                    { id: '5.3.5', title: '5.3.5 Diferenciación en frecuencia' },
                    { id: '5.3.6', title: '5.3.6 Inversión en tiempo' },
                    { id: '5.3.7', title: '5.3.7 Expansión en tiempo' },
                    { id: '5.3.9', title: '5.3.9 La relación de Parseval' },
                ]
            },
            {
                id: '5.4', title: '5.4 La propiedad de convolución', children: [
                    { id: '5.4.1', title: '5.4.1 Ejemplos' }
                ]
            },
            { id: '5.5', title: '5.5 La propiedad de multiplicación' },
            { id: '5.6', title: '5.6 Tablas de las propiedades de la transformada de Fourier y pares básicos de la transformada de Fourier' },
            {
                id: '5.7', title: '5.7 Dualidad', children: [
                    { id: '5.7.1', title: '5.7.1 Dualidad en la serie discreta de Fourier' },
                    { id: '5.7.2', title: '5.7.2 Dualidad entre la transformada de Fourier de tiempo discreto y la serie continua de Fourier' },
                ]
            },
            { id: '5.8', title: '5.8 Sistemas caracterizados por ecuaciones en diferencias lineales con coeficientes constantes' },
            { id: '5.9', title: '5.9 Resumen' },
            { id: '5.p', title: 'Problemas' },
        ]
    },
    {
        id: '6', title: '6 CARACTERIZACIÓN EN TIEMPO Y FRECUENCIA', children: [
            { id: '6.0', title: '6.0 Introducción' },
            { id: '6.1', title: '6.1 Representación de la magnitud-fase de la transformada de Fourier' },
            {
                id: '6.2', title: '6.2 Representación de la magnitud-fase de la respuesta en frecuencia de sistemas LTI', children: [
                    { id: '6.2.1', title: '6.2.1 Fase lineal y no lineal' },
                    { id: '6.2.2', title: '6.2.2 Retardo de grupo' },
                    { id: '6.2.3', title: '6.2.3 Magnitud logarítmica y diagramas de Bode' },
                ]
            },
            { id: '6.3', title: '6.3 Propiedades en el dominio del tiempo de filtros ideales' },
            { id: '6.4', title: '6.4 Aspectos en el dominio del tiempo y en el dominio de la frecuencia de los filtros no ideales' },
            {
                id: '6.5', title: '6.5 Sistemas continuos de primer y segundo órdenes', children: [
                    { id: '6.5.1', title: '6.5.1 Sistemas continuos de primer orden' },
                    { id: '6.5.2', title: '6.5.2 Sistemas continuos de segundo orden' },
                    { id: '6.5.3', title: '6.5.3 Diagramas de Bode para respuestas en frecuencia racionales' },
                ]
            },
            {
                id: '6.6', title: '6.6 Sistemas discretos de primer y segundo órdenes', children: [
                    { id: '6.6.1', title: '6.6.1 Sistemas discretos de primer orden' },
                    { id: '6.6.2', title: '6.6.2 Sistemas discretos de segundo orden' },
                ]
            },
            {
                id: '6.7', title: '6.7 Ejemplos de análisis de sistemas en el dominio del tiempo y de la frecuencia', children: [
                    { id: '6.7.1', title: '6.7.1 Análisis de un sistema de suspensión para automóvil' },
                    { id: '6.7.2', title: '6.7.2 Ejemplos de filtros discretos no recursivos' },
                ]
            },
            { id: '6.8', title: '6.8 Resumen' },
            { id: '6.p', title: 'Problemas' },
        ]
    },
    {
        id: '7', title: '7 MUESTREO', children: [
            { id: '7.0', title: '7.0 Introducción' },
            {
                id: '7.1', title: '7.1 Representación de una señal continua mediante sus muestras: El teorema de muestreo', children: [
                    { id: '7.1.1', title: '7.1.1 Muestreo con tren de impulsos' },
                    { id: '7.1.2', title: '7.1.2 Muestreo con un retenedor de orden cero' },
                ]
            },
            { id: '7.2', title: '7.2 Reconstrucción de una señal a partir de sus muestras usando la interpolación' },
            { id: '7.3', title: '7.3 El efecto del submuestreo: Traslape' },
            {
                id: '7.4', title: '7.4 Procesamiento discreto de señales continuas', children: [
                    { id: '7.4.1', title: '7.4.1 Diferenciador digital' },
                    { id: '7.4.2', title: '7.4.2 Retardo de media muestra' },
                ]
            },
            {
                id: '7.5', title: '7.5 Muestreo de señales discretas', children: [
                    { id: '7.5.1', title: '7.5.1 Muestreo con tren de impulsos' },
                ]
            },
            { id: '7.6', title: '7.6 Decimación en tiempo discreto e interpolación' },
            { id: '7.7', title: 'Resumen' },
            { id: '7.p', title: 'Problemas' },
        ]
    },
    {
        id: '8', title: '8 SISTEMAS DE COMUNICACIÓN', children: [
            { id: '8.0', title: '8.0 Introducción' },
            {
                id: '8.1', title: '8.1 Modulación de amplitud con exponencial compleja y senoidal', children: [
                    { id: '8.1.1', title: '8.1.1 Modulación de amplitud con una portadora exponencial compleja' },
                    { id: '8.1.2', title: '8.1.2 Modulación de amplitud con una portadora senoidal' },
                ]
            },
            {
                id: '8.2', title: '8.2 Demodulación para AM senoidal', children: [
                    { id: '8.2.1', title: '8.2.1 Demodulación síncrona' },
                    { id: '8.2.2', title: '8.2.2 Demodulación asíncrona' },
                ]
            },
            { id: '8.3', title: '8.3 Multiplexaje por división de frecuencia' },
            { id: '8.4', title: '8.4 Modulación de amplitud lateral de banda lateral única' },
            {
                id: '8.5', title: '8.5 Modulación de amplitud con una portadora de tren de pulsos', children: [
                    { id: '8.5.1', title: '8.5.1 Modulación de una portadora de tren de pulsos' },
                    { id: '8.5.2', title: '8.5.2 Multiplexaje por división de tiempo' },
                ]
            },
            {
                id: '8.6', title: '8.6 Modulación de amplitud de pulsos', children: [
                    { id: '8.6.1', title: '8.6.1 Señales moduladas por amplitud de pulsos' },
                    { id: '8.6.2', title: '8.6.2 Interferencia intersímbolo en sistemas PAM' },
                    { id: '8.6.3', title: '8.6.3 Modulación digital por amplitud de pulsos y por codificación de pulsos' },
                ]
            },
            {
                id: '8.7', title: '8.7 Modulación de frecuencia senoidal', children: [
                    { id: '8.7.1', title: '8.7.1 Modulación de frecuencia de banda angosta' },
                    { id: '8.7.2', title: '8.7.2 Modulación de frecuencia de banda ancha' },
                    { id: '8.7.3', title: '8.7.3 Señal moduladora de onda cuadrada periódica' },
                ]
            },
            {
                id: '8.8', title: '8.8 Modulación discreta', children: [
                    { id: '8.8.1', title: '8.8.1 Modulación de amplitud senoidal discreta' },
                    { id: '8.8.2', title: '8.8.2 Transmodulación de tiempo discreto' },
                ]
            },
            { id: '8.9', title: '8.9 Resumen' },
            { id: '8.p', title: 'Problemas' },
        ]
    },
    {
        id: '9', title: '9 LA TRANSFORMADA DE LAPLACE', children: [
            { id: '9.0', title: '9.0 Introducción' },
            { id: '9.1', title: '9.1 La transformada de Laplace' },
            { id: '9.2', title: '9.2 La región de convergencia para las transformadas de Laplace' },
            { id: '9.3', title: '9.3 La transformada inversa de Laplace' },
            {
                id: '9.4', title: '9.4 Evaluación geométrica de la transformada de Fourier a partir del diagrama de polos y ceros', children: [
                    { id: '9.4.1', title: '9.4.1 Sistemas de primer orden' },
                    { id: '9.4.2', title: '9.4.2 Sistemas de segundo orden' },
                    { id: '9.4.3', title: '9.4.3 Sistemas paso todo' },
                ]
            },
            {
                id: '9.5', title: '9.5 Propiedades de la transformada de Laplace', children: [
                    { id: '9.5.1', title: '9.5.1 Linealidad de la transformada de Laplace' },
                    { id: '9.5.2', title: '9.5.2 Desplazamiento en el tiempo' },
                    { id: '9.5.3', title: '9.5.3 Desplazamiento en el dominio de s' },
                    { id: '9.5.4', title: '9.5.4 Escalamiento en tiempo' },
                    { id: '9.5.5', title: '9.5.5 Conjugación' },
                    { id: '9.5.6', title: '9.5.6 Propiedad de convolución' },
                    { id: '9.5.7', title: '9.5.7 Diferenciación en el dominio de s' },
                    { id: '9.5.8', title: '9.5.8 Diferenciación en el dominio del tiempo' },
                    { id: '9.5.9', title: '9.5.9 Integración en el dominio del tiempo' },
                    { id: '9.5.10', title: '9.5.10 Los teoremas de valor inicial y de valor final' },
                    { id: '9.5.11', title: '9.5.11 Tabla de propiedades' },
                ]
            },
            { id: '9.6', title: '9.6 Almacén para transformadas de Laplace' },
            {
                id: '9.7', title: '9.7 Análisis y caracterización de los sistemas LTI usando la transformada de Laplace', children: [
                    { id: '9.7.1', title: '9.7.1 Causalidad' },
                    { id: '9.7.2', title: '9.7.2 Estabilidad' },
                    { id: '9.7.3', title: '9.7.3 Sistemas LTI caracterizados por ecuaciones diferenciales lineales con coeficientes constantes' },
                    { id: '9.7.4', title: '9.7.4 Ejemplos que relacionan el comportamiento del sistema con la función del sistema' },
                    { id: '9.7.5', title: '9.7.5 Filtros Butterworth' },
                ]
            },
            {
                id: '9.8', title: '9.8 Álgebra de la función del sistema y representación en diagrama de bloques', children: [
                    { id: '9.8.1', title: '9.8.1 Funciones del sistema para interconexiones de sistemas LTI' },
                    { id: '9.8.2', title: '9.8.2 Representaciones en diagrama de bloques para los sistemas LTI causales' },
                ]
            },
            {
                id: '9.9', title: '9.9 La transformada unilateral de Laplace', children: [
                    { id: '9.9.1', title: '9.9.1 Ejemplos de transformadas unilaterales de Laplace' },
                    { id: '9.9.2', title: '9.9.2 Propiedades de la transformada unilateral de Laplace' },
                    { id: '9.9.3', title: '9.9.3 Solución de ecuaciones diferenciales usando la unilateral transformada de Laplace' },
                ]
            },
            { id: '9.10', title: '9.10 Resumen' },
            { id: '9.p', title: 'Problemas' },
        ]
    },
    {
        id: '10', title: '10 LA TRANSFORMADA Z', children: [
            { id: '10.0', title: '10.0 Introducción' },
            { id: '10.1', title: '10.1 La transformada z' },
            { id: '10.2', title: '10.2 La región de convergencia de la transformada z' },
            { id: '10.3', title: '10.3 La transformada z inversa' },
            {
                id: '10.4', title: '10.4 Evaluación geométrica de la transformada de Fourier a partir del diagrama de polos y ceros', children: [
                    { id: '10.4.1', title: '10.4.1 Sistemas de primer orden' },
                    { id: '10.4.2', title: '10.4.2 Sistemas de segundo orden' },
                ]
            },
            {
                id: '10.5', title: '10.5 Propiedades de la transformada z', children: [
                    { id: '10.5.1', title: '10.5.1 Linealidad' },
                    { id: '10.5.2', title: '10.5.2 Desplazamiento en el tiempo' },
                    { id: '10.5.3', title: '10.5.3 Escalamiento en el dominio de z' },
                    { id: '10.5.4', title: '10.5.4 Inversión de tiempo' },
                    { id: '10.5.5', title: '10.5.5 Expansión en el tiempo' },
                    { id: '10.5.6', title: '10.5.6 Conjugación' },
                    { id: '10.5.7', title: '10.5.7 Propiedad de convolución' },
                    { id: '10.5.8', title: '10.5.8 Diferenciación en el dominio de z' },
                    { id: '10.5.9', title: '10.5.9 Teorema del valor inicial' },
                    { id: '10.5.10', title: '10.5.10 Resumen de propiedades' },
                ]
            },
            { id: '10.6', title: '10.6 Algunos pares comunes de transformada z' },
            {
                id: '10.7', title: '10.7 Análisis y caracterización de los sistemas LTI usando las transformadas z', children: [
                    { id: '10.7.1', title: '10.7.1 Causalidad' },
                    { id: '10.7.2', title: '10.7.2 Estabilidad' },
                    { id: '10.7.3', title: '10.7.3 Sistemas LTI caracterizados por ecuaciones de diferencias lineales con coeficientes constantes' },
                    { id: '10.7.4', title: '10.7.4 Ejemplos que relacionan el comportamiento del sistema con la función del sistema' },
                ]
            },
            {
                id: '10.8', title: '10.8 Álgebra de la función del sistema y representación en diagramas de bloques', children: [
                    { id: '10.8.1', title: '10.8.1 Funciones de sistema de interconexiones de sistemas LTI' },
                    { id: '10.8.2', title: '10.8.2 Representaciones en diagramas de bloques para los sistemas LTI causales' },
                ]
            },
            {
                id: '10.9', title: '10.9 La transformada z unilateral', children: [
                    { id: '10.9.1', title: '10.9.1 Ejemplos de transformadas z unilaterales' },
                    { id: '10.9.2', title: '10.9.2 Propiedades de la transformada z unilateral' },
                    { id: '10.9.3', title: '10.9.3 Solución de ecuaciones de diferencias usando la transformada z unilateral' },
                ]
            },
            { id: '10.10', title: '10.10 Resumen' },
            { id: '10.p', title: 'Problemas' },
        ]
    },
    {
        id: '11', title: '11 SISTEMAS LINEALES RETROALIMENTADOS', children: [
            { id: '11.0', title: '11.0 Introducción' },
            { id: '11.1', title: '11.1 Sistemas lineales retroalimentados' },
            {
                id: '11.2', title: '11.2 Algunas aplicaciones y consecuencias de la retroalimentación', children: [
                    { id: '11.2.1', title: '11.2.1 Diseño de un sistema inverso' },
                    { id: '11.2.2', title: '11.2.2 Compensación de elementos no ideales' },
                    { id: '11.2.3', title: '11.2.3 Estabilización de sistemas inestables' },
                    { id: '11.2.4', title: '11.2.4 Sistemas retroalimentados para datos muestreados' },
                    { id: '11.2.5', title: '11.2.5 Sistemas de rastreo' },
                    { id: '11.2.6', title: '11.2.6 Desestabilización causada por la retroalimentación' },
                ]
            },
            {
                id: '11.3', title: '11.3 Análisis del lugar geométrico de las raíces de los sistemas lineales retroalimentados', children: [
                    { id: '11.3.1', title: '11.3.1 Un ejemplo introductorio' },
                    { id: '11.3.2', title: '11.3.2 Ecuación para los polos de lazo cerrado' },
                    { id: '11.3.3', title: '11.3.3 Los puntos extremos del lugar geométrico de las raíces' },
                    { id: '11.3.4', title: '11.3.4 El criterio del ángulo' },
                    { id: '11.3.5', title: '11.3.5 Propiedades del lugar geométrico de las raíces' },
                ]
            },
            {
                id: '11.4', title: '11.4 Propiedades de la estabilidad de Nyquist', children: [
                    { id: '11.4.1', title: '11.4.1 La propiedad de circulación' },
                    { id: '11.4.2', title: '11.4.2 El criterio de Nyquist para sistemas LTI retroalimentados continuos' },
                    { id: '11.4.3', title: '11.4.3 El criterio de Nyquist para sistemas LTI retroalimentados discretos' },
                ]
            },
            { id: '11.5', title: '11.5 Márgenes de ganancia y fase' },
            { id: '11.6', title: '11.6 Resumen' },
            { id: '11.p', title: 'Problemas' },
        ]
    }
];
