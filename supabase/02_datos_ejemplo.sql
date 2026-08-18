-- ============================================================
-- PRIME FIT · Datos de ejemplo (igual que la semilla del sistema local)
-- Ejecutar DESPUÉS de 01_esquema.sql
-- ============================================================

insert into disciplinas (codigo, nombre, descripcion, precio_mensual) values
  ('DIS-001', 'Funcional', 'Entrenamiento funcional de alta intensidad', 200),
  ('DIS-002', 'Boxeo',     'Boxeo recreativo y competitivo',             220),
  ('DIS-003', 'Zumba',     'Baile fitness con música latina',            150)
on conflict (codigo) do nothing;

insert into instructores (codigo, nombre, telefono, especialidad) values
  ('INS-001', 'Carlos Mamani',  '59171111111', 'Funcional'),
  ('INS-002', 'Rodrigo Flores', '59172222222', 'Boxeo'),
  ('INS-003', 'Daniela Rojas',  '59173333333', 'Zumba')
on conflict (codigo) do nothing;

insert into horarios (disciplina_id, instructor_id, dias, hora_inicio, hora_fin, sala, cupo) values
  (1, 1, 'Lun-Vie',     '07:00', '08:00', 'Sala 1', 20),
  (1, 1, 'Lun-Vie',     '19:00', '20:00', 'Sala 1', 25),
  (2, 2, 'Lun-Mié-Vie', '18:00', '19:30', 'Sala 2', 15),
  (2, 2, 'Mar-Jue',     '07:00', '08:30', 'Sala 2', 12),
  (3, 3, 'Lun-Mié-Vie', '20:00', '21:00', 'Sala 3', 30),
  (3, 3, 'Sáb',         '09:00', '10:30', 'Sala 3', 30);

insert into alumnos (codigo, nombre, dni, telefono, email, fecha_nacimiento, direccion) values
  ('ALU-001', 'María Fernández', '10203040', '59176000001', 'maria@mail.com',  '1998-04-12', 'Av. América 123'),
  ('ALU-002', 'José Quispe',     '20304050', '59176000002', 'jose@mail.com',   '1995-09-30', 'C. Sucre 456'),
  ('ALU-003', 'Lucía Vargas',    '30405060', '59176000003', 'lucia@mail.com',  '2001-01-22', 'Av. Blanco Galindo km 4'),
  ('ALU-004', 'Andrés Choque',   '40506070', '59176000004', 'andres@mail.com', '1993-07-15', 'C. Jordán 789'),
  ('ALU-005', 'Paola Gutiérrez', '50607080', '59176000005', 'paola@mail.com',  '1999-11-05', 'Av. Ayacucho 321'),
  ('ALU-006', 'Ricardo Salazar', '60708090', '59176000006', 'ricardo@mail.com','1990-03-18', 'C. Lanza 654'),
  ('ALU-007', 'Camila Ortiz',    '70809010', '59176000007', 'camila@mail.com', '2002-06-27', 'Av. Heroínas 987')
on conflict (codigo) do nothing;

insert into config (clave, valor) values
  ('nombre_gimnasio', 'Prime Fit'),
  ('direccion', ''),
  ('telefono', ''),
  ('dias_aviso_whatsapp', '3'),
  ('mensaje_whatsapp', 'Hola {nombre} 👋 Te saludamos de Prime Fit 🥊. Tu mensualidad vence el {fecha}. ¡Renueva a tiempo para no perder tu cupo! 💪')
on conflict (clave) do nothing;

-- ============================================================
-- USUARIOS DEL SISTEMA
-- 1) Crear los usuarios en: Supabase → Authentication → Users → Add user
--    (marcar "Auto Confirm User"):
--      admin@primefit.com      / admin123
--      recepcion@primefit.com  / recepcion123
--      caja@primefit.com       / caja123
-- 2) Luego ejecutar esto para asignarles nombre y rol:
-- ============================================================
insert into perfiles (id, nombre, rol)
select u.id,
       case u.email
         when 'admin@primefit.com'     then 'Administrador'
         when 'recepcion@primefit.com' then 'Recepción'
         when 'caja@primefit.com'      then 'Caja'
       end,
       case u.email
         when 'admin@primefit.com'     then 'Administrador'
         when 'recepcion@primefit.com' then 'Recepcionista'
         when 'caja@primefit.com'      then 'Cajero'
       end
from auth.users u
where u.email in ('admin@primefit.com','recepcion@primefit.com','caja@primefit.com')
on conflict (id) do nothing;
