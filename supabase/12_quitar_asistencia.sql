-- ============================================================
-- PRIME FIT · Limpiar los datos de asistencia (OPCIONAL)
-- Solo si quieres borrar los registros de prueba que hayan quedado.
--
-- ⚠ La TABLA no se elimina a propósito: varias funciones del sistema
--   (eliminar alumno, eliminar horario) la consultan. Una tabla vacía
--   no ocupa nada ni molesta, y si algún día vuelves a querer pasar
--   lista, el módulo se puede reactivar sin tocar la base.
-- ============================================================

delete from asistencias;

-- Para ver que quedó vacía:
select count(*) as registros_de_asistencia from asistencias;
