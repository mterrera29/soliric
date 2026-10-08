// Validaciones sin dependencias de servidor (las usa también el navegador).
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
