# ENT · Portal de nutrición y rendimiento

Portal web responsivo para Esteban Téllez. La interfaz está hecha con HTML, CSS y JavaScript. La autenticación y los expedientes usan Supabase en una organización Free. La vista pública de demostración se publicará con GitHub Pages.

## Estado del proyecto

- Página de inicio y planes Light, Weight y Best listos para revisión.
- Accesos de paciente y administrador conectados a Supabase Auth.
- El perfil del paciente consulta su perfil, mediciones, dieta, entrenamiento y citas, sujeto a las políticas RLS.
- El administrador puede consultar expedientes y solicitudes, registrar mediciones, publicar dietas y rutinas, y agendar consultas.
- El esquema de datos está documentado en [supabase/schema.sql](supabase/schema.sql).
- Las tablas están vacías; no se han cargado expedientes ni datos de pacientes.

## Pendiente de habilitar

Aún no hay cuentas de administrador o pacientes. La creación e invitación de cuentas debe configurarse de forma segura. También falta conectar el formulario público de solicitud, la notificación por WhatsApp y los pagos. Los precios y la dirección del consultorio deben confirmarse.

## Publicación de la vista previa

El repositorio debe estar público para usar GitHub Pages con GitHub Free. En **Settings → Pages**, el origen debe ser **GitHub Actions**. Después ejecuta manualmente **Actions → Publish ENT preview → Run workflow**. El archivo de flujo es .github/workflows/pages.yml.

La página de demostración no debe recibir información real de pacientes. El repositorio público contiene el código fuente y la configuración pública del cliente Supabase; no debe incluir contraseñas, claves secretas ni expedientes.

## Seguridad de Supabase

- Row Level Security está activado en todas las tablas públicas.
- Los pacientes solo pueden consultar su propio expediente; las dietas y rutinas solo son visibles tras publicarse.
- El rol administrativo se valida desde app_metadata, que no puede modificarse desde el perfil del usuario.
- supabase-config.js contiene el URL del proyecto y una clave publicable diseñada para el cliente web. No contiene una clave service_role.
