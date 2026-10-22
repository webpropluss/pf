# Prime Fit · versión 34

Reporte de ventas propio, porcentaje de los instructores con su reporte de pago,
e ingreso neto en el Dashboard.

## ⚠️ Pasos para actualizar (en este orden)

1. SQL Editor → **`supabase/21_reporte_ventas.sql`** → Run. Al final, la columna
   **cuadra** debe decir `true` en todos los productos.
2. SQL Editor → **`supabase/22_porcentaje_instructores.sql`** → Run.
3. Sube la carpeta. Abajo del menú debe decir **v34**.
4. Entra a **Instructores → ✏️** y ponle su porcentaje a cada uno.

Los dos SQL se pueden ejecutar varias veces sin problema.

---

## 1 · 📈 Reporte de ventas (nuevo en el menú)

Filtro **Desde / Hasta**. Arriba, cinco cifras:

| | Qué es |
|---|---|
| **Invertido en mercadería** | Lo que había en stock al empezar + lo que compraste en el rango (a precio de compra) |
| **Inversión de lo vendido** | Lo que te costó lo que vendiste |
| **Vendido** | Lo que pagaron los clientes |
| **Ganancia** | Vendido − inversión de lo vendido |
| **Queda invertido** | Mercadería que sigue en el estante al cerrar el rango |

Ejemplo: invertido Bs. 16.237 → se vendió Bs. 5.000 que costaron Bs. 4.500 →
ganancia Bs. 500.

Debajo, **la misma tabla producto por producto** (con unidades) y el total, y la
lista de compras de mercadería del rango. Excel con 4 hojas.

## 2 · Porcentaje en Instructores

Al registrar o editar un instructor hay un campo **Porcentaje del instructor (%)**.
Mientras lo escribes te dice: *"De cada Bs. 100 cobrados por sus clases: Bs. 50
para el instructor y Bs. 50 para Prime Fit"*. La tabla muestra el % de cada uno
y **Sin definir** al que todavía no lo tiene.

## 3 · 💰 Pago a instructores (nuevo en el menú)

Filtro **Desde / Hasta**. Por cada instructor: su %, lo cobrado por inscripciones,
lo cobrado por pases, el total, **cuánto le corresponde** y cuánto queda para
Prime Fit. Cada instructor tiene un desplegable con el detalle cobro por cobro
(fecha, alumno, clase), para mostrárselo al pagarle. Excel con 2 hojas.

Cómo se calcula:
- Se cuenta lo **cobrado** en el rango (fecha del pago), igual que el Dashboard.
- Si una inscripción tiene clases con distintos instructores, el cobro se reparte
  según lo que vale cada clase.
- Un pase del día va al instructor de su horario. **Los pases registrados sin
  horario no tienen instructor** y quedan enteros para Prime Fit.
- Se usa el porcentaje que el instructor tiene **hoy**. Si se lo cambias, el
  reporte de meses pasados también cambia.

## 4 · Dashboard

- **Ingresos del período** sigue igual: inscripciones + pases + ganancia de productos.
- Nueva tarjeta **Ingreso neto del período** = ingresos − pago a instructores.
- Hay otra tarjeta nueva, **Ganancia en productos**.
  Las tarjetas nuevas y los dos reportes nuevos solo los ve el **Administrador**.
