# Album Mundial 2026

Web estatica para que tus amigos creen cuenta, entren y llenen su propio album.

## 1. Crear Supabase

1. Entra a Supabase y crea un proyecto nuevo.
2. Ve a `SQL Editor`.
3. Copia y ejecuta todo el contenido de `supabase-schema.sql`.
4. Ve a `Authentication` > `Providers` > `Email`.
5. Activa Email. Para que tus amigos entren rapido, puedes desactivar `Confirm email`.
6. Ve a `Project Settings` > `API`.
7. Copia:
   - `Project URL`
   - `anon public key`
8. Pega esos valores en `supabase-config.js`.

Ejemplo:

```js
window.ALBUM_SUPABASE = {
  url: "https://abcxyz.supabase.co",
  anonKey: "eyJ..."
};
```

## 2. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube estos archivos a la raiz del repositorio:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `supabase-config.js`
   - `supabase-schema.sql`
   - `panini_mundial_2026_base_corregida.json`
   - `.nojekyll`
3. En GitHub entra a `Settings` > `Pages`.
4. En `Build and deployment`, elige:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda y espera a que GitHub genere el link.

## Como funciona

- Cada amigo crea su cuenta con correo y contrasena.
- Cada cuenta guarda su propio avance en Supabase.
- La vista `Repetidas` guarda cantidades en `user_repeated_stickers`.
- El boton `Escanear` intenta leer codigos con la camara cuando el navegador soporta `BarcodeDetector`; si no, usa el campo manual.
- La tabla tiene Row Level Security, asi que cada usuario solo puede leer y modificar sus propias estampas.
- La clave `anon public key` puede estar en GitHub Pages; la seguridad depende de las politicas RLS de `supabase-schema.sql`.

## Importante si ya ejecutaste el SQL antes

Vuelve a ejecutar `supabase-schema.sql` completo en Supabase. No borra tus datos; solo agrega la tabla de repetidas y vuelve a crear las politicas si ya existen.

## Archivos opcionales

Los archivos `.csv` y `.txt` son respaldo de datos. No son necesarios para que la web funcione.
