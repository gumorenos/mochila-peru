# Mochila Perú

Checklist familiar de emergencia para hogares en Perú. Calcula una mochila de emergencia y caja de reserva según zona, riesgos, composición del hogar y días de autonomía.

## Qué incluye

- Presets peruanos por zona: Lima/costa, costa norte, sierra, selva y sur volcánico.
- Riesgos locales: sismo, tsunami, huaico/deslizamiento, lluvias/inundación, helada/friaje, ceniza volcánica, incendio y corte de agua/luz.
- Checklist en español peruano, con referencias a INDECI, COEN, SENAMHI, IGP, CENEPRED, Minsa, Bomberos 116, Policía 105 y SAMU 106.
- Diseño más sobrio y utilitario: la herramienta aparece en la primera pantalla, sin hero genérico ni capas de tarjetas decorativas.
- Sigue siendo 100% estática, privada y offline: no hay backend, cuentas, analytics ni llamadas de red.
- Seguimiento opcional solo para artículos que sí se rotan, vencen, se prueban o se recargan.
- Vista por prioridad, filtros por clasificación y orden por recomendado, prioridad, vencimiento o pendientes.
- Enlace compartible con la lista actual, resumen copiable para WhatsApp y salida PDF desde la impresión del navegador.

## Uso local

Abre `index.html` directamente en el navegador, o sirve la carpeta con cualquier servidor estático:

```bash
npx serve .
```

La configuración del hogar, riesgos, vista de lista, checks y fechas de rotación se guardan en `localStorage`, en el navegador del usuario. El botón de compartir codifica una copia compacta de esa lista en el hash de la URL (`#l=...`); no usa servidor ni base de datos. La descarga PDF se genera localmente en el navegador como archivo `.pdf`, sin enviar la lista a un servidor.

## Despliegue recomendado: Cloudflare Pages

La app no necesita build.

1. En Cloudflare, entra a **Workers & Pages**.
2. Crea un proyecto de **Pages** conectado a `gumorenos/mochila-peru`.
3. Configuración:
   - Framework preset: `None`
   - Build command: vacío
   - Build output directory: `/`
4. Publica.

Luego puedes agregar un dominio tipo `mochila.gumorenos.space` desde **Custom domains**.

Para publicar manualmente desde una máquina con `wrangler` autenticado:

```bash
wrangler pages deploy . --project-name mochila-peru
```

## Alternativas de despliegue

- GitHub Pages: servir desde `main` / root.
- Netlify o Vercel: proyecto estático sin build.
- Servidor propio: copiar los archivos y servirlos con Nginx/Caddy.

## Pendientes razonables

- Agregar fuentes/enlaces visibles por artículo si se quiere una versión más institucional.
- Agregar service worker si se quiere instalación PWA offline después de la primera visita.
- Revisar el contenido con alguien de gestión de riesgos o seguridad civil antes de publicarlo ampliamente.

## Licencia

MIT. Este proyecto deriva de [`readykit`](https://github.com/Sreenivas-Sadhu-Prabhakara/readykit) y mantiene la licencia incluida.
