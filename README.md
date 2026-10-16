# ENT · Portal de nutrición y rendimiento

Portal web responsivo para Esteban Téllez, construido con HTML, CSS y JavaScript. Usa Supabase Auth, Postgres y Storage para cuentas y expedientes. La vista pública se publica como previa gratuita con GitHub Pages.

## Funciones

- Portada con seis servicios coherentes en el formulario público y en el administrador: consulta inicial, seguimiento, paquetes bimestral, trimestral y semestral, y consulta en pareja.
- Solicitudes en línea guardadas en la bandeja del administrador. El paciente puede abrir WhatsApp con el mensaje de solicitud preparado y confirmar el envío desde WhatsApp.
- Altas manuales y aprobación de solicitudes con usuario y contraseña definidos por el administrador.
- Directorio con búsqueda, selección individual o múltiple, apertura de expediente y baja confirmada.
- Perfil individual con resumen, mediciones, historial, archivos PDF de dieta, rutinas, fotos privadas, consultas y avisos.
- Administración de precios públicos, medios de pago, dirección del consultorio y avisos generales.
- RLS y Storage privados para que cada paciente vea solo sus datos publicados.

## Publicación y límites

GitHub Pages sirve la vista previa del repositorio ent2026/ent-nutricion-portal. Para producción se planea migrar el sitio a Netlify.

El formulario de solicitud no procesa pagos ni confirma citas. El enlace de WhatsApp prepara el mensaje, pero la persona debe tocar Enviar en WhatsApp. No se deben introducir datos médicos sensibles en la solicitud pública. Los expedientes deben mantenerse en Supabase con sus políticas de acceso.

El repositorio público contiene el código fuente y la clave publicable de Supabase. Nunca debe contener contraseñas, claves secretas ni información de pacientes.

## Administración de datos

El administrador puede registrar mediciones, publicar dietas y rutinas, añadir fotos, registrar consultas y avisos, y ajustar precios. La eliminación de un expediente borra permanentemente su cuenta, archivos e historial después de confirmar el usuario y la acción. Debe usarse con cuidado.

Las credenciales de pacientes se definen al crear el acceso. La contraseña se muestra solo en el flujo de creación para que el administrador pueda copiarla y compartirla de forma segura; no queda almacenada en texto visible dentro del expediente.