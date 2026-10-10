import { CourseApp } from '@/components/course-app';
import { loadPublishedOutline } from '@/lib/data/server';

// La página se regenera como mucho cada 2 minutos; el navegador, además,
// vuelve a consultar el temario al abrirla.
export const revalidate = 120;

export default async function Home() {
  const initial = await loadPublishedOutline(revalidate);
  return <CourseApp initial={initial} />;
}
