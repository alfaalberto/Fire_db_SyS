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
    { id: '2', title: '2 SISTEMAS LINEALES INVARIANTES EN EL TIEMPO', children: [{id: '2.0', title: '2.0 Introducción'}] },
    { id: '3', title: '3 REPRESENTACIÓN DE SEÑALES PERIÓDICAS EN SERIES DE FOURIER', children: [{id: '3.0', title: '3.0 Introducción'}] },
    { id: '4', title: '4 LA TRANSFORMADA CONTINUA DE FOURIER', children: [{id: '4.0', title: '4.0 Introducción'}] },
    { id: '5', title: '5 LA TRANSFORMADA DE FOURIER DE TIEMPO DISCRETO', children: [{id: '5.0', 'title': '5.0 Introducción'}] },
    { id: '6', title: '6 CARACTERIZACIÓN EN TIEMPO Y FRECUENCIA', children: [{id: '6.0', title: '6.0 Introducción'}] },
    { id: '7', title: '7 MUESTREO', children: [{id: '7.0', title: '7.0 Introducción'}] },
    { id: '8', title: '8 SISTEMAS DE COMUNICACIÓN', children: [{id: '8.0', title: '8.0 Introducción'}] },
    { id: '9', title: '9 LA TRANSFORMADA DE LAPLACE', children: [{id: '9.0', title: '9.0 Introducción'}] },
    { id: '10', title: '10 LA TRANSFORMADA Z', children: [{id: '10.0', title: '10.0 Introducción'}] },
    { id: '11', title: '11 SISTEMAS LINEALES RETROALIMENTADOS', children: [{id: '11.0', title: '11.0 Introducción'}] },
];
