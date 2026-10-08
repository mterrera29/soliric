/**
 * Young Serif para las imágenes de vista previa (la tipografía del nombre). Se pide a Google Fonts solo con
 * los caracteres necesarios. Si no hay red, devuelve undefined y la imagen usa la fuente por defecto.
 */
export async function youngSerifFonts(text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Young+Serif&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return undefined;
    const data = await (await fetch(url)).arrayBuffer();
    return [{ name: 'Young Serif', data, style: 'normal' as const, weight: 400 as const }];
  } catch {
    return undefined;
  }
}
