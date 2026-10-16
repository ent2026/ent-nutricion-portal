# ENT · Portal de nutrición y rendimiento

Portal web responsivo para Esteban Téllez. La interfaz está hecha con HTML, CSS y JavaScript. La autenticación y los expedientes usan Supabase en una organización Free. La vista pública de demostración se publicará con GitHub Pages.

## Estado del proyecto

- La página de inicio y los planes Light, Weight y Best están listos para revisión.
- Los accesos de paciente y administrador ya usan Supabase Auth.
- El perfil del paciente consulta su perfil, mediciones, dieta, entrenamiento y citas, sujeto a las políticas RLS de Supabase.
- El administrador consulta solicitudes, expedientes y citas, sujeto al rol admin en app_metadata.
- El esquema de datos está documentado en [supabase/schema.sql](supabase/schema.sql).
- Las tablas no contienen expedientes ni datos de pacientes.

## Pendiente de habilitar

Aún no se han creado cuentas de administrador o pacientes. Tampoco están conectados el formulario público de solicitud, el alta/invitación de cuentas, la edición de mediciones y planes, los pagos ni las notificaciones de WhatsApp. Los precios y la dirección del consultorio también deben confirmarse.

## Publicación de la vista previa

El repositorio debe estar público para usar GitHub Pages con GitHub Free. En **Settings → Pages**, el origen debe ser **GitHub Actions**. Después ejecuta manualmente **Actions → Publish ENT preview → Run workflow**. El archivo de flujo es .github/workflows/pages.yml.

La página de demostración no debe recibir información real de pacientes. El repositorio público contiene el código fuente y configuración pública del cliente Supabase; no debe incluir contraseñas, claves secretas ni expedientes.

## Seguridad de Supabase

- Row Level Security está activado en todas las tablas públicas.
- Los pacientes solo pueden consultar su propio expediente; las dietas y rutinas solo son visibles tras publicarse.
- El rol administrativo se valida desde app_metadata, que no puede modificarse desde el perfil del usuario.
- supabase-config.js contiene el URL del proyecto y una clave publicable diseñada para el cliente web. No contiene una clave service_role.
