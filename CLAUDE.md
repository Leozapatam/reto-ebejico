# Instrucciones para Claude Code — Reto Ebéjico

> **IMPORTANTE PARA CLAUDE:**
> Lee obligatoriamente el archivo [`HANDOFF.md`](HANDOFF.md) antes de proponer cambios o ejecutar tareas.
> Contiene el estado exacto del proyecto, las decisiones territoriales y arquitectónicas ya aprobadas, y la guía paso a paso para no duplicar trabajo ni perder contexto.

---

## Comandos Principales

```bash
# Iniciar servidor local de desarrollo (puerto 5173)
npm.cmd run dev

# Verificación de tipos TypeScript (¡no debe dar errores!)
npx.cmd tsc --noEmit

# Compilación de producción
npm.cmd run build

# Prueba de físicas, guardarraíles y anti-trampas
node tools/test_anti_cheat.cjs
```

---

## Reglas Clave del Proyecto
1. **Vehículo:** Carro de Rodillos tradicional de Ebéjico (balineras de acero sobre asfalto, chasis de cedro, timón de lazo).
2. **Territorio Real:** 26,15 km desde la boca occidental de salida del Túnel de Occidente hasta el Parque Principal de Ebéjico (elevación 1.907 msnm a 1.141 msnm según Copernicus DEM 30m).
3. **Ortofoto Aérea:** Google Satellite Zoom 18 descargada localmente (`apps/reto-ebejico/public/tiles/satellite/`). Está 100% libre de nubes sobre Ebéjico.
4. **Defensas Viales:** Defensas bionda galvanizadas reflectivas con colisión física y rebote en curvas y puentes.
5. **Anti-trampas:** Detección de caída al barranco (> 28px de la calzada) y detección de salto de curvas (> 4 segmentos adelantados).
6. **Entorno Windows:** Usar `npm.cmd` o `npx.cmd` para comandos en PowerShell.
